import {makeCard} from './parking-card.js';
import {getCurrentLocation, nearbyParkings, locationError, parkingCoordinates, formatDistance} from './geolocation.js';
const $ = id => document.getElementById(id);
const controls = ['search', 'district', 'status', 'sort', 'reset-button', 'search-button', 'sort-default-button', 'sort-available-button'];
const numberFormat = new Intl.NumberFormat('ko-KR');
let parkings = [];
let basicUnavailable=false;
let loading = false;
let loadTask=null, currentLocation=null, locationRequest=0, locating=false;
// 공백·괄호·쉼표를 생략해도 같은 이름을 찾을 수 있습니다.
const normalize = value => String(value || '').normalize('NFKC').replace(/[\s(),·（）\[\]]/g, '').toLowerCase();
const number = value => value == null ? '미확인' : numberFormat.format(value);
const freshAvailable = p => ['available', 'full'].includes(p.status) ? p.availableSpaces : null;
const hourlyFee = p => p.baseMinutes > 0 && p.baseFee != null ? p.baseFee / p.baseMinutes * 60 : null;
function element(tag, value) {
  const el = document.createElement(tag);
  if (value != null) el.textContent = value;
  return el;
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
  if ([p.address, p.roadAddress, p.lotAddress, p.agency, p.parkgcd].some(value => normalize(value).includes(term))) return 3;
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
    if (!order && currentLocation && filters.sort === 'name') order = a.distanceKm-b.distanceKm;
    return order || searchRank(a,term) - searchRank(b,term) || a.name.localeCompare(b.name,'ko');
  });
  return result;
}
function render() {
  $('sort-default-button').textContent=currentLocation?'가까운 순':'기본순';
  $('sort-default-button').setAttribute('aria-pressed',String($('sort').value==='name'));
  $('sort-available-button').setAttribute('aria-pressed',String($('sort').value==='available'));
  const nearby=currentLocation?nearbyParkings(parkings,currentLocation):null;
  const results = filterAndSort(nearby||parkings, {search:$('search').value,district:$('district').value,status:$('status').value,sort:$('sort').value});
  const fragment = document.createDocumentFragment();
  for (const p of results) fragment.append(makeCard(p));
  $('parking-list').replaceChildren(fragment);
  $('result').textContent = currentLocation?`현재 위치 주변 ${number(results.length)}곳 · 직선거리 기준`: `전체 ${number(parkings.length)}곳 중 ${number(results.length)}곳 표시`;
  if(currentLocation) {
    $('location-status').textContent=!nearby.length?(basicUnavailable?'기본정보 API 연결이 원활하지 않아 좌표를 확인하지 못했습니다. 좌표 정보를 다시 불러와 주세요.':'위치 기반 검색에 사용할 주차장 좌표가 없습니다. 좌표 정보를 다시 불러와 주세요.'):
      (nearby[0].distanceKm>50?'현재 위치가 부산 데이터 범위와 멉니다. 가장 가까운 5곳을 표시합니다. ':'')+`가장 가까운 곳 ${formatDistance(nearby[0].distanceKm)}. 직선거리이며 실제 이동거리·시간과 다릅니다. 카카오맵에서 위치를 확인하세요.`;
  }
  $('location-retry').hidden=!(currentLocation&&!nearby.length);
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
    basicUnavailable=data.sources?.basic?.status==='unavailable';
    updateDistricts();
    const stats = data.stats;
    const summary = stats ? `목록 ${stats.listCount}건 · 현황 ${stats.realtimeCount}건 · 기본정보 ${stats.basicCount}건 · 연결 ${stats.matchedCount}건` : '';
    $('fetched-at').textContent = `조회 ${new Date(data.fetchedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})}`;
    $('fetched-at').title = summary;
    $('data-status').textContent=summary?`${summary} · GPS 좌표 ${parkings.filter(p=>parkingCoordinates(p)).length}곳`:'';
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
function refresh(){if(loading)return loadTask;loadTask=load();return loadTask;}
$('load-button').addEventListener('click',refresh);
function leaveNearby(){currentLocation=null;locationRequest++;$('location-status').textContent='';$('location-retry').hidden=true;}
$('search').addEventListener('input',()=>{leaveNearby();render();});
$('search-button').addEventListener('click',()=>{leaveNearby();render();});
$('search').addEventListener('keydown',event=>{if(event.key==='Enter'){leaveNearby();render();}});
for(const [button,sort] of [['sort-default-button','name'],['sort-available-button','available']]) {
  $(button).addEventListener('click',()=>{$('sort').value=sort;render();});
}
$('location-retry').addEventListener('click',refresh);
for (const id of ['district','status','sort']) $(id).addEventListener('change',render);
$('reset-button').addEventListener('click',()=>{
  leaveNearby();$('search').value = ''; $('district').value = ''; $('status').value = ''; $('sort').value = 'name';render();
});
export async function requestNearby({sort='name'}={}) {
  if(locating)return;
  locating=true;const request=++locationRequest;
  $('gps-button').disabled=true;$('gps-button').setAttribute('aria-busy','true');
  $('location-status').textContent='현재 위치를 확인하고 있습니다...';
  try {
    const position=await getCurrentLocation();
    if(loading)await loadTask;else if(!parkings.length)await refresh();
    if(!parkings.some(p=>parkingCoordinates(p))) {
      $('location-status').textContent='주차장 좌표 정보를 다시 불러오고 있습니다...';
      await refresh();
    }
    if(request!==locationRequest)return {success:false,cancelled:true};
    currentLocation=position;
    $('search').value='';$('district').value='';$('status').value='';$('sort').value=sort;
    render();
    return {success:nearbyParkings(parkings,currentLocation).length>0,message:$('location-status').textContent};
  } catch(error) {if(request===locationRequest)$('location-status').textContent=locationError(error);return {success:false,message:locationError(error)};}
  finally{locating=false;$('gps-button').disabled=false;$('gps-button').setAttribute('aria-busy','false');}
}
$('gps-button').addEventListener('click',()=>requestNearby());
refresh();
// 필터 조작 없이 화면을 열어둔 경우에도 지연된 빈자리를 다시 표시합니다.
setInterval(() => {if (!loading && parkings.length) render();}, 60000);
