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
  server.registerTool('find_available_parking', {
    title: '빈자리 많은 주차장 찾기',
    description: '이름·주소·구·군으로 찾은 주차장을 최신 빈자리 많은 순으로 정렬한 뒤 상위 limit개를 반환합니다. 만차 0대와 미확인 값을 구분하며 갱신 지연·미확인은 마지막에 둡니다. 실제 주차 가능한 곳만 원하면 availableOnly=true를 사용하세요. 거리순은 지원하지 않습니다.',
    inputSchema: z.object({
      keyword: z.string().max(100).default(''),
      district: z.enum(['', ...DISTRICTS]).default(''),
      availableOnly: z.boolean().default(false),
      limit: z.number().int().min(1).max(50).default(10)
    }).strict(),
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true}
  }, async options => {
    try {
      const result = await parking.findAvailableParking(options);
      return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result};
    } catch (error) {
      const result = error instanceof ParkingServiceError ? {code: error.code, message: error.message}
        : {code: 'INTERNAL_ERROR', message: '빈자리순 조회 중 오류가 발생했습니다.'};
      return {isError: true, content: [{type: 'text', text: JSON.stringify(result)}]};
    }
  });
  server.registerTool('get_parking_detail', {
    title: '주차장 상세조회',
    description: '검색 결과 id 또는 주차장 이름 name 중 하나로 최신 현황·요금·요일별 운영시간·지도 링크를 조회합니다. 이름은 정확히 일치하는 대상을 우선하고 여러 대상이면 requiresSelection과 candidates를 반환합니다. 후보를 임의로 확정하지 마세요. 이름 조회 시 district로 지역을 좁힐 수 있습니다. id를 추측하지 마세요.',
    inputSchema: z.object({id: z.string().min(1).max(2000).optional(),
      name: z.string().trim().min(1).max(100).optional(),
      district: z.enum(['', ...DISTRICTS]).optional()}).strict()
      .refine(value => (value.id !== undefined) !== (value.name !== undefined), 'id 또는 name 하나가 필요합니다.')
      .refine(value => !value.id || !value.district, 'district는 이름 조회에만 사용합니다.'),
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
