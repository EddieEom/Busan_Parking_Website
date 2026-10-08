import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer as createHttpServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';

let baseUrl;
const api = createHttpServer((request, response) => {
  if (request.url === '/error') {response.writeHead(502); response.end('upstream failed'); return;}
  if (request.url === '/invalid') {response.end('<html>not JSON</html>'); return;}
  const updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({fetchedAt: new Date().toISOString(), warnings: ['기본정보 일부 누락'], items: [
    {id: 'realtime:1', name: '화명', district: '북구', address: '부산 북구 화명동',
      totalSpaces: 100, availableSpaces: 5, status: 'available', realtimeSupported: true, updatedAt},
    {id: 'basic:0', name: '화명 기본정보', district: '북구', address: null,
      totalSpaces: 20, availableSpaces: null, status: 'unknown', realtimeSupported: false, updatedAt: null}
  ]}));
});
before(async () => {
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${api.address().port}`;
});
after(async () => {await new Promise(resolve => api.close(resolve));});

async function withClient(path, work) {
  const transport = new StdioClientTransport({command: process.execPath,
    args: [fileURLToPath(new URL('../server.js', import.meta.url))],
    env: {...process.env, PARKING_API_URL: `${baseUrl}${path}`}, stderr: 'pipe'});
  const client = new Client({name: 'parking-test', version: '1.0.0'});
  try {
    await client.connect(transport);
    await work(client);
  } finally {await client.close(); await transport.close();}
}

test('실제 stdio 서버의 연결과 tools/list', {timeout: 15000}, async () => {
  await withClient('/api/parking', async client => {
    assert.equal(client.getServerVersion().name, 'busan-parking');
    const {tools} = await client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['search_parking', 'get_parking_detail']);
    assert.equal(tools[0].inputSchema.properties.limit.maximum, 50);
    assert.equal(tools[0].annotations.readOnlyHint, true);
  });
});
test('tools/call 정상 조회 및 빈자리 필터', {timeout: 15000}, async () => {
  await withClient('/api/parking', async client => {
    const result = await client.callTool({name: 'search_parking', arguments: {keyword: '화명', availableOnly: true}});
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.matchedCount, 1);
    assert.equal(result.structuredContent.items[0].availableSpaces, 5);
    assert.deepEqual(result.structuredContent.warnings, ['기본정보 일부 누락']);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  });
});
test('검색 결과 없음은 정상 응답', {timeout: 15000}, async () => {
  await withClient('/api/parking', async client => {
    const result = await client.callTool({name: 'search_parking', arguments: {keyword: '존재하지않음'}});
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.matchedCount, 0);
  });
});
test('MCP 입력 스키마가 잘못된 인수를 거절', {timeout: 15000}, async () => {
  await withClient('/api/parking', async client => {
    for (const arguments_ of [{limit: 51}, {availableOnly: 'true'}, {unrecognized: 'field'}]) {
      const result = await client.callTool({name: 'search_parking', arguments: arguments_});
      assert.equal(result.isError, true);
    }
  });
});
test('API 실패를 검색 결과 없음으로 바꾸지 않음', {timeout: 15000}, async () => {
  await withClient('/error', async client => {
    const result = await client.callTool({name: 'search_parking', arguments: {}});
    assert.equal(result.isError, true);
    assert.equal(JSON.parse(result.content[0].text).code, 'UPSTREAM_ERROR');
  });
});
test('API의 잘못된 응답 형식 전달', {timeout: 15000}, async () => {
  await withClient('/invalid', async client => {
    const result = await client.callTool({name: 'search_parking', arguments: {}});
    assert.equal(result.isError, true);
    assert.equal(JSON.parse(result.content[0].text).code, 'INVALID_RESPONSE');
  });
});

test('MCP 검색 결과 식별자로 실제 상세 도구 호출', async () => {
  await withClient('/api/parking', async client => {
    const found=await client.callTool({name:'search_parking',arguments:{keyword:'화명'}});
    const id=found.structuredContent.items[0].id;
    const detail=await client.callTool({name:'get_parking_detail',arguments:{id}});
    assert.notEqual(detail.isError,true);
    assert.equal(detail.structuredContent.parking.id,id);
  });
});

test('MCP 지역+빈자리 교차조건과 미지원 구 이름 검증', async () => {
 await withClient('/api/parking',async client=>{
  const result=await client.callTool({name:'search_parking',arguments:{district:'북구',availableOnly:true}});
  assert.equal(result.structuredContent.returnedCount,1);
  assert.deepEqual(result.structuredContent.appliedFilters,{keyword:'',district:'북구',availableOnly:true,limit:10});
  const invalid=await client.callTool({name:'search_parking',arguments:{district:'부산'}});
  assert.equal(invalid.isError,true);
 });
});
