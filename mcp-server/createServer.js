import {McpServer} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {createParkingService, ParkingServiceError} from '../services/parkingService.js';

export function createServer({apiUrl = process.env.PARKING_API_URL, service} = {}) {
  const parking = service ?? createParkingService({apiUrl});
  const server = new McpServer({name: 'busan-parking', version: '0.1.0'});
  server.registerTool('search_parking', {
    title: '부산 공영주차장 검색',
    description: '부산 공영주차장을 이름, 주소, 구·군으로 검색합니다. 잔여 면수와 갱신 시각을 함께 확인하세요. 위치 거리순 검색은 지원하지 않습니다. 응답의 주소와 운영 정보는 공공데이터 기준입니다.',
    inputSchema: z.object({
      keyword: z.string().max(100).default('').describe('검색어. 예: 화명, 부산대역, 화명동'),
      district: z.string().max(30).default('').describe('정확한 구·군 이름. 예: 북구, 해운대구. 생략하면 전체'),
      availableOnly: z.boolean().default(false).describe('true이면 최근 10분 내 잔여 면수가 1 이상인 곳만 조회'),
      limit: z.number().int().min(1).max(50).default(10).describe('최대 반환 건수. 1~50')
    }).strict(),
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true}
  }, async (options) => {
    try {
      const result = await parking.searchParking(options);
      return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result};
    } catch (error) {
      const result = error instanceof ParkingServiceError
        ? {code: error.code, message: error.message}
        : {code: 'INTERNAL_ERROR', message: '주차장 검색 처리 중 오류가 발생했습니다.'};
      return {isError: true, content: [{type: 'text', text: JSON.stringify(result)}]};
    }
  });
  return server;
}
