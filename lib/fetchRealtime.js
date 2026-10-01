// 시설공단 실시간 주차현황 API 담당
import { fetchAll } from './fetchAll.js';

const ENDPOINT = 'https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingInfoList_v2';

export function fetchRealtime(apiKey) {
  return fetchAll(ENDPOINT, apiKey);
}
