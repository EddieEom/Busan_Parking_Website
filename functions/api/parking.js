// V2: API 호출과 데이터 처리는 lib 모듈에 맡기고 전체 흐름을 관리합니다.
import { fetchParkingList } from '../../lib/fetchParkingList.js';
import { fetchRealtime } from '../../lib/fetchRealtime.js';
import { loadBasicInfo } from '../../lib/basicInfoCache.js';
import { parkingCoordinates } from '../../geolocation.js';
import { mergeParkingData } from '../../lib/mergeParkingData.js';
import { clean } from '../../lib/dataUtils.js';

const json = (body, status = 200) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});
export async function onRequestGet(context, dependencies={}) {
  const key = clean(context.env.DATA_API_KEY);
  if (!key) return json({message:'DATA_API_KEY가 설정되지 않았습니다.'},503);
  try {
    const results = await Promise.allSettled([
      (dependencies.fetchList||fetchParkingList)(key), (dependencies.fetchRealtime||fetchRealtime)(key),
      (dependencies.loadBasic||loadBasicInfo)(context,clean(context.env.BASIC_API_KEY) || key)
    ]);
    const rows = results.map((r,i) => r.status === 'fulfilled' ? (i===2?r.value.items:r.value) : []);
    const basic=results[2].status==='fulfilled'?results[2].value:null;
    if (results.every(r => r.status === 'rejected')) return json({message:'공공데이터를 불러오지 못했습니다. 인증키·활용승인·호출 한도를 확인해 주세요.'},502);
    const labels = ['주차장 목록','실시간 주차현황','부산시 기본정보'];
    const warnings = results.flatMap((r,i) => r.status === 'rejected' ? [`${labels[i]} API 조회 실패: 해당 정보는 표시되지 않습니다.`] : []);
    if(basic?.stale)warnings.push(`기본정보 API 연결이 원활하지 않아 ${basic.fetchedAt}에 받은 좌표·주소·요금 저장본을 사용합니다. 실시간 주차현황은 별도로 조회합니다.`);
    if(!basic)warnings.push('GPS 좌표·주소·요금을 확인하려면 최신정보 새로고침으로 다시 시도해 주세요. 계속 실패하면 기본정보 API 활용승인·인증키를 확인해야 합니다.');
    const items = mergeParkingData(...rows);
    return json({
      success:true, sources:{basic:{status:basic?'available':'unavailable',source:basic?.source||null,fetchedAt:basic?.fetchedAt||null,stale:basic?.stale||false}},
      message:`주차장 ${items.length}곳을 조회했습니다.`, fetchedAt:new Date().toISOString(), warnings,
      stats:{listCount:rows[0].length,realtimeCount:rows[1].length,basicCount:rows[2].length,matchedCount:items.filter(p => p.basicMatched).length,coordinateCount:items.filter(p=>parkingCoordinates(p)).length},
      totalCount:items.length, items
    });
  } catch { return json({message:'데이터 처리 중 오류가 발생했습니다. 잠시 후 다시 조회해 주세요.'},502); }
}
