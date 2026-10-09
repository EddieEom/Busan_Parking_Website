import test from 'node:test';
import assert from 'node:assert/strict';
import {handleChat} from '../functions/api/chat.js';
const env={OPENROUTER_API_KEY:'private-openrouter',TURNSTILE_SITE_KEY:'public-site',TURNSTILE_SECRET_KEY:'private-turnstile',MCP_AUTH_TOKEN:'private-mcp'};
const request=(body,origin='https://parking.example')=>new Request('https://parking.example/api/chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const question={question:'화명 주차장 찾아줘',turnstileToken:'verified-token'};
test('설정 조회에는 공개 site key만 반환',async()=>{
 const r=await handleChat({request:new Request('https://parking.example/api/chat'),env});
 assert.deepEqual(await r.json(),{enabled:true,siteKey:'public-site',missingSettings:[],configVersion:'openrouter-config-v1'});
 const disabled=await handleChat({request:new Request('https://parking.example/api/chat'),env:{}});
 const data=await disabled.json();assert.equal(data.enabled,false);
 assert.deepEqual(data.missingSettings,['OPENROUTER_API_KEY','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY']);
 for(const name of ['OPENROUTER_API_KEY','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY']) {
  const partial=await handleChat({request:new Request('https://parking.example/api/chat'),env:{...env,[name]:'  '}});
  const text=await partial.text();const result=JSON.parse(text);
  assert.deepEqual(result.missingSettings,[name]);assert.equal(result.siteKey,null);
  for(const secret of ['private-openrouter','private-turnstile','private-mcp'])assert.ok(!text.includes(secret));
 }
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
test('사용자 확인→OpenRouter 설정 전달, 답변에는 비밀값 미포함',async()=>{
 const response=await handleChat({request:request(question),env},async()=>Response.json({success:true,hostname:'parking.example',action:'parking_chat'}),async(options)=>{
  assert.equal(options.apiKey,'private-openrouter');assert.equal(options.model,'openai/gpt-4.1-mini');
  assert.equal(options.mcpUrl,'https://parking.example/api/mcp');assert.equal(options.mcpToken,'private-mcp');
  return {text:'검색 결과입니다.',toolCalls:['search_parking'],warnings:[],completion:'completed'};
 });
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.answer,'검색 결과입니다.');assert.equal(JSON.stringify(data).includes('private-'),false);
});
test('외부 오류 메시지에 포함된 비밀값은 노출하지 않음',async()=>{
 let count=0;
 const response=await handleChat({request:request(question),env},async()=>{
  if(!count++)return Response.json({success:true,hostname:'parking.example',action:'parking_chat'});
  return Response.json({error:{message:'private-openrouter private-mcp'}},{status:400});
 });
 assert.equal(response.status,502);assert.equal((await response.text()).includes('private-'),false);
});

test('잔액·요청한도·혼잡은 구분하며 외부 오류 내용은 숨김',async()=>{
 for(const [status,http,word] of [[402,503,'잔액'],[429,429,'한도'],[503,503,'혼잡']]) {
  const r=await handleChat({request:request(question),env},async()=>Response.json({success:true,hostname:'parking.example',action:'parking_chat'}),async()=>{throw Object.assign(new Error('private-openrouter'),{status});});
  assert.equal(r.status,http);const body=await r.text();assert.ok(body.includes(word));assert.ok(!body.includes('private-openrouter'));
 }
});
