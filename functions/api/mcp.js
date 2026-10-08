import {handleMcpRequest} from '../../mcp-server/httpHandler.js';
import {onRequestGet as getParking} from './parking.js';

export function onRequest(context) {
  return handleMcpRequest(context.request, {
    // 기존 통합 API 함수를 직접 재사용합니다. 공공데이터 인증키도 동일합니다.
    fetchImpl: () => getParking(context),
    token: context.env.MCP_AUTH_TOKEN?.trim()
  });
}
