import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCard} from '../parking-card.js';

// DOM에 쓰는 실제 속성과 이벤트만 제공하여 웹 모듈을 외부 서비스 없이 실행합니다.
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.handlers={};this.hidden=true;this.value='';this.disabled=false;this._text='';}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  append(...children){for(const c of children){c.parent=this;this.children.push(c);}}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  replaceWith(next){const index=this.parent.children.indexOf(this);this.parent.children[index]=next;next.parent=this.parent;}
  addEventListener(name,handler){this.handlers[name]=handler;}
  setAttribute(name,value){this[name]=value;}
  focus(){this.focused=true;}
}
function elementsByTag(root,tag){return [root,...root.children.flatMap(c=>elementsByTag(c,tag))].filter(el=>el.tagName===tag);}
function installDom(){
  const elements=new Map(),intervals=[];
  const original=Object.fromEntries(['document','fetch','window','setInterval'].map(key=>[key,globalThis[key]]));
  globalThis.document={createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element('fragment'),
    getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},head:new Element('head')};
  globalThis.setInterval=fn=>{intervals.push(fn);return intervals.length;};
  return {get:id=>document.getElementById(id),intervals,restore:()=>{for(const [key,value] of Object.entries(original)){
    if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }}};
}
const current=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,19).replace('T',' ');
const parking=()=>({id:'realtime:1',name:'화명역',district:'북구',address:'공공데이터 원본 주소',
  totalSpaces:37,occupiedSpaces:32,availableSpaces:5,status:'available',realtimeSupported:true,
  basicMatched:true,baseMinutes:10,baseFee:100,updatedAt:current(),referenceDate:'2026-10-01'});

test('공통 카드에서 안전한 텍스트·지도 검색어·원본 주소·지연 현황 유지',()=>{
  const dom=installDom();
  try{
    const p={...parking(),name:'<img src=x onerror=alert(1)>',raw:{basic:{pkNam:'원본'}}};
    const card=makeCard(p);
    assert.equal(elementsByTag(card,'img').length,0);
    assert.ok(card.textContent.includes(p.name));assert.ok(card.textContent.includes(p.address));
    assert.equal(elementsByTag(card,'a')[0].href,'https://map.kakao.com/link/search/'+encodeURIComponent('부산 '+p.name));
    assert.ok(card.textContent.includes('원본 데이터'));assert.ok(card.textContent.includes('전체 37면 · 주차 중 32대'));
    const later=makeCard(p,{now:Date.now()+11*60000,showRaw:false});
    assert.ok(later.textContent.includes('갱신 지연'));assert.ok(!later.textContent.includes('5대 주차 가능'));
    assert.ok(!later.textContent.includes('원본 데이터'));
  }finally{dom.restore();}
});

test('AI 질문 → 설명과 검증된 카드 표시 → 새 질문 실패 시 이전 카드 숨김',async()=>{
  const dom=installDom();let verified,failed=false,resets=0;
  try{
    globalThis.window={turnstile:{render:(_selector,options)=>{verified=options.callback;return 1;},reset:()=>resets++}};
    document.head.append=script=>queueMicrotask(()=>script.onload());
    globalThis.fetch=async(_url,init)=>init?.method==='POST'
      ? failed?Response.json({message:'조회 실패'},{status:502}):Response.json({answer:'**조회 완료**',parkings:[parking()],warnings:[],requiresSelection:false,matchedCount:1})
      : Response.json({enabled:true,siteKey:'public-test-key'});
    await import('../chat.js?web-flow');
    // setup()의 JSON 처리와 위젯 로드를 완료합니다.
    await new Promise(resolve=>setImmediate(resolve));
    dom.get('chat-question').value='화명역 요금 알려줘';verified('token');
    await dom.get('chat-form').handlers.submit({preventDefault(){}});
    assert.equal(dom.get('chat-answer').innerHTML,'<p><strong>조회 완료</strong></p>');
    assert.equal(dom.get('chat-results').hidden,false);assert.equal(dom.get('chat-parking-list').children.length,1);
    assert.ok(dom.get('chat-parking-list').textContent.includes('10분 100원'));assert.equal(resets,1);
    const card=dom.get('chat-parking-list').children[0];card.parkingData.updatedAt='2000-01-01 00:00:00';
    dom.intervals[0]();assert.ok(dom.get('chat-parking-list').textContent.includes('갱신 지연'));
    failed=true;verified('new-token');
    await dom.get('chat-form').handlers.submit({preventDefault(){}});
    assert.equal(dom.get('chat-results').hidden,true);assert.equal(dom.get('chat-parking-list').children.length,0);
    assert.equal(dom.get('chat-status').textContent,'조회 실패');assert.equal(resets,2);
  }finally{dom.restore();}
});

test('일반 검색·정렬·새로고침은 AI와 별도로 동작하고 사용자 조건 유지',async()=>{
  const dom=installDom();let calls=0;
  try{
    dom.get('search').value='화명';dom.get('sort').value='available';
    globalThis.fetch=async()=>{calls++;return Response.json({items:[parking()],fetchedAt:new Date().toISOString(),warnings:[]});};
    await import('../app.js?web-flow');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,1);assert.equal(dom.get('parking-list').children[0].children.length,1);
    assert.equal(dom.get('warning').hidden,true);
    assert.ok(dom.get('district').children.some(option=>option.value==='북구'));
    assert.equal(dom.get('district').disabled,false);
    await dom.get('load-button').handlers.click();
    assert.equal(calls,2);assert.equal(dom.get('search').value,'화명');assert.equal(dom.get('sort').value,'available');
    assert.ok(dom.get('result').textContent.includes('1곳 표시'));
    assert.equal(dom.get('warning').hidden,true);
  }finally{dom.restore();}
});

test('V7 GPS→가까운 5곳→빈자리순→새로고침 위치 유지→텍스트 검색 복귀',async()=>{
 const dom=installDom();let gpsCalls=0,apiCalls=0;
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try {
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,geolocation:{getCurrentPosition(success){gpsCalls++;success({coords:{latitude:35.2,longitude:129.1}});}}}});
  globalThis.fetch=async()=>{apiCalls++;return Response.json({items:Array.from({length:7},(_,i)=>({...parking(),name:'주차장'+i,
   availableSpaces:i,raw:{basic:{xCdnt:35.2+i*.001,yCdnt:129.1}}})),fetchedAt:new Date().toISOString(),warnings:[]});};
  const app=await import('../app.js?gps-flow');await new Promise(resolve=>setImmediate(resolve));
  await app.requestNearby();
  const cards=()=>dom.get('parking-list').children[0].children;
  assert.equal(cards().length,5);assert.equal(cards()[0].parkingData.name,'주차장0');
  assert.ok(cards()[0].textContent.includes('현재 위치에서 약 0m'));
  dom.get('sort').value='available';dom.get('sort').handlers.change();
  assert.equal(cards()[0].parkingData.name,'주차장4');
  await dom.get('load-button').handlers.click();assert.equal(gpsCalls,1);assert.equal(apiCalls,2);assert.equal(cards().length,5);
  assert.equal(cards()[0].parkingData.name,'주차장4');
  dom.get('search').value='주차장6';dom.get('search').handlers.input();
  assert.equal(cards().length,1);assert.equal(cards()[0].parkingData.name,'주차장6');
  assert.equal(cards()[0].parkingData.distanceKm,undefined);
 }finally{if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;dom.restore();}
});
