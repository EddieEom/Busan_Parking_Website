import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
function setup(fetchImpl){
 const handlers={},writes=[];
 const cache={match:async()=>new Response('offline static'),put:async(url)=>writes.push(url),addAll:async()=>{}};
 const self={location:{origin:'https://parking.example'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:()=>{}};
 vm.runInNewContext(source,{self,URL,Response,caches:{open:async()=>cache},fetch:fetchImpl});
 return {handlers,writes};
}
test('모든 API·POST·외부 요청은 SW 응답 및 캐시 대상에서 제외',()=>{
 const {handlers,writes}=setup(()=>{throw Error('unexpected');});
 for(const [url,method] of [['https://parking.example/api/parking','GET'],['https://parking.example/api/chat','POST'],['https://parking.example/api/chat','GET'],['https://parking.example/api/mcp','POST'],['https://external.example/app.js','GET']]){
  let intercepted=false;handlers.fetch({request:{url,method},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
 }
 assert.equal(writes.length,0);
});
test('정적 파일은 온라인 최신값을 사용하고 오프라인에서만 캐시 복원',async()=>{
 for(const offline of [false,true]){
  const {handlers,writes}=setup(async()=>{if(offline)throw Error('offline');return new Response('latest');});
  let response;handlers.fetch({request:{url:'https://parking.example/app.js',method:'GET'},respondWith:p=>response=p});
  assert.equal(await (await response).text(),offline?'offline static':'latest');
  assert.equal(writes.length,offline?0:1);
 }
});
test('manifest 아이콘 크기와 설치 파일 경로가 실제 파일과 일치',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url)));
 assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){
  const file=new URL('..'+icon.src,import.meta.url);assert.ok(existsSync(file));
  const png=readFileSync(file);assert.equal(png.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
 }
});

test('정적 파일 설치 완료 후 새 서비스 워커 자동 활성화',async()=>{
 let activated=0,installed=false,promise;const handlers={};
 const self={addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{assert.equal(installed,true);activated++;}};
 vm.runInNewContext(source,{self,caches:{open:async()=>({addAll:async()=>{installed=true;}})}});
 handlers.install({waitUntil:p=>promise=p});await promise;assert.equal(activated,1);
});
const pwaSource=readFileSync(new URL('../pwa.js',import.meta.url),'utf8');
async function appSetup({controlled=true,draft='',busy=false,answer=false}={}){
 const handlers={},messages=[],elements={};let reloads=0;
 for(const id of ['install-app','install-note'])elements[id]={hidden:true,addEventListener:()=>{}};
 elements['chat-question']={value:draft,disabled:busy};elements['chat-answer']={hidden:!answer};
 const registration={waiting:{postMessage:message=>messages.push(message)},addEventListener:()=>{},update:async()=>{}};
 const navigator={userAgent:'',serviceWorker:{controller:controlled?{}:null,register:async()=>registration,addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.runInNewContext(pwaSource,{navigator,window:{navigator,matchMedia:()=>({matches:false}),addEventListener:()=>{},location:{reload:()=>reloads++}},document:{visibilityState:'visible',getElementById:id=>elements[id],addEventListener:()=>{}}});
 await Promise.resolve();return {handlers,messages,get reloads(){return reloads;}};
}
test('기존 앱은 버튼 없이 업데이트하고 빈 화면만 자동 새로고침',async()=>{
 const app=await appSetup();assert.deepEqual(JSON.parse(JSON.stringify(app.messages)),[{type:'SKIP_WAITING'}]);
 app.handlers.controllerchange();app.handlers.controllerchange();assert.equal(app.reloads,1);
 const first=await appSetup({controlled:false});first.handlers.controllerchange();assert.equal(first.reloads,0);
});
test('자동 업데이트가 작성 중 질문·AI 요청·읽는 답변을 지우지 않음',async()=>{
 for(const state of [{draft:'화명 주차장'},{busy:true},{answer:true}]){
  const app=await appSetup(state);app.handlers.controllerchange();assert.equal(app.reloads,0);assert.equal(app.messages.length,1);
 }
});
