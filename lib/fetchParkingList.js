// 시설공단 주차장 목록 API 담당
import { fetchAll } from './fetchAll.js';

const ENDPOINT = 'https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingList_v2';

export function fetchParkingList(apiKey) {
  return fetchAll(ENDPOINT, apiKey);
}
