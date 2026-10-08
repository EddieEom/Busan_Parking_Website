import test from 'node:test';
import assert from 'node:assert/strict';
import {askOpenRouter, connectParkingMcp} from '../openrouterClient.js';
import {handleMcpRequest} from '../httpHandler.js';
const options={apiKey:'secret-router',mcpToken:'secret-mcp',mcpUrl:'https://parking.example/api/mcp',question:'화명 주차장 찾아줘'};
const names=['search_parking','get_parking_detail','compare_parkings'];
const listing={tools:names.map(name=>({name,inputSchema:{type:'object',properties:{}}}))};
const parking={id:'realtime:1',name:'화명',available:3};
const payload={items:[parking],matchedCount:1,returnedCount:1};
const tool=(name,args,id='c1')=>Response.json({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
const answer=(finish='stop')=>Response.json({choices:[{finish_reason:finish,message:{role:'assistant',content:'화명 검색 결과입니다.'}}]});
function fixture(result={structuredContent:payload},tools=listing){
 const calls=[];let closed=false;
 return {calls,get closed(){return closed;},connect:async()=>({listTools:async()=>tools,callTool:async p=>{calls.push(p);return result;},close:async()=>{closed=true;}})};
}
test('검색 호출 후 실제 MCP 결과와 연결한 답변만 반환, limit 8·토큰 제한·인증 분리',async()=>{
 const f=fixture();let step=0;
 const r=await askOpenRouter(options,async(url,init)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(init.headers.Authorization,'Bearer secret-router');
  const body=JSON.parse(init.body);assert.equal(body.model,'openai/gpt-4.1-mini');assert.equal(body.max_tokens,1200);assert.ok(!init.body.includes('secret-mcp'));
  if(!step++){assert.equal(body.tool_choice.function.name,'search_parking');return tool('search_parking',{keyword:'화명',limit:50});}
  assert.equal(body.messages.at(-1).tool_call_id,'c1');assert.deepEqual(JSON.parse(body.messages.at(-1).content),payload);return answer();
 },f.connect);
 assert.equal(r.completion,'completed');assert.deepEqual(r.toolCalls,['search_parking']);assert.equal(f.calls[0].arguments.limit,8);assert.equal(f.closed,true);
});
test('조회 없는 답변·잘린 답변·오류 결과를 검색 성공으로 인정하지 않음',async()=>{
 for(const mode of ['no-call','length','bad-result']){
  const f=fixture(mode==='bad-result'?{isError:true,content:[]}:undefined);let n=0;
  await assert.rejects(askOpenRouter(options,async()=>mode==='no-call'||n++?answer(mode==='length'?'length':'stop'):tool('search_parking',{}),f.connect));
  assert.equal(f.closed,true);
 }
});
test('미허용 도구·중복 호출 id·잘못된 JSON·검색 전 상세조회 차단',async()=>{
 for(const response of [tool('delete_parking',{}),tool('get_parking_detail',{id:'fake'}),Response.json({choices:[{finish_reason:'tool_calls',message:{role:'assistant',tool_calls:[{id:'x',type:'function',function:{name:'search_parking',arguments:'bad'}}]}}]})]){
  const f=fixture();await assert.rejects(askOpenRouter(options,async()=>response,f.connect));assert.equal(f.calls.length,0);
 }
 const f=fixture();await assert.rejects(askOpenRouter(options,async()=>tool('search_parking',{}),f.connect));assert.equal(f.calls.length,1);
});
test('검색에 없는 상세·비교 id를 차단, 검색 결과의 id는 상세조회 가능',async()=>{
 for(const name of ['get_parking_detail','compare_parkings']){
  const f=fixture();let n=0;await assert.rejects(askOpenRouter(options,async()=>n++?tool(name,name==='get_parking_detail'?{id:'fake'}:{ids:['fake','other']},'c2'):tool('search_parking',{}),f.connect));assert.equal(f.calls.length,1);
 }
 let n=0;const calls=[];
 const r=await askOpenRouter(options,async()=>[tool('search_parking',{}),tool('get_parking_detail',{id:parking.id},'c2'),answer()][n++],async()=>({listTools:async()=>listing,callTool:async p=>{calls.push(p.name);return {structuredContent:p.name==='search_parking'?payload:{parking}};},close:async()=>{}}));
 assert.deepEqual(r.toolCalls,calls);
});
test('API 오류는 상태만 보존하며 키·외부 원문을 출력하지 않음, 재시도 안 함',async()=>{
 for(const status of [401,402,429,503]){
  const f=fixture();let count=0;
  await assert.rejects(askOpenRouter(options,async()=>{count++;return Response.json({error:{message:'secret-router secret-mcp',code:status}},{status});},f.connect),e=>e.status===status&&!e.message.includes('secret-'));
  assert.equal(count,1);assert.equal(f.closed,true);
 }
});
test('도구 호출이 반복되면 4라운드에서 종료·잘못된 설정은 외부 호출 전 차단',async()=>{
 let n=0;const f=fixture();await assert.rejects(askOpenRouter(options,async()=>tool('search_parking',{},String(n++)),f.connect));assert.equal(n,4);
 await assert.rejects(askOpenRouter({...options,apiKey:''},async()=>{throw Error('should not call');}));
 await assert.rejects(askOpenRouter({...options,question:''}));
 await assert.rejects(connectParkingMcp({mcpUrl:'http://evil.example',signal:AbortSignal.timeout(1000)},fetch));
});
test('SDK HTTP MCP 브리지는 기존 stateless 서버의 도구 목록·검색을 실제 프로토콜로 처리',async()=>{
 const fetcher=async(input,init)=>handleMcpRequest(new Request(input,init),{token:'secret-mcp',fetchImpl:async()=>Response.json({items:[{id:'1',source:'realtime',code:'1',name:'화명',district:'북구',address:'',available:3,status:'available',updatedAt:'2026-10-09 08:00:00'}]})});
 const bridge=await connectParkingMcp({...options,signal:AbortSignal.timeout(5000)},fetcher);
 try {
  const list=await bridge.listTools();assert.deepEqual(list.tools.map(x=>x.name),names);
  const result=await bridge.callTool({name:'search_parking',arguments:{keyword:'화명',limit:8}});assert.equal(result.isError,undefined);assert.equal(result.structuredContent.returnedCount,1);
 } finally {await bridge.close();}
});
