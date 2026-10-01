// V1: 모든 서버 처리를 이 파일에서 수행합니다.
const ENDPOINTS = {
  list: 'https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingList_v2',
  realtime: 'https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingInfoList_v2',
  basic: 'https://apis.data.go.kr/6260000/BusanPblcPrkngInfoService/getPblcPrkngInfo'
};
const clean = value => value == null || String(value).trim() === '-' || String(value).trim() === '' ? null : String(value).trim();
const count = value => {
  const s = clean(value);
  return s && /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null;
};
const normalize = value => String(value || '').normalize('NFKC').replace(/도시철도|공영주차장|공영|주차장/g, '').replace(/[\s(),·（）]/g, '').toLowerCase();
const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(clean(value) || '') ? clean(value) : null;
const hours = (start, end) => validTime(start) && validTime(end) ? `${validTime(start)} ~ ${validTime(end)}` : null;
function decodedKey(key) {
  try { return decodeURIComponent(key.trim()); } catch { return key.trim(); }
}
async function fetchAll(endpoint, key) {
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
function isFresh(value, now) {
  const s = clean(value);
  if (!s || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return false;
  const time = Date.parse(s.replace(' ', 'T') + '+09:00');
  // 10분 이상 지연된 데이터로 "지금 주차 가능"을 판단하지 않습니다.
  return Number.isFinite(time) && now - time <= 600000 && time - now <= 60000;
}
function district(basic) {
  const address = `${clean(basic?.doroAddr) || ''} ${clean(basic?.jibunAddr) || ''}`;
  const pattern = /(중구|서구|동구|영도구|부산진구|동래구|남구|북구|해운대구|사하구|금정구|강서구|연제구|수영구|사상구|기장군)/;
  return address.match(pattern)?.[1] || String(basic?.guNm || '').match(pattern)?.[1] || null;
}
function makeParking(id, list, realtime, basic, matchMethod, now) {
  const total = count(realtime?.maxcnt);
  const occupied = count(realtime?.parkingcnt);
  const rawAvailable = count(realtime?.curravacnt);
  const available = rawAvailable !== null && (total === null || rawAvailable <= total) ? rawAvailable : null;
  const fresh = !!realtime && isFresh(realtime.lastupdatetime, now);
  let status = 'unknown';
  if (realtime && !fresh) status = 'stale';
  else if (fresh && available !== null) status = available === 0 ? 'full' : 'available';
  return {
    id, parkgcd: clean(list?.parkgcd || realtime?.parkgcd),
    name: clean(list?.parknm || realtime?.parknm || basic?.pkNam) || '이름 없음',
    district: district(basic), address: clean(basic?.doroAddr) || clean(basic?.jibunAddr),
    totalSpaces: total ?? count(basic?.pkCnt), occupiedSpaces: occupied,
    availableSpaces: available, status, realtimeSupported: !!list || !!realtime,
    updatedAt: clean(realtime?.lastupdatetime),
    baseMinutes: count(basic?.pkBascTime), baseFee: count(basic?.tenMin),
    weekdayHours: hours(basic?.svcSrtTe, basic?.svcEndTe),
    saturdayHours: hours(basic?.satSrtTe, basic?.satEndTe),
    holidayHours: hours(basic?.hldSrtTe, basic?.hldEndTe),
    agency: clean(basic?.guNm), phone: clean(basic?.tponNum), referenceDate: clean(basic?.fnlDt),
    basicMatched: !!basic && (!!list || !!realtime), matchMethod,
    // 상세정보에서 제공기관의 원본 필드도 확인할 수 있습니다.
    raw: {list: list || null, realtime: realtime || null, basic: basic || null}
  };
}
export function mergeData(list, realtime, basics, now = Date.now()) {
  const byCode = new Map(list.filter(p => clean(p.parkgcd)).map(p => [String(p.parkgcd), p]));
  const realtimeMap = new Map(realtime.filter(p => clean(p.parkgcd)).map(p => [String(p.parkgcd), p]));
  for (const [code, p] of realtimeMap) if (!byCode.has(code)) byCode.set(code, {parkgcd:code,parknm:p.parknm});
  const names = new Map();
  for (const p of byCode.values()) {
    const key = normalize(p.parknm); names.set(key, (names.get(key) || 0) + 1);
  }
  const basicNames = new Map();
  basics.forEach((p, index) => {
    const key = normalize(p.pkNam);
    if (key) basicNames.set(key, [...(basicNames.get(key) || []), index]);
  });
  const used = new Set(), items = [];
  for (const [code, p] of byCode) {
    const key = normalize(p.parknm), candidates = basicNames.get(key) || [];
    const matched = candidates.length === 1 && names.get(key) === 1;
    const index = matched ? candidates[0] : null;
    if (matched) used.add(index);
    items.push(makeParking(`realtime:${code}`, p, realtimeMap.get(code), matched ? basics[index] : null, matched ? 'exact' : candidates.length ? 'ambiguous' : 'none', now));
  }
  // 실시간 대상과 연결되지 않은 기본정보도 모두 표시합니다.
  // mgntNum은 기관별 중복 가능성이 있으므로 단독 JOIN 키로 쓰지 않습니다.
  basics.forEach((p, index) => {
    if (!used.has(index)) items.push(makeParking(`basic:${index}`, null, null, p, 'basic-only', now));
  });
  return items;
}
const json = (body, status = 200) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});
export async function onRequestGet(context) {
  const key = clean(context.env.DATA_API_KEY);
  if (!key) return json({message:'DATA_API_KEY가 설정되지 않았습니다.'},503);
  try {
    const results = await Promise.allSettled([
      fetchAll(ENDPOINTS.list, key), fetchAll(ENDPOINTS.realtime, key),
      fetchAll(ENDPOINTS.basic, clean(context.env.BASIC_API_KEY) || key)
    ]);
    const rows = results.map(r => r.status === 'fulfilled' ? r.value : []);
    if (results.every(r => r.status === 'rejected')) return json({message:'공공데이터를 불러오지 못했습니다. 인증키·활용승인·호출 한도를 확인해 주세요.'},502);
    const labels = ['주차장 목록','실시간 주차현황','부산시 기본정보'];
    const warnings = results.flatMap((r,i) => r.status === 'rejected' ? [`${labels[i]} API 조회 실패: 해당 정보는 표시되지 않습니다.`] : []);
    const items = mergeData(...rows);
    return json({
      message:`주차장 ${items.length}곳을 조회했습니다.`, fetchedAt:new Date().toISOString(), warnings,
      stats:{listCount:rows[0].length,realtimeCount:rows[1].length,basicCount:rows[2].length,matchedCount:items.filter(p => p.basicMatched).length},
      totalCount:items.length, items
    });
  } catch { return json({message:'데이터 처리 중 오류가 발생했습니다. 잠시 후 다시 조회해 주세요.'},502); }
}
