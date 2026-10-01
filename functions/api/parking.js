// V2: API 호출과 데이터 처리는 lib 모듈에 맡기고 전체 흐름을 관리합니다.
import { fetchParkingList } from '../../lib/fetchParkingList.js';
import { fetchRealtime } from '../../lib/fetchRealtime.js';
import { fetchBasicInfo } from '../../lib/fetchBasicInfo.js';
import { mergeParkingData } from '../../lib/mergeParkingData.js';
import { clean } from '../../lib/dataUtils.js';

const json = (body, status = 200) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});
export async function onRequestGet(context) {
  const key = clean(context.env.DATA_API_KEY);
  if (!key) return json({message:'DATA_API_KEY가 설정되지 않았습니다.'},503);
  try {
    const results = await Promise.allSettled([
      fetchParkingList(key), fetchRealtime(key),
      fetchBasicInfo(clean(context.env.BASIC_API_KEY) || key)
    ]);
    const rows = results.map(r => r.status === 'fulfilled' ? r.value : []);
    if (results.every(r => r.status === 'rejected')) return json({message:'공공데이터를 불러오지 못했습니다. 인증키·활용승인·호출 한도를 확인해 주세요.'},502);
    const labels = ['주차장 목록','실시간 주차현황','부산시 기본정보'];
    const warnings = results.flatMap((r,i) => r.status === 'rejected' ? [`${labels[i]} API 조회 실패: 해당 정보는 표시되지 않습니다.`] : []);
    const items = mergeParkingData(...rows);
    return json({
      message:`주차장 ${items.length}곳을 조회했습니다.`, fetchedAt:new Date().toISOString(), warnings,
      stats:{listCount:rows[0].length,realtimeCount:rows[1].length,basicCount:rows[2].length,matchedCount:items.filter(p => p.basicMatched).length},
      totalCount:items.length, items
    });
  } catch { return json({message:'데이터 처리 중 오류가 발생했습니다. 잠시 후 다시 조회해 주세요.'},502); }
}
