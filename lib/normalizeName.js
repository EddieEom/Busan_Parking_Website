// 기관별 주차장명 표기 차이를 정리합니다. 번호와 방향은 보존합니다.
export const normalizeName = value => String(value || '').normalize('NFKC').replace(/도시철도|공영주차장|공영|주차장/g, '').replace(/[\s(),·（）]/g, '').toLowerCase();

// V1 조사 문서에서 동일 장소로 확인한 표기만 연결합니다.
// 다른 미매칭 항목은 실제 기본정보 대상이 확인될 때까지 추가하지 않습니다.
const ALIASES = new Map([[normalizeName('화명역'), normalizeName('화명 공영주차장')]]);
export const parkingMatchName = value => ALIASES.get(normalizeName(value)) ?? normalizeName(value);

// 참고 구현 appsunggon/new-busan-parking(359665b)의 코드별 별칭.
// 이름 일치 후보가 없을 때만 사용하며, 중복 후보는 merge 단계에서 보류합니다.
export const CODE_ALIASES = new Map([
  ['A11','부산기계공고 공영주차장'],['A21','화명 공영주차장'],
  ['A37','롯데광복점 뒤 2번'],['A48','대연고가도로 밑'],['A434','만덕2동사 앞']
]);
