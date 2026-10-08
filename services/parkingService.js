// MCP에서 사용할 공통 검색 서비스. 인증키 없이 기존 /api/parking을 호출합니다.
const normalize = value => String(value ?? '').normalize('NFKC')
  .replace(/[\s(),·（）\[\]]/g, '').toLowerCase();
const clean = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const count = value => Number.isInteger(value) && value >= 0 ? value : null;

export class ParkingServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ParkingServiceError';
    this.code = code;
  }
}

export const DISTRICTS = ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'];

function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ParkingServiceError('INVALID_INPUT', '검색 조건은 객체여야 합니다.');
  }
  const {keyword = '', district = '', availableOnly = false, limit = 10} = options;
  if (typeof keyword !== 'string' || keyword.length > 100 ||
      typeof district !== 'string' || district.length > 30 ||
      typeof availableOnly !== 'boolean' || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ParkingServiceError('INVALID_INPUT', 'keyword(100자 이내), district(30자 이내), availableOnly(boolean), limit(1~50 정수)을 확인하세요.');
  }
  if (district.trim() && !DISTRICTS.includes(district.trim())) throw new ParkingServiceError('INVALID_INPUT', '부산의 정확한 구·군 이름을 입력하세요. 예: 북구, 기장군');
  return {keyword: keyword.trim(), district: district.trim(), availableOnly, limit};
}

function rank(parking, term) {
  if (!term) return 0;
  const name = normalize(parking.name);
  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term)) return 2;
  if ([parking.address, parking.district, parking.parkgcd]
      .some(value => normalize(value).includes(term))) return 3;
  return Infinity;
}

function summarize(parking, now) {
  const totalSpaces = count(parking.totalSpaces);
  const available = count(parking.availableSpaces);
  const validCount = available !== null && (totalSpaces === null || available <= totalSpaces);
  const updatedAt = clean(parking.updatedAt);
  const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(updatedAt ?? '')
    ? Date.parse(updatedAt.replace(' ', 'T') + '+09:00') : NaN;
  const fresh = Number.isFinite(timestamp) && now - timestamp <= 600000 && timestamp - now <= 60000;
  let status = 'unknown';
  if (parking.realtimeSupported === true && ['available', 'full', 'stale'].includes(parking.status)) {
    if (!fresh || parking.status === 'stale') status = 'stale';
    else if (['available', 'full'].includes(parking.status) && validCount) {
      status = available === 0 ? 'full' : 'available';
    }
  }
  return {
    id: parkingId(parking), parkgcd: clean(parking.parkgcd), name: parking.name,
    district: clean(parking.district), address: clean(parking.address),
    totalSpaces, availableSpaces: ['available', 'full'].includes(status) ? available : null,
    status, realtimeSupported: parking.realtimeSupported === true, updatedAt,
    baseMinutes: count(parking.baseMinutes), baseFee: count(parking.baseFee),
    weekdayHours: clean(parking.weekdayHours), saturdayHours: clean(parking.saturdayHours),
    holidayHours: clean(parking.holidayHours), phone: clean(parking.phone),
    agency: clean(parking.agency), referenceDate: clean(parking.referenceDate),
    mapUrl: `https://map.kakao.com/link/search/${encodeURIComponent("부산 " + parking.name)}`
  };
}

// 네트워크 없이도 검증할 수 있는 검색 함수. 원본 items는 변경하지 않습니다.
export function filterParkings(items, options = {}, now = Date.now()) {
  const filters = validateOptions(options);
  if (!Array.isArray(items) || !items.every(p => p && typeof p === 'object' &&
      typeof p.name === 'string' && p.name.trim())) {
    throw new ParkingServiceError('INVALID_RESPONSE', '주차장 API 응답 형식이 올바르지 않습니다.');
  }
  const term = normalize(filters.keyword);
  const matched = items.map(p => summarize(p, now)).filter(p =>
    Number.isFinite(rank(p, term)) &&
    (!filters.district || normalize(p.district) === normalize(filters.district)) &&
    (!filters.availableOnly || p.status === 'available')
  ).sort((a, b) => rank(a, term) - rank(b, term) || a.name.localeCompare(b.name, 'ko'));
  return {appliedFilters: filters, matchedCount: matched.length, returnedCount: Math.min(matched.length, filters.limit),
    items: matched.slice(0, filters.limit)};
}

export function parkingId(parking) {
  const code = clean(parking.parkgcd) || (String(parking.id).startsWith('realtime:') ? String(parking.id).slice(9) : null);
  if (code) return `realtime:${code}`;
  // 기본정보의 배열 순번을 사용하지 않습니다. 주소/이름 변경 시에는 새 식별자가 됩니다.
  return 'place:' + encodeURIComponent(JSON.stringify([
    parking.name, parking.district, parking.address, parking.agency,
    parking.raw?.basic?.mgntNum
  ].map(normalize)));
}

const NOTES = [
  '잔여 면수는 제공기관 갱신 시각 기준이며 도착 시 주차 가능 여부를 보장하지 않습니다.',
  '10분을 초과하거나 갱신 시각을 확인할 수 없는 현황은 주차 가능으로 판단하지 않습니다.',
  '주소는 공공데이터 기준이며 실제 위치와 다를 수 있습니다.',
  '기본정보의 이름·주소 등이 변경되면 다시 검색하여 최신 식별자를 사용하세요.'
];
export function createParkingService({apiUrl = 'http://localhost:8788/api/parking',
  fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 120000} = {}) {
  let url;
  try {url = new URL(apiUrl);} catch {throw new ParkingServiceError('INVALID_CONFIG', '주차장 API 주소를 설정하세요.');}
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      typeof fetchImpl !== 'function' || typeof now !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new ParkingServiceError('INVALID_CONFIG', '서비스 실행 설정이 올바르지 않습니다.');
  }
  async function load() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.href, {headers: {Accept: 'application/json'}, cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new ParkingServiceError('UPSTREAM_ERROR', `주차장 API 조회에 실패했습니다. HTTP ${response.status}`);
      let data;
      try {data = await response.json();} catch {throw new ParkingServiceError('INVALID_RESPONSE', '주차장 API가 JSON을 반환하지 않았습니다.');}
      const timestamp = now();
      filterParkings(data?.items, {limit: 1}, timestamp);
      return {items: data.items, timestamp, meta: {
        fetchedAt: clean(data.fetchedAt), checkedAt: new Date(timestamp).toISOString(), totalCount: data.items.length,
        warnings: Array.isArray(data.warnings) ? data.warnings.filter(w => typeof w === 'string') : [], notes: NOTES
      }};
    } catch (error) {
      if (error instanceof ParkingServiceError) throw error;
      throw new ParkingServiceError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        controller.signal.aborted ? '주차장 API 응답 시간이 초과되었습니다.' : '주차장 API에 연결하지 못했습니다.');
    } finally {clearTimeout(timer);}
  }
  function lookup(items, id, timestamp) {
    if (typeof id !== 'string' || !id || id.length > 2000) throw new ParkingServiceError('INVALID_INPUT', '검색 결과의 id를 입력하세요.');
    const matches = items.filter(p => parkingId(p) === id);
    if (!matches.length) throw new ParkingServiceError('NOT_FOUND', '주차장을 찾을 수 없습니다. 다시 검색하세요.');
    if (matches.length > 1) throw new ParkingServiceError('AMBIGUOUS_ID', '식별자가 중복되어 주차장을 확정할 수 없습니다.');
    return summarize(matches[0], timestamp);
  }
  return {
    async searchParking(options = {}) {
      validateOptions(options);
      const {items, timestamp, meta} = await load();
      return {...meta, ...filterParkings(items, options, timestamp)};
    },
    async getParkingDetail({id} = {}) {
      if (typeof id !== 'string' || !id || id.length > 2000) throw new ParkingServiceError('INVALID_INPUT', '검색 결과의 id를 입력하세요.');
      const {items, timestamp, meta} = await load();
      return {...meta, parking: lookup(items, id, timestamp)};
    }
  };
}
