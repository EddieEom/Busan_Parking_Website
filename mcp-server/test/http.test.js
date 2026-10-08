import test from 'node:test';
import assert from 'node:assert/strict';
import {Client, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {handleMcpRequest} from '../httpHandler.js';
import {onRequest} from '../../functions/api/mcp.js';

async function connect(fetchParking) {
  const client = new Client({name: 'http-test', version: '1.0.0'});
  const transport = new StreamableHTTPClientTransport(new URL('https://parking.example/api/mcp'), {
    fetch: (url, init) => handleMcpRequest(new Request(url, init), {fetchImpl: fetchParking})
  });
  await client.connect(transport);
  return client;
}
test('stateless HTTP로 연결·도구 목록·호출', async () => {
  let count = 0;
  const client = await connect(async () => {
    count++;
    return Response.json({fetchedAt: new Date().toISOString(), items: [{
      id: 'basic:1', name: '화명', realtimeSupported: false, status: 'unknown'
    }], warnings: []});
  });
  try {
    assert.deepEqual((await client.listTools()).tools.map(t => t.name), ['search_parking']);
    assert.equal(count, 0);
    const result = await client.callTool({name: 'search_parking', arguments: {keyword: '화명'}});
    assert.equal(result.structuredContent.matchedCount, 1);
    assert.equal(count, 1);
  } finally {await client.close();}
});
test('HTTP 응답 캐시 차단 및 외부 Origin 거절', async () => {
  const invalid = await handleMcpRequest(new Request('https://parking.example/api/mcp', {
    method: 'POST', headers: {Origin: 'https://unexpected.example'}
  }));
  assert.equal(invalid.status, 403);
  const response = await handleMcpRequest(new Request('https://parking.example/api/mcp', {
    method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}})
  }));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.status, 200);
});
test('선택적 MCP 토큰이 설정된 경우 요청 검증', async () => {
  const request = new Request('https://parking.example/api/mcp');
  assert.equal((await handleMcpRequest(request, {token: 'fixture-token'})).status, 401);
});
test('Pages 어댑터가 기존 API의 인증키 미설정 오류를 전달', async () => {
  const client = new Client({name: 'pages-test', version: '1.0.0'});
  const transport = new StreamableHTTPClientTransport(new URL('https://parking.example/api/mcp'), {
    fetch: (url, init) => onRequest({request: new Request(url, init), env: {}})
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({name: 'search_parking', arguments: {}});
    assert.equal(result.isError, true);
    assert.equal(JSON.parse(result.content[0].text).code, 'UPSTREAM_ERROR');
  } finally {await client.close();}
});
