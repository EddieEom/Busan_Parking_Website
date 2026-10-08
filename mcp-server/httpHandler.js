import {createMcpHandler, originValidationResponse} from '@modelcontextprotocol/server';
import {createServer} from './createServer.js';
import {createParkingService} from '../services/parkingService.js';

// 요청마다 새 서버를 만드는 stateless HTTP 방식. Cloudflare에서도 동작합니다.
export async function handleMcpRequest(request, {fetchImpl, token} = {}) {
  const rejected = originValidationResponse(request, [new URL(request.url).origin]);
  if (rejected) return rejected;
  if (token && request.headers.get('Authorization') !== `Bearer ${token}`) {
    return new Response('Unauthorized', {status: 401});
  }
  const service = createParkingService({
    apiUrl: new URL('/api/parking', request.url).href, fetchImpl
  });
  const handler = createMcpHandler(() => createServer({service}));
  const response = await handler.fetch(request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {status: response.status, headers});
}
