import test from 'node:test';
import assert from 'node:assert/strict';
import {handleChat} from '../functions/api/chat.js';
const env={GEMINI_API_KEY:'private-gemini',TURNSTILE_SITE_KEY:'public-site',TURNSTILE_SECRET_KEY:'private-turnstile',MCP_AUTH_TOKEN:'private-mcp'};
const request=(body,origin='https://parking.example')=>new Request('https://parking.example/api/chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const question={question:'화명 주차장 찾아줘',turnstileToken:'verified-token'};
test('설정 조회에는 공개 site key만 반환',async()=>{
 const r=await handleChat({request:new Request('https://parking.example/api/chat'),env});
 assert.deepEqual(await r.json(),{enabled:true,siteKey:'public-site'});
 const disabled=await handleChat({request:new Request('https://parking.example/api/chat'),env:{}});
 assert.equal((await disabled.json()).enabled,false);
});
test('외부 Origin·초과 본문·미설정은 Gemini 호출 전에 거절',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('should not call');};
 assert.equal((await handleChat({request:request(question,'https://evil.example'),env},fetcher)).status,403);
 assert.equal((await handleChat({request:request({question:'x'.repeat(9000)}),env},fetcher)).status,413);
 assert.equal((await handleChat({request:request(question),env:{}},fetcher)).status,503);
 assert.equal(calls,0);
});
test('사용자 확인의 hostname/action 오류는 Gemini 호출 차단',async()=>{
 for(const verification of [{success:false},{success:true,hostname:'evil.example',action:'parking_chat'},{success:true,hostname:'parking.example',action:'wrong'}]){
  let calls=0;
  const response=await handleChat({request:request(question),env},async()=>{calls++;return Response.json(verification);});
  assert.equal(response.status,403);assert.equal(calls,1);
 }
});
test('사용자 확인→Gemini→검증된 MCP 결과만 브라우저로 전달',async()=>{
 const urls=[];
 const response=await handleChat({request:request(question),env},async(url,init)=>{
  urls.push(String(url));
  if(url.includes('siteverify')){
   assert.equal(JSON.parse(init.body).secret,'private-turnstile');
   return Response.json({success:true,hostname:'parking.example',action:'parking_chat'});
  }
  const body=JSON.parse(init.body);
  assert.equal(body.model,'gemini-3.6-flash');assert.equal(body.tools[0].url,'https://parking.example/api/mcp');
  assert.equal(body.tools[0].headers.Authorization,'Bearer private-mcp');
  return Response.json({status:'completed',steps:[
   {type:'function_call',id:'c1',name:'busan_parking:search_parking'},
   {type:'function_result',call_id:'c1',name:'busan_parking:search_parking',result:{items:[{name:'화명'}],matchedCount:1,returnedCount:1}},
   {type:'model_output',content:[{type:'text',text:'검색 결과입니다.'}]}
  ]});
 });
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.answer,'검색 결과입니다.');assert.deepEqual(data.toolCalls,['search_parking']);
 assert.equal(JSON.stringify(data).includes('private-'),false);assert.equal(urls.length,2);
});
test('외부 오류 메시지에 포함된 비밀값은 노출하지 않음',async()=>{
 let count=0;
 const response=await handleChat({request:request(question),env},async()=>{
  if(!count++)return Response.json({success:true,hostname:'parking.example',action:'parking_chat'});
  return Response.json({error:{message:'private-gemini private-mcp'}},{status:400});
 });
 assert.equal(response.status,502);assert.equal((await response.text()).includes('private-'),false);
});
