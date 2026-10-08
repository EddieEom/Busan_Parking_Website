import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createServer} from './createServer.js';

// stdout은 MCP 통신에 사용합니다. 일반 로그는 stderr로만 출력합니다.
void serveStdio(() => createServer());
console.error('Busan parking MCP server: stdio');
