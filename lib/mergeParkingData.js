// 코드로 실시간 현황을 연결하고, 기본정보를 안전하게 매칭합니다.
import { clean, count, hours } from './dataUtils.js';
import { normalizeName } from './normalizeName.js';

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
export function mergeParkingData(list, realtime, basics, now = Date.now()) {
  const byCode = new Map(list.filter(p => clean(p.parkgcd)).map(p => [String(p.parkgcd), p]));
  const realtimeMap = new Map(realtime.filter(p => clean(p.parkgcd)).map(p => [String(p.parkgcd), p]));
  for (const [code, p] of realtimeMap) if (!byCode.has(code)) byCode.set(code, {parkgcd:code,parknm:p.parknm});
  const names = new Map();
  for (const p of byCode.values()) {
    const key = normalizeName(p.parknm); names.set(key, (names.get(key) || 0) + 1);
  }
  const basicNames = new Map();
  basics.forEach((p, index) => {
    const key = normalizeName(p.pkNam);
    if (key) basicNames.set(key, [...(basicNames.get(key) || []), index]);
  });
  const used = new Set(), items = [];
  for (const [code, p] of byCode) {
    const key = normalizeName(p.parknm), candidates = basicNames.get(key) || [];
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
