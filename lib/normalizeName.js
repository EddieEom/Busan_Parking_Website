// 기관별 주차장명 표기 차이를 정리합니다. 번호와 방향은 보존합니다.
export const normalizeName = value => String(value || '').normalize('NFKC').replace(/도시철도|공영주차장|공영|주차장/g, '').replace(/[\s(),·（）]/g, '').toLowerCase();

// V1 조사 문서에서 동일 장소로 확인한 표기만 연결합니다.
// 다른 미매칭 항목은 실제 기본정보 대상이 확인될 때까지 추가하지 않습니다.
const ALIASES = new Map([[normalizeName('화명역'), normalizeName('화명 공영주차장')]]);
export const parkingMatchName = value => ALIASES.get(normalizeName(value)) ?? normalizeName(value);
