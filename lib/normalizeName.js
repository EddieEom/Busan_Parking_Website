// 기관별 주차장명 표기 차이를 정리합니다. 번호와 방향은 보존합니다.
export const normalizeName = value => String(value || '').normalize('NFKC').replace(/도시철도|공영주차장|공영|주차장/g, '').replace(/[\s(),·（）]/g, '').toLowerCase();
