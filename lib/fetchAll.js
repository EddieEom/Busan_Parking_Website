// 모든 페이지를 수집하는 공통 API 호출 함수입니다.
import { count } from './dataUtils.js';

function decodedKey(key) {
  try { return decodeURIComponent(key.trim()); } catch { return key.trim(); }
}
export async function fetchAll(endpoint, key) {
  const items = [];
  for (let pageNo = 1; pageNo <= 30; pageNo++) {
    const url = new URL(endpoint);
    url.searchParams.set('serviceKey', decodedKey(key));
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', '100');
    url.searchParams.set('resultType', 'json');
    const response = await fetch(url, {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('API_HTTP_ERROR');
    const data = await response.json();
    const header = data.response?.header, body = data.response?.body;
    if (String(header?.resultCode) !== '00' || !body) throw new Error('API_RESULT_ERROR');
    const total = count(body.totalCount);
    if (total === null) throw new Error('API_COUNT_ERROR');
    const item = body.items?.item;
    const page = Array.isArray(item) ? item : item && typeof item === 'object' ? [item] : [];
    items.push(...page);
    if (items.length >= total) return items;
    if (!page.length) throw new Error('API_MISSING_PAGE');
  }
  throw new Error('API_PAGE_LIMIT');
}
