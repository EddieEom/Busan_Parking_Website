const $ = id => document.getElementById(id);
const controls = ['search', 'district', 'status', 'sort', 'reset-button'];
const numberFormat = new Intl.NumberFormat('ko-KR');
let parkings = [];
let loading = false;
// 공백·괄호·쉼표를 생략해도 같은 이름을 찾을 수 있습니다.
const normalize = value => String(value || '').normalize('NFKC').replace(/[\s(),·（）\[\]]/g, '').toLowerCase();
const text = value => value == null ? '정보 없음' : String(value);
const number = value => value == null ? '미확인' : numberFormat.format(value);
const freshAvailable = p => ['available', 'full'].includes(p.status) ? p.availableSpaces : null;
const hourlyFee = p => p.baseMinutes > 0 && p.baseFee != null ? p.baseFee / p.baseMinutes * 60 : null;
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
function makeCard(p) {
  const card = element('li', null, 'parking-item');
  const heading = element('div', null, 'card-heading');
  heading.append(element('h2', p.name), element('span', p.district || '지역 미확인', 'district-badge'));
  const spaces = freshAvailable(p);
  const availability = element('div', null, `availability ${p.status}`);
  availability.append(element('strong', spaces == null ? '확인 필요' : number(spaces)), element('span', spaces == null ? (p.status === 'stale' ? '갱신 지연' : '') : '대 주차 가능'));
  card.append(heading, availability, element('p', `전체 ${number(p.totalSpaces)}면 · 주차 중 ${number(p.occupiedSpaces)}대`, 'capacity'));
  const details = element('dl', null, 'details');
  const fee = p.baseFee != null && p.baseMinutes > 0 ? `${p.baseMinutes}분 ${number(p.baseFee)}원` : '정보 없음 · 운영기관 확인';
  details.append(row('주소(공공데이터)', p.address),row('기본요금', fee),row('평일', p.weekdayHours),row('토요일', p.saturdayHours),row('공휴일', p.holidayHours),row('관리기관', p.agency),row('전화',p.phone),row('기준일',p.referenceDate));
  card.append(details,element('p', p.realtimeSupported ? `현황 갱신: ${text(p.updatedAt)}` : '실시간 현황 미제공 · 기본정보만 제공', 'updated'));
  if (p.realtimeSupported && !p.basicMatched) card.append(element('p',p.matchMethod === 'ambiguous' ? '이름이 중복되어 기본정보 연결을 보류했습니다.' : '기본정보와 매칭되지 않아 주소·요금이 없습니다.','match-note'));
  const raw = element('details');
  raw.append(element('summary','상세정보 · 원본 데이터'), element('pre',JSON.stringify(p.raw,null,2)));
  card.append(element('p','주소는 공공데이터 기준이며 실제 위치와 다를 수 있습니다. 지도에서 위치를 확인하세요.','address-note'));
  const map=element('a','카카오맵에서 위치 확인','map-link');
  map.href='https://map.kakao.com/link/search/'+encodeURIComponent(`부산 ${p.name}`);
  map.target='_blank';map.rel='noopener noreferrer';
  card.append(map,raw);
  return card;
}
function compareNullable(a, b, descending = false) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return descending ? b - a : a - b;
}
// 이름 완전 일치 → 앞부분 일치 → 이름 포함 → 주소/코드 일치 순서입니다.
function searchRank(p, term) {
  if (!term) return 0;
  const name = normalize(p.name);
  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term)) return 2;
  if ([p.address, p.parkgcd].some(value => normalize(value).includes(term))) return 3;
  return Infinity;
}
// 페이지를 오래 열어두거나 새 조회가 실패해도 오래된 빈자리를 추천하지 않습니다.
function currentParking(p, now) {
  if (!['available', 'full'].includes(p.status)) return p;
  const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(p.updatedAt || '')
    ? Date.parse(p.updatedAt.replace(' ', 'T') + '+09:00') : NaN;
  return Number.isFinite(timestamp) && now - timestamp <= 600000 && timestamp - now <= 60000
    ? p : {...p, status:'stale'};
}
function filterAndSort(items, filters, now = Date.now()) {
  const term = normalize(filters.search);
  const result = items.map(p => currentParking(p, now)).filter(p => {
    if (!Number.isFinite(searchRank(p, term))) return false;
    if (filters.district === 'unknown' && p.district) return false;
    if (filters.district && filters.district !== 'unknown' && p.district !== filters.district) return false;
    if (filters.status === 'supported') return p.realtimeSupported;
    if (filters.status === 'unknown') return ['unknown','stale'].includes(p.status);
    return !filters.status || p.status === filters.status;
  });
  result.sort((a,b) => {
    let order = 0;
    // 사용자가 선택한 숫자 정렬을 먼저 적용하고, 동률일 때 검색 관련도를 적용합니다.
    if (filters.sort === 'available') order = compareNullable(freshAvailable(a),freshAvailable(b),true);
    if (filters.sort === 'fee') order = compareNullable(hourlyFee(a),hourlyFee(b));
    return order || searchRank(a,term) - searchRank(b,term) || a.name.localeCompare(b.name,'ko');
  });
  return result;
}
function render() {
  const results = filterAndSort(parkings, {search:$('search').value,district:$('district').value,status:$('status').value,sort:$('sort').value});
  const fragment = document.createDocumentFragment();
  for (const p of results) fragment.append(makeCard(p));
  $('parking-list').replaceChildren(fragment);
  $('result').textContent = `전체 ${number(parkings.length)}곳 중 ${number(results.length)}곳 표시`;
  $('empty').hidden = results.length > 0;
}
function updateDistricts() {
  const previous = $('district').value;
  const districts = [...new Set(parkings.map(p => p.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  $('district').replaceChildren();
  const options = [['','전체 지역'],...districts.map(d=>[d,d]),['unknown','지역 미확인']];
  // 새 응답에 선택 지역이 없어도 전체 지역으로 바꾸지 않습니다.
  if (previous && !options.some(([value]) => value === previous)) {
    options.splice(options.length - 1, 0, [previous, `${previous} (현재 결과 없음)`]);
  }
  for (const [value,label] of options) {
    const option = element('option',label); option.value = value; $('district').append(option);
  }
  $('district').value = previous;
}
async function load() {
  if (loading) return;
  loading = true; $('load-button').disabled = true;
  $('load-button').textContent = '조회 중…';
  controls.forEach(id => $(id).disabled = true);
  $('parking-list').setAttribute('aria-busy','true');
  $('result').textContent = '전체 주차정보를 불러오는 중입니다.';
  $('empty').hidden = true; $('warning').hidden = true;
  try {
    const response = await fetch('/api/parking', {cache:'no-store',signal:AbortSignal.timeout(120000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '주차정보 조회 실패');
    if (!Array.isArray(data.items)) throw new Error('통합 API의 items 응답 형식을 확인해 주세요.');
    parkings = data.items;
    updateDistricts();
    const stats = data.stats;
    const summary = stats ? `목록 ${stats.listCount}건 · 현황 ${stats.realtimeCount}건 · 기본정보 ${stats.basicCount}건 · 연결 ${stats.matchedCount}건` : '';
    $('fetched-at').textContent = `조회 ${new Date(data.fetchedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})}`;
    $('fetched-at').title = summary;
    $('warning').textContent = (data.warnings || []).join(' ');
    $('warning').hidden = !(data.warnings || []).length;
    render();
  } catch (error) {
    const message = !navigator.onLine ? '오프라인입니다. 실시간 주차정보는 인터넷 연결 후 새로고침해 주세요.' : error.name === 'TimeoutError'
      ? '조회가 지연되고 있습니다. 잠시 후 최신정보 새로고침을 눌러 주세요.' : error.message;
    if (parkings.length) {
      render();
      $('warning').textContent = `${message} 이전 조회 결과를 표시하고 있습니다. 갱신 시각을 확인해 주세요.`;
      $('warning').hidden = false;
    } else {
      $('result').textContent = message;
    }
  } finally {
    loading = false; $('load-button').disabled = false;
    $('load-button').textContent = '최신정보 새로고침';
    controls.forEach(id => $(id).disabled = !parkings.length);
    $('parking-list').setAttribute('aria-busy','false');
  }
}
$('load-button').addEventListener('click',load);
$('search').addEventListener('input',render);
for (const id of ['district','status','sort']) $(id).addEventListener('change',render);
$('reset-button').addEventListener('click',()=>{
  $('search').value = ''; $('district').value = ''; $('status').value = ''; $('sort').value = 'name';render();
});
load();
