const $ = id => document.getElementById(id);
const controls = ['search', 'district', 'status', 'sort', 'reset-button'];
const numberFormat = new Intl.NumberFormat('ko-KR');
let parkings = [];
let loading = false;
const normalize = value => String(value || '').normalize('NFKC').replace(/\s/g, '').toLowerCase();
const text = value => value == null ? '정보 없음' : String(value);
const number = value => value == null ? '미확인' : numberFormat.format(value);
const freshAvailable = p => ['available', 'full'].includes(p.status) ? p.availableSpaces : null;
const hourlyFee = p => p.baseMinutes > 0 && p.baseFee > 0 ? p.baseFee / p.baseMinutes * 60 : null;
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
  const fee = p.baseFee > 0 && p.baseMinutes > 0 ? `${p.baseMinutes}분 ${number(p.baseFee)}원` : '정보 없음 · 운영기관 확인';
  details.append(row('주소', p.address),row('기본요금', fee),row('평일', p.weekdayHours),row('토요일', p.saturdayHours),row('공휴일', p.holidayHours),row('관리기관', p.agency),row('전화',p.phone),row('기준일',p.referenceDate));
  card.append(details,element('p', p.realtimeSupported ? `현황 갱신: ${text(p.updatedAt)}` : '실시간 현황 미제공 · 기본정보만 제공', 'updated'));
  if (p.realtimeSupported && !p.basicMatched) card.append(element('p',p.matchMethod === 'ambiguous' ? '이름이 중복되어 기본정보 연결을 보류했습니다.' : '기본정보와 매칭되지 않아 주소·요금이 없습니다.','match-note'));
  const raw = element('details');
  raw.append(element('summary','상세정보 · 원본 데이터'), element('pre',JSON.stringify(p.raw,null,2)));
  card.append(raw);
  return card;
}
function compareNullable(a, b, descending = false) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return descending ? b - a : a - b;
}
function filterAndSort(items, filters) {
  const term = normalize(filters.search);
  const result = items.filter(p => {
    if (term && !normalize(`${p.name} ${p.address || ''} ${p.parkgcd || ''}`).includes(term)) return false;
    if (filters.district === 'unknown' && p.district) return false;
    if (filters.district && filters.district !== 'unknown' && p.district !== filters.district) return false;
    if (filters.status === 'supported') return p.realtimeSupported;
    if (filters.status === 'unknown') return ['unknown','stale'].includes(p.status);
    return !filters.status || p.status === filters.status;
  });
  result.sort((a,b) => {
    let order = 0;
    if (filters.sort === 'available') order = compareNullable(freshAvailable(a),freshAvailable(b),true);
    if (filters.sort === 'fee') order = compareNullable(hourlyFee(a),hourlyFee(b));
    return order || a.name.localeCompare(b.name,'ko');
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
  for (const [value,label] of options) {
    const option = element('option',label); option.value = value; $('district').append(option);
  }
  $('district').value = options.some(([value])=>value === previous) ? previous : '';
}
async function load() {
  if (loading) return;
  loading = true; $('load-button').disabled = true;
  controls.forEach(id => $(id).disabled = true);
  $('parking-list').setAttribute('aria-busy','true');
  $('result').textContent = '전체 주차정보를 불러오는 중입니다.';
  $('empty').hidden = true; $('warning').hidden = true;
  try {
    const response = await fetch('/api/parking', {cache:'no-store',signal:AbortSignal.timeout(120000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '주차정보 조회 실패');
    if (!Array.isArray(data.items)) throw new Error('응답 형식을 확인해 주세요. functions/api/parking.js도 함께 교체해야 합니다.');
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
    $('result').textContent = error.name === 'TimeoutError' ? '조회가 지연되고 있습니다. 잠시 후 목록 새로고침을 눌러 주세요.' : error.message;
    if (parkings.length) {
      $('warning').textContent = '새 조회에 실패했습니다. 이전에 조회한 결과를 표시하고 있습니다.';
      $('warning').hidden = false;
    }
  } finally {
    loading = false; $('load-button').disabled = false;
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
