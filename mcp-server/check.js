import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';

const client = new Client({name: 'busan-parking-check', version: '1.0.0'});
const transport = new StdioClientTransport({command: process.execPath,
  args: [fileURLToPath(new URL('./server.js', import.meta.url))],
  env: {...process.env}, stderr: 'inherit'});
try {
  await client.connect(transport);
  const {tools} = await client.listTools();
  console.log('사용 가능한 도구:', tools.map(tool => tool.name).join(', '));
  const result = await client.callTool({name: 'search_parking', arguments: {keyword: process.argv[2] ?? '화명'}},
    undefined, {timeout: 130000});
  console.log(JSON.stringify(result, null, 2));
  if (result.isError) process.exitCode = 1;
} catch (error) {
  console.error('MCP 연결 또는 호출 실패:', error.message);
  process.exitCode = 1;
} finally {await client.close(); await transport.close();}
