import test from 'node:test';
import assert from 'node:assert/strict';
import {handleChat,createMcpFetch} from '../functions/api/chat.js';
import {connectParkingMcp} from '../mcp-server/openrouterClient.js';
import {handleMcpRequest} from '../mcp-server/httpHandler.js';
const env={OPENROUTER_API_KEY:'private-openrouter',TURNSTILE_SITE_KEY:'public-site',TURNSTILE_SECRET_KEY:'private-turnstile',MCP_AUTH_TOKEN:'private-mcp'};
const request=(body,origin='https://parking.example')=>new Request('https://parking.example/api/chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const question={question:'화명 주차장 찾아줘',turnstileToken:'verified-token'};
test('Pages 내부 MCP는 자기 사이트 fetch 없이 SDK 프로토콜·인증·검색을 실행',async()=>{
 let network=0,handled=0;
 const context={request:request(question),env};
 const dispatch=createMcpFetch(context,async()=>{network++;return Response.json({external:true});},async ctx=>{
  handled++;assert.equal(ctx.env,env);
  return handleMcpRequest(ctx.request,{token:env.MCP_AUTH_TOKEN,fetchImpl:async()=>Response.json({items:[{id:'1',source:'realtime',code:'1',name:'화명',district:'북구',available:3}]})});
 });
 const client=await connectParkingMcp({mcpUrl:'https://parking.example/api/mcp',mcpToken:env.MCP_AUTH_TOKEN,signal:AbortSignal.timeout(5000)},dispatch);
 try {
  assert.equal((await client.listTools()).tools.length,3);
  const result=await client.callTool({name:'search_parking',arguments:{keyword:'화명',limit:8}});
  assert.equal(result.structuredContent.returnedCount,1);assert.equal(network,0);assert.ok(handled>=3);
 } finally {await client.close();}
 const rejected=await dispatch('https://parking.example/api/mcp',{method:'POST'});assert.equal(rejected.status,401);
 await dispatch('https://other.example/api/mcp');
 await dispatch('https://openrouter.ai/api/v1/chat/completions');assert.equal(network,2);
});
test('설정 조회에는 공개 site key만 반환',async()=>{
 const r=await handleChat({request:new Request('https://parking.example/api/chat'),env});
 assert.deepEqual(await r.json(),{enabled:true,siteKey:'public-site',missingSettings:[],model:'openai/gpt-4.1-mini',configVersion:'openrouter-config-v2'});
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
test('웹 AI의 키 인증·모델 라우팅·MCP 연결 실패를 비밀값 없이 구분',async()=>{
 for(const [status,code,expected] of [[401,'OPENROUTER_HTTP_ERROR','OPENROUTER_AUTH_FAILED'],[404,'OPENROUTER_HTTP_ERROR','OPENROUTER_MODEL_UNAVAILABLE'],[502,'MCP_CONNECTION_FAILED','MCP_CONNECTION_FAILED']]) {
  const r=await handleChat({request:request(question),env},async()=>Response.json({success:true,hostname:'parking.example',action:'parking_chat'}),async()=>{throw Object.assign(new Error('private-openrouter private-mcp'),{status,code});});
  const text=await r.text();assert.equal(r.status,502);assert.equal(JSON.parse(text).code,expected);assert.ok(!text.includes('private-'));
 }
});
