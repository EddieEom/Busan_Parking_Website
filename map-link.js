// 목록 카드와 AI/MCP가 동일한 주소로 지도 검색을 엽니다.
const clean=value=>typeof value==='string'&&value.trim()&&value.trim()!=='-'?value.trim():null;
const region=/^(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주|충북|충남|전북|전남|경북|경남|대한민국)/;
export function mapSearch(parking) {
  const basic=parking.raw?.basic;
  const address=[parking.roadAddress,basic?.doroAddr,parking.lotAddress,basic?.jibunAddr,parking.address].map(clean).find(Boolean);
  // 도로명 뒤 괄호의 동·건물명은 주소 보충 설명이므로 지도 검색에서는 제외합니다.
  const street=address?.replace(/\s*\([^()]*\)\s*$/,'').trim();
  const query=street?(region.test(street)?street:`부산광역시 ${street}`):`부산 ${clean(parking.name)||'주차장'}`;
  return {query,usesAddress:!!street,url:'https://map.kakao.com/link/search/'+encodeURIComponent(query)};
}
