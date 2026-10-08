import {McpServer} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {createParkingService, ParkingServiceError, DISTRICTS} from '../services/parkingService.js';

export function createServer({apiUrl, service} = {}) {
  const parking = service ?? createParkingService({apiUrl});
  const server = new McpServer({name: 'busan-parking', version: '0.1.0'});
  server.registerTool('search_parking', {
    title: '부산 공영주차장 검색',
    description: '부산 공영주차장을 이름, 주소, 구·군으로 검색합니다. 잔여 면수와 갱신 시각을 함께 확인하세요. 위치 거리순 검색은 지원하지 않습니다. 응답의 주소와 운영 정보는 공공데이터 기준입니다.',
    inputSchema: z.object({
      keyword: z.string().max(100).default('').describe('검색어. 예: 화명, 부산대역, 화명동'),
      district: z.enum(['', ...DISTRICTS]).default('').describe('정확한 구·군 이름. 예: 북구, 해운대구. 생략하면 전체'),
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
  server.registerTool('get_parking_detail', {
    title: '주차장 상세조회',
    description: 'search_parking 결과의 id로 주차장 하나의 최신 현황·요금·요일별 운영시간·지도 링크를 조회합니다. id를 추측하지 마세요.',
    inputSchema: z.object({id: z.string().min(1).max(2000)}).strict(),
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true}
  }, async options => {
    try {
      const result = await parking.getParkingDetail(options);
      return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result};
    } catch (error) {
      const result = error instanceof ParkingServiceError ? {code: error.code, message: error.message}
        : {code: 'INTERNAL_ERROR', message: '상세 조회 중 오류가 발생했습니다.'};
      return {isError: true, content: [{type: 'text', text: JSON.stringify(result)}]};
    }
  });
  server.registerTool('compare_parkings', {
    title: '주차장 비교',
    description: '검색으로 얻은 서로 다른 id 2~5개의 최신 현황과 요금·운영시간을 같은 시점에 비교합니다. available은 빈자리 내림차순, fee는 시간당 환산요금 오름차순입니다. 거리나 현재 영업 여부를 보장하지 않습니다.',
    inputSchema: z.object({ids: z.array(z.string().min(1).max(2000)).min(2).max(5),
      sortBy: z.enum(['available','fee']).default('available')}).strict(),
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true}
  }, async options => {
    try {
      const result = await parking.compareParkings(options);
      return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result};
    } catch (error) {
      const result = error instanceof ParkingServiceError ? {code: error.code, message: error.message}
        : {code: 'INTERNAL_ERROR', message: '비교 중 오류가 발생했습니다.'};
      return {isError: true, content: [{type: 'text', text: JSON.stringify(result)}]};
    }
  });
  return server;
}
