import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAll} from '../lib/fetchAll.js';
import {loadBasicInfo} from '../lib/basicInfoCache.js';
import {onRequestGet} from '../functions/api/parking.js';
const payload=(items,totalCount=items.length)=>({response:{header:{resultCode:'00'},body:{items:{item:items},totalCount}}});
const context={request:new Request('https://parking.example/api/parking'),env:{DATA_API_KEY:'secret'}};
function cacheStore(){const data=new Map();return {data,async match(k){return data.get(k.url)?.clone();},async put(k,r){data.set(k.url,r.clone());}};}
test('기본정보 대용량 페이지와 단일 객체, 전체 페이지 수집',async()=>{
 let calls=0;
 const rows=await fetchAll('https://api.example/basic','encoded%2Bkey',{pageSize:1000,fetchImpl:async url=>{
  calls++;assert.equal(url.searchParams.get('numOfRows'),'1000');assert.equal(url.searchParams.get('serviceKey'),'encoded+key');
  return Response.json(payload(calls===1?[{pkNam:'하나'}]:{pkNam:'둘'},2));
 }});assert.equal(calls,2);assert.equal(rows.length,2);
});
test('503·429·연결 실패는 최대 두 번 재시도, 인증 오류는 즉시 실패',async()=>{
 let calls=0;
 await fetchAll('https://api.example/basic','secret',{sleep:async()=>{},fetchImpl:async()=>++calls<3?Response.json({}, {status:503}):Response.json(payload([]))});assert.equal(calls,3);
 calls=0;await assert.rejects(fetchAll('https://api.example/basic','secret',{fetchImpl:async()=>{calls++;return new Response('',{status:403});}}),{code:'API_AUTH_ERROR'});assert.equal(calls,1);
 calls=0;await assert.rejects(fetchAll('https://api.example/basic','secret',{sleep:async()=>{},fetchImpl:async()=>{calls++;throw Error('secret network failure');}}),{code:'API_CONNECTION_ERROR'});assert.equal(calls,3);
});
test('기본정보만 15분 재사용, 일시 실패 시 24시간 내 저장본·시각 제공',async()=>{
 const cache=cacheStore();let now=Date.now(),calls=0,fail=false;
 const options={cache,now:()=>now,fetchBasic:async()=>{calls++;if(fail)throw Error('offline');return [{pkNam:'좌표 주차장',xCdnt:'35.2',yCdnt:'129.1'}];}};
 const first=await loadBasicInfo(context,'secret',options);assert.equal(first.source,'live');
 assert.equal((await loadBasicInfo(context,'secret',options)).source,'cache');assert.equal(calls,1);
 now+=16*60000;fail=true;const fallback=await loadBasicInfo(context,'secret',options);assert.equal(fallback.source,'fallback');assert.equal(fallback.stale,true);assert.equal(fallback.fetchedAt,first.fetchedAt);
 assert.ok([...cache.data.keys()].every(k=>!k.includes('secret')));
 now+=25*3600000;await assert.rejects(loadBasicInfo(context,'secret',options));
});
test('다른 인증키·손상된 캐시·빈 기본정보를 정상 데이터로 취급하지 않음',async()=>{
 const cache=cacheStore();await loadBasicInfo(context,'secret',{cache,fetchBasic:async()=>[{pkNam:'하나'}]});
 await assert.rejects(loadBasicInfo(context,'other',{cache,fetchBasic:async()=>{throw Error('auth');}}));
 await assert.rejects(loadBasicInfo(context,'none',{cache:null,fetchBasic:async()=>[]}),{code:'API_EMPTY_BASIC'});
});
test('통합 API는 기본정보 장애에도 실시간 유지하고 좌표 복구 상태를 알림',async()=>{
 let basicsFail=true;
 const deps={fetchList:async()=>[{parkgcd:'1',parknm:'테스트'}],fetchRealtime:async()=>[],loadBasic:async()=>{
  if(basicsFail)throw Error('private key');return {items:[{pkNam:'테스트',xCdnt:'35.2',yCdnt:'129.1'}],source:'fallback',fetchedAt:'2026-10-22T00:00:00Z',stale:true};
 }};
 const failed=await (await onRequestGet(context,deps)).json();assert.equal(failed.sources.basic.status,'unavailable');assert.equal(failed.stats.coordinateCount,0);assert.equal(failed.items.length,1);assert.ok(!JSON.stringify(failed).includes('private key'));
 basicsFail=false;const recovered=await (await onRequestGet(context,deps)).json();assert.equal(recovered.sources.basic.stale,true);assert.equal(recovered.stats.coordinateCount,1);assert.ok(recovered.warnings.some(w=>w.includes('저장본')));
});

test('캐시 저장소 자체가 실패해도 정상 원본 기본정보를 반환',async()=>{
 const cache={match(){throw Error('cache read');},put(){throw Error('cache write');}};
 const data=await loadBasicInfo(context,'secret',{cache,fetchBasic:async()=>[{pkNam:'정상 원본'}]});
 assert.equal(data.source,'live');assert.equal(data.items[0].pkNam,'정상 원본');
});
