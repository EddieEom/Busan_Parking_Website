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
