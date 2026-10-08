import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const inspectorPackage = require.resolve('@modelcontextprotocol/inspector/package.json');
const inspector = resolve(dirname(inspectorPackage), JSON.parse(readFileSync(inspectorPackage, 'utf8')).bin['mcp-inspector']);
const server = fileURLToPath(new URL('../server.js', import.meta.url));

test('Inspector CLI로 도구 목록과 정상·빈 결과·오류 응답 검증', {timeout: 20000}, async () => {
  const api = createServer((request, response) => {
    if (request.url === '/error') {response.writeHead(502); response.end('failed'); return;}
    const updatedAt = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({fetchedAt: new Date().toISOString(), warnings: [], items: [
      {id: 'realtime:1', name: '화명', district: '북구', totalSpaces: 100, availableSpaces: 5,
        status: 'available', realtimeSupported: true, updatedAt}
    ]}));
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${api.address().port}`;
  async function inspect(path, args) {
    const {stdout} = await run(process.execPath, [inspector, '--cli', process.execPath, server,
      '-e', `PARKING_API_URL=${url}${path}`, '--format', 'json', '--stored-auth-only', ...args], {timeout: 8000});
    return JSON.parse(stdout).result;
  }
  try {
    const listing = await inspect('/api/parking', ['--method', 'tools/list', '--strict']);
    assert.deepEqual(listing.tools.map(t => t.name), ['search_parking']);
    const call = ['--method', 'tools/call', '--tool-name', 'search_parking'];
    const success = await inspect('/api/parking', [...call, '--tool-args-json', '{"keyword":"화명"}']);
    assert.equal(success.structuredContent.matchedCount, 1);
    const empty = await inspect('/api/parking', [...call, '--tool-args-json', '{"keyword":"없는주차장"}']);
    assert.equal(empty.structuredContent.matchedCount, 0);
    // Inspector는 isError 응답에 비정상 종료 코드를 사용합니다.
    await assert.rejects(inspect('/error', call), error => {
      const result = JSON.parse(error.stdout).result;
      return result.isError === true && JSON.parse(result.content[0].text).code === 'UPSTREAM_ERROR';
    });
  } finally {await new Promise(resolve => api.close(resolve));}
});
