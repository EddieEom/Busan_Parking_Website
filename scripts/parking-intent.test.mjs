import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretWithGemini,validateIntent} from '../services/parkingIntent.js';
const intent={intent:'search_parking',keyword:'화명',limit:5};
const response=value=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
test('Gemini는 JSON 조건만 반환, 키는 헤더에만 전송',async()=>{
 const result=await interpretWithGemini('화명 찾아줘',{GEMINI_API_KEY:'secret'},async(url,init)=>{
  assert.ok(!url.includes('secret'));assert.equal(init.headers['x-goog-api-key'],'secret');
  const body=JSON.parse(init.body);assert.equal(body.generationConfig.responseMimeType,'application/json');
  assert.equal(body.tools,undefined);return response(intent);
 });assert.equal(result.keyword,'화명');assert.equal(result.limit,5);
});
test('조건 검증: 허용 intent·숫자 범위·문자열·상세 이름',()=>{
 assert.equal(validateIntent({...intent,limit:999}).limit,20);
 assert.equal(validateIntent({...intent,limit:-3}).limit,1);
 for(const value of [{intent:'delete'}, {...intent,limit:'3'}, {...intent,minAvailable:NaN}, {...intent,keyword:{}}, {intent:'get_parking_detail'}])assert.throws(()=>validateIntent(value));
});
test('429·503 최대 두 번 재시도, 키·외부 오류 비노출',async()=>{
 let calls=0,waits=0;
 await interpretWithGemini('화명',{GEMINI_API_KEY:'secret'},async()=>++calls<3?Response.json({error:{message:'high demand'}},{status:503}):response(intent),async()=>waits++);
 assert.equal(calls,3);assert.equal(waits,2);
 for(const status of [429,503,401]){
  calls=0;
  await assert.rejects(interpretWithGemini('화명',{GEMINI_API_KEY:'secret'},async()=>{calls++;return Response.json({error:{message:'secret'}},{status});},async()=>{}),error=>!error.message.includes('secret'));
  assert.equal(calls,status===401?1:3);
 }
});
test('잘린 출력·비 JSON·허용되지 않은 조건은 실제 검색 전에 거절',async()=>{
 for(const data of [{candidates:[{finishReason:'MAX_TOKENS'}]}, {candidates:[{finishReason:'STOP',content:{parts:[{text:'oops'}]}}]}]){
  await assert.rejects(interpretWithGemini('화명',{GEMINI_API_KEY:'secret'},async()=>Response.json(data)),/AI_INVALID_RESPONSE/);
 }
});
