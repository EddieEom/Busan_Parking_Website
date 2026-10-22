// 공공 API의 모든 페이지를 수집합니다. 실패 페이지의 일부 결과는 반환하지 않습니다.
import { count } from './dataUtils.js';
const apiError=code=>Object.assign(new Error(code),{code});
function decodedKey(key) {
  try { return decodeURIComponent(key.trim()); } catch { return key.trim(); }
}
export async function fetchAll(endpoint, key, {pageSize=100,fetchImpl=globalThis.fetch,
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const items = [];
  for (let pageNo = 1; pageNo <= 30; pageNo++) {
    const url = new URL(endpoint);
    url.searchParams.set('serviceKey', decodedKey(key));
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', String(pageSize));
    url.searchParams.set('resultType', 'json');
    let data;
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});
        if(!response.ok) {
          if([408,429,500,502,503,504].includes(response.status)&&attempt<2){await response.body?.cancel();await sleep(300*(attempt+1));continue;}
          throw apiError([401,403].includes(response.status)?'API_AUTH_ERROR':'API_HTTP_ERROR');
        }
        try {data=await response.json();} catch {throw apiError('API_JSON_ERROR');}
        break;
      } catch(error) {
        if(error.code)throw error;
        if(attempt===2)throw apiError('API_CONNECTION_ERROR');
        await sleep(300*(attempt+1));
      }
    }
    const header = data?.response?.header, body = data?.response?.body;
    if (String(header?.resultCode) !== '00' || !body) throw apiError('API_RESULT_ERROR');
    const total = count(body.totalCount);
    if (total === null) throw apiError('API_COUNT_ERROR');
    const item = body.items?.item;
    const page = Array.isArray(item) ? item : item && typeof item === 'object' ? [item] : [];
    items.push(...page);
    if (items.length >= total) return items;
    if (!page.length) throw apiError('API_MISSING_PAGE');
  }
  throw apiError('API_PAGE_LIMIT');
}
