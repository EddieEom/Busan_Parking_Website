import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretLocally} from '../services/parkingIntent.js';
import {searchByIntent} from '../services/intentSearch.js';
import {handleAiParking} from '../functions/api/ai-parking.js';
const timestamp=new Date(Date.now()+9*3600000).toISOString().slice(0,19).replace('T',' ');
const parking=(name,spaces,status='available')=>({name,parkgcd:name,availableSpaces:spaces,status,updatedAt:timestamp,realtimeSupported:true,totalSpaces:100});
const fixtures=[parking('화명역',5),parking('부산대역남측',11),parking('부산대역북측',20),parking('부산대옛값',99,'stale')];
test('문서의 모든 기본 회귀 문장을 AI 없이 구조화',()=>{
 for(const [question,expected] of [
  ['화명 주차장 찾아줘',{keyword:'화명',intent:'search_parking'}],
  ['화명역 주차장을 찾아줘',{keyword:'화명역',intent:'search_parking'}],
  ['부산대 쪽에서 지금 빈자리 많은 주차장 찾아줘',{keyword:'부산대',sort:'available_desc'}],
  ['화명역 주차장 요금과 운영시간 알려줘',{name:'화명역',intent:'get_parking_detail'}],
  ['빈자리 10대 이상인 곳 3개만 찾아줘',{keyword:'',minAvailable:10,limit:3}],
  ['부산대에서 제일 여유 있는 곳 알려줘',{keyword:'부산대',limit:1}],
  ['부산대에서 빈자리 10대 이상인 곳 3개만 찾아',{keyword:'부산대',minAvailable:10,limit:3}]
 ]){const plan=interpretLocally(question);assert.ok(plan,question);for(const [k,v] of Object.entries(expected))assert.equal(plan[k],v,question+' '+k);}
});
test('최소 빈자리→정렬→limit, 지연 제외, 상위 50개 밖에서도 조회',()=>{
 const items=Array.from({length:70},(_,i)=>parking('화명'+i,i));
 const result=searchByIntent(items,interpretLocally('화명 빈자리 60대 이상인 곳 3개만 찾아줘'));
 assert.equal(result.matchedCount,10);assert.deepEqual(result.parkings.map(p=>p.availableSpaces),[69,68,67]);
 const best=searchByIntent(fixtures,interpretLocally('부산대에서 제일 여유 있는 곳 알려줘'));
 assert.equal(best.parkings[0].name,'부산대역북측');
});
test('상세 정규화·동명 후보·없는 결과·무관 질문·지원하지 않는 조건',()=>{
 assert.equal(searchByIntent(fixtures,interpretLocally('화명역 주차장 요금과 운영시간 알려줘')).parkings[0].name,'화명역');
 assert.equal(searchByIntent([...fixtures,parking('화명역',3)],interpretLocally('화명역 요금 알려줘')).requiresSelection,true);
 assert.equal(searchByIntent(fixtures,interpretLocally('없는주차장123 알려줘')).matchedCount,0);
 assert.equal(interpretLocally('오늘 점심 뭐 먹을까').intent,'clarify');
 for(const q of ['무료 주차장 찾아줘','화명 말고 부산대 알려줘','내 주변 주차장 찾아줘'])assert.equal(interpretLocally(q),null);
});
function context(question,env={},extra={}){return {env,request:new Request('https://parking.example/api/ai-parking',{
 method:'POST',headers:{Origin:'https://parking.example','Content-Type':'application/json'},body:JSON.stringify({question,...extra})})};}
test('실서비스 로컬 검색은 키·Turnstile·MCP 없이 API만 사용',async()=>{
 let loads=0;
 const response=await handleAiParking(context('화명 주차장 찾아줘'),{interpret:()=>{throw Error('must not call AI');},loadParking:async()=>{loads++;return Response.json({items:fixtures,warnings:['기준일 확인']});}});
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.source,'local');assert.equal(data.parkings.length,1);assert.equal(loads,1);
 assert.equal(data.version,'V6.4.1-hybrid-local-first');
});
test('외부 AI는 서버 사용자 확인 후에만 실행, 검증된 조건으로 실제 데이터 조회',async()=>{
 const env={GEMINI_API_KEY:'secret',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'verify'};
 let calls=0;
 const dependencies={interpret:async()=>{calls++;return {intent:'search_parking',keyword:'화명'};},loadParking:async()=>Response.json({items:fixtures}),fetchImpl:async()=>Response.json({success:true,hostname:'parking.example',action:'parking_chat'})};
 assert.equal((await handleAiParking(context('저렴한 화명 주차장',env),dependencies)).status,403);assert.equal(calls,0);
 const response=await handleAiParking(context('저렴한 화명 주차장',env,{turnstileToken:'token'}),dependencies);
 assert.equal((await response.json()).source,'gemini');assert.equal(calls,1);
});
test('잘못된 Origin·본문 거절 및 공공 API 실패 시 성공 카드 반환 안 함',async()=>{
 assert.equal((await handleAiParking({env:{},request:new Request('https://parking.example/api/ai-parking',{method:'POST'})})).status,403);
 assert.equal((await handleAiParking(context(''))).status,400);
 const response=await handleAiParking(context('화명 주차장'),{loadParking:async()=>Response.json({message:'secret failure'},{status:502})});
 assert.equal(response.status,502);assert.ok(!(await response.text()).includes('secret failure'));
});

test('기존 OpenRouter 비교는 Gemini 키가 함께 있어도 기존 보호 경로 유지',async()=>{
 let calls=0;
 const response=await handleAiParking(context('화명역 주차장 요금 비교해줘',{
  GEMINI_API_KEY:'gemini',OPENROUTER_API_KEY:'openrouter',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'verify'
 },{turnstileToken:'token'}),{legacyChat:async c=>{calls++;const body=await c.request.json();assert.equal(body.turnstileToken,'token');return Response.json({answer:'기존 경로'});},interpret:()=>{throw Error('must not use Gemini for comparison');}});
 assert.equal((await response.json()).answer,'기존 경로');assert.equal(calls,1);
});

test('참고 사이트의 장소 근처·한 곳만·관리 기관 문형을 로컬 처리',()=>{
 assert.equal(interpretLocally('화명역 근처 주차장 찾아줘').keyword,'화명역');
 assert.equal(interpretLocally('부산대 주변에서 빈자리 많은 주차장 한 곳만 찾아줘').limit,1);
 assert.equal(interpretLocally('화명역 관리 기관 알려줘').name,'화명역');
});
test('이름 외 도로명·지번·관리기관으로 실제 데이터를 검색',()=>{
 const items=[{...parking('특정 주차장',2),roadAddress:'부산 북구 도로1',lotAddress:'부산 북구 지번2',agency:'북구청'}];
 for(const keyword of ['도로1','지번2','북구청'])assert.equal(searchByIntent(items,{intent:'search_parking',keyword}).parkings.length,1);
});
