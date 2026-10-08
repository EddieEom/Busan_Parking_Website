import {Client, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';

const client = new Client({name: 'parking-http-check', version: '1.0.0'});
try {
  const url = process.argv[2] ?? process.env.MCP_SERVER_URL ?? 'http://localhost:8788/api/mcp';
  const token = process.env.MCP_AUTH_TOKEN;
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    ...(token ? {requestInit: {headers: {Authorization: `Bearer ${token}`}}} : {})
  });
  await client.connect(transport);
  console.log('사용 가능한 도구:', (await client.listTools()).tools.map(tool => tool.name).join(', '));
  const result = await client.callTool({name: 'search_parking', arguments: {keyword: process.argv[3] ?? '화명'}},
    undefined, {timeout: 130000});
  console.log(JSON.stringify(result, null, 2));
  if (result.isError) process.exitCode = 1;
} catch (error) {
  const token = process.env.MCP_AUTH_TOKEN;
  const message = token ? String(error.message).replaceAll(token, '[redacted]') : error.message;
  console.error('HTTP MCP 연결 또는 호출 실패:', message);
  process.exitCode = 1;
} finally {await client.close();}
