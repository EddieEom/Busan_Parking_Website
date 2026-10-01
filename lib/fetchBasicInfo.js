// 부산시 주차장 기본정보 API 담당
import { fetchAll } from './fetchAll.js';

const ENDPOINT = 'https://apis.data.go.kr/6260000/BusanPblcPrkngInfoService/getPblcPrkngInfo';

export function fetchBasicInfo(apiKey) {
  return fetchAll(ENDPOINT, apiKey);
}
