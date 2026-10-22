import {fetchBasicInfo} from './fetchBasicInfo.js';
const FRESH_MS=15*60*1000,FALLBACK_MS=24*60*60*1000;
// 기본정보(좌표·주소·요금)만 캐시합니다. 실시간 빈자리는 이 경로에 들어오지 않습니다.
export async function loadBasicInfo(context, apiKey, {cache=globalThis.caches?.default,
  fetchBasic=fetchBasicInfo,now=Date.now}={}) {
  let key=null,saved=null;
  if(cache) {
    try {
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(apiKey));
      const fingerprint=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
      const url=new URL('/_parking-cache/basic-v1',context.request.url);url.searchParams.set('credential',fingerprint);
      key=new Request(url);
      const response=await cache.match(key);
      if(response) {
        const value=await response.json(),age=now()-Date.parse(value.fetchedAt);
        if(Array.isArray(value.items)&&value.items.length&&value.items.every(p=>p&&typeof p.pkNam==='string')&&age>=0&&age<=FALLBACK_MS)saved=value;
      }
    } catch {saved=null;}
  }
  if(saved&&now()-Date.parse(saved.fetchedAt)<=FRESH_MS)return {...saved,source:'cache',stale:false};
  try {
    const items=await fetchBasic(apiKey);
    if(!Array.isArray(items)||!items.length)throw Object.assign(new Error('API_EMPTY_BASIC'),{code:'API_EMPTY_BASIC'});
    const value={items,fetchedAt:new Date(now()).toISOString()};
    if(cache&&key) {
      const write=Promise.resolve().then(()=>cache.put(key,Response.json(value,{headers:{'Cache-Control':`public, max-age=${FALLBACK_MS/1000}`}}))).catch(()=>{});
      try {if(context.waitUntil)context.waitUntil(write);else await write;} catch {}
    }
    return {...value,source:'live',stale:false};
  } catch(error) {
    if(saved)return {...saved,source:'fallback',stale:true};
    throw error;
  }
}
