import {mapSearch} from './map-link.js';
import {formatDistance} from './geolocation.js';
const numberFormat = new Intl.NumberFormat('ko-KR');
const text = value => value == null ? '정보 없음' : String(value);
const number = value => value == null ? '미확인' : numberFormat.format(value);
const freshAvailable = p => ['available', 'full'].includes(p.status) ? p.availableSpaces : null;
function element(tag, value, className) {
  const el = document.createElement(tag);
  if (value != null) el.textContent = value;
  if (className) el.className = className;
  return el;
}
function row(label, value) {
  const el = element('div');
  el.append(element('dt', label), element('dd', text(value)));
  return el;
}
export function makeCard(p, {showRaw = true, now = Date.now(), headingLevel = 'h2'} = {}) {
  p = currentParking(p, now);
  const card = element('li', null, 'parking-item');
  card.parkingData = p;
  const heading = element('div', null, 'card-heading');
  heading.append(element(headingLevel, p.name), element('span', p.district || '지역 미확인', 'district-badge'));
  if(Number.isFinite(p.distanceKm))card.append(element('p',`현재 위치에서 ${formatDistance(p.distanceKm)} · 직선거리`,'distance-badge'));
  const spaces = freshAvailable(p);
  const availability = element('div', null, `availability ${p.status}`);
  availability.append(element('strong', spaces == null ? '확인 필요' : number(spaces)), element('span', spaces == null ? (p.status === 'stale' ? '갱신 지연' : '') : '대 주차 가능'));
  card.append(heading, availability, element('p', `전체 ${number(p.totalSpaces)}면 · 주차 중 ${number(p.occupiedSpaces)}대`, 'capacity'));
  const details = element('dl', null, 'details');
  const fee = p.baseFee != null && p.baseMinutes > 0 ? `${p.baseMinutes}분 ${number(p.baseFee)}원` : '정보 없음 · 운영기관 확인';
  details.append(row('주소(공공데이터 기준)', p.address),row('기본요금', fee),row('평일', p.weekdayHours),row('토요일', p.saturdayHours),row('공휴일', p.holidayHours),row('관리기관', p.agency),row('전화',p.phone),row('기준일',p.referenceDate));
  if(p.additionalMinutes>0&&p.additionalFee!=null)details.append(row('추가요금',`${p.additionalMinutes}분 ${number(p.additionalFee)}원`));
  if(p.dailyFee!=null)details.append(row('1일 요금(공공데이터)',`${number(p.dailyFee)}원`));
  if(p.monthlyFee!=null)details.append(row('월 정기요금(공공데이터)',`${number(p.monthlyFee)}원`));
  if(p.parkingType)details.append(row('주차장 형태',p.parkingType));
  card.append(details,element('p', p.realtimeSupported ? `현황 갱신: ${text(p.updatedAt)}` : '실시간 현황 미제공 · 기본정보만 제공', 'updated'));
  if (p.realtimeSupported && !p.basicMatched) card.append(element('p',p.matchMethod === 'ambiguous' ? '이름이 중복되어 기본정보 연결을 보류했습니다.' : '기본정보와 매칭되지 않아 주소·요금이 없습니다.','match-note'));
  const raw = element('details');
  raw.append(element('summary','상세정보 · 원본 데이터'), element('pre',JSON.stringify(p.raw,null,2)));
  card.append(element('p','주소는 공공데이터 기준이며 실제 위치와 다를 수 있습니다. 지도에서 위치를 확인하세요.','address-note'));
  const target=mapSearch(p);
  const map=element('a',target.usesAddress?'카카오맵에서 위치 확인':'주소 없음 · 이름으로 위치 검색','map-link');
  map.href=target.url;
  map.target='_blank';map.rel='noopener noreferrer';
  card.append(map);
  if (showRaw && p.raw) card.append(raw);
  return card;
}
function currentParking(p, now) {
  if (!['available', 'full'].includes(p.status)) return p;
  const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(p.updatedAt || '')
    ? Date.parse(p.updatedAt.replace(' ', 'T') + '+09:00') : NaN;
  return Number.isFinite(timestamp) && now - timestamp <= 600000 && timestamp - now <= 60000
    ? p : {...p, status:'stale'};
}
