import {filterParkings} from './parkingService.js';
import {validateIntent} from './parkingIntent.js';
const normalize=value=>String(value).normalize('NFKC').replace(/공영주차장|주차장|주차|[\s(),·（）\[\]]/g,'').toLowerCase();
export function searchByIntent(items, value, now=Date.now()) {
  const plan=validateIntent(value);
  if(plan.intent==='clarify')return {answer:plan.clarification||'지역이나 주차장 이름과 원하는 조건을 입력해 주세요.',parkings:[],matchedCount:0,requiresSelection:false,plan};
  const keyword=plan.intent==='get_parking_detail'?plan.name:plan.keyword;
  // 필터→정렬→개수 제한 순서. limit 적용 후 필터링하면 유효한 결과가 사라집니다.
  // 서비스의 최대 50개 제한 전에 전체 API 항목을 검사합니다.
  let matches=items.flatMap(item=>filterParkings([item],{limit:1},now).items);
  const term=normalize(keyword);
  const rank=p=>!term?0:normalize(p.name)===term?0:normalize(p.name).startsWith(term)?1:
    normalize(p.name).includes(term)?2:[p.address,p.district].some(x=>normalize(x||'').includes(term))?3:Infinity;
  matches=matches.filter(p=>Number.isFinite(rank(p)));
  if(plan.intent==='get_parking_detail') {
    const exact=matches.filter(p=>normalize(p.name)===term);
    if(exact.length)matches=exact;
  }
  if(plan.minAvailable>0)matches=matches.filter(p=>p.availableSpaces!==null && p.availableSpaces>=plan.minAvailable);
  matches.sort((a,b)=>{
    if(plan.sort==='available_desc' && a.availableSpaces!==b.availableSpaces) {
      if(a.availableSpaces===null)return 1;if(b.availableSpaces===null)return -1;
      return b.availableSpaces-a.availableSpaces;
    }
    return rank(a)-rank(b)||a.name.localeCompare(b.name,'ko');
  });
  const requiresSelection=plan.intent==='get_parking_detail' && matches.length>1;
  const parkings=matches.slice(0,plan.limit);
  const condition=[keyword?`“${keyword}” 검색`: '부산 전체 검색',plan.minAvailable?`빈자리 ${plan.minAvailable}대 이상`:'',plan.sort==='available_desc'?'빈자리 많은 순':''].filter(Boolean).join(' · ');
  return {answer:!matches.length?'조건에 맞는 주차장이 없습니다. 이름이나 빈자리 조건을 변경해 주세요.':requiresSelection?
    '여러 주차장이 검색되었습니다. 후보의 이름과 지역을 확인한 뒤 정확한 이름으로 다시 질문해 주세요.':
    `${condition}: ${matches.length}곳 중 ${parkings.length}곳을 표시합니다. 수치와 요금은 아래 공공데이터 카드에서 확인하세요.`,
    parkings,matchedCount:matches.length,requiresSelection,plan};
}
