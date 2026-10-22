import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceRoute,setupVoice,voiceError} from '../voice.js';
function harness({supported=true,throws=false}={}) {
 const input={value:''},status={textContent:''},attributes={};let click,instance,ai=0,gps=[];
 const classes=new Set();
 const button={addEventListener:(_,fn)=>click=fn,setAttribute:(k,v)=>attributes[k]=v,classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}};
 class Recognition {constructor(){instance=this;}start(){if(throws)throw Error('blocked');}abort(){this.onend();}}
 setupVoice({button,input,status,onSearch:()=>{ai++;},onNearby:options=>gps.push(options),windowImpl:supported?{webkitSpeechRecognition:Recognition}:{}});
 return {click:()=>click(),get instance(){return instance;},input,status,classes,attributes,get ai(){return ai;},gps};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('일반 발화·내 주변·빈자리 정렬, 특정 장소의 근처 요청은 현재 위치로 바꾸지 않음',()=>{
 assert.deepEqual(voiceRoute('내 주변에서 빈자리 많은 주차장 찾아줘'),{nearby:true,sort:'available'});
 assert.equal(voiceRoute('현재 위치 근처 주차장').nearby,true);
 assert.equal(voiceRoute('가까운 주차장 찾아줘').nearby,true);
 assert.equal(voiceRoute('화명역 근처 주차장 요금').nearby,false);
 assert.equal(voiceRoute('화명역 주차장 요금과 운영시간 알려줘').nearby,false);
});
test('한국어 한 번 인식, 듣기 상태·텍스트 반영·자동 검색·중복 결과 방지',async()=>{
 const h=harness();h.click();const r=h.instance;
 assert.equal(r.lang,'ko-KR');assert.equal(r.continuous,false);assert.equal(r.interimResults,false);assert.equal(r.maxAlternatives,1);
 assert.ok(h.classes.has('listening'));assert.equal(h.attributes['aria-pressed'],'true');
 const event={results:[Object.assign([{transcript:'화명역 요금 알려줘'}],{isFinal:true})]};r.onresult(event);r.onresult(event);r.onend();await settle();
 assert.equal(h.input.value,'화명역 요금 알려줘');assert.equal(h.ai,1);assert.equal(h.gps.length,0);assert.ok(!h.classes.has('listening'));
});
test('주변 발화는 AI 없이 V7 GPS와 빈자리순을 실행',async()=>{
 const h=harness();h.click();h.instance.onresult({results:[Object.assign([{transcript:'내 주변에서 빈자리 많은 주차장 찾아줘'}],{isFinal:true})]});await settle();
 assert.equal(h.ai,0);assert.deepEqual(h.gps,[{sort:'available'}]);assert.ok(h.status.textContent.includes('아래 목록'));
});
test('권한 거부·무음·네트워크·한국어 미지원·시작 실패 후 텍스트 입력 유지',()=>{
 for(const code of ['not-allowed','audio-capture','network','no-speech','language-not-supported']){
  const h=harness();h.click();h.instance.onerror({error:code});h.instance.onend();
  assert.equal(h.status.textContent,voiceError(code));assert.ok(!h.classes.has('listening'));assert.equal(h.input.disabled,undefined);
 }
 const unsupported=harness({supported:false});unsupported.click();assert.match(unsupported.status.textContent,/지원하지/);
 const failed=harness({throws:true});failed.click();assert.match(failed.status.textContent,/시작하지/);assert.ok(!failed.classes.has('listening'));
});
test('두 번째 클릭 취소·최종 인식 없이 종료·늦게 도착한 결과 무시',async()=>{
 const h=harness();h.click();h.click();
 h.instance.onresult({results:[Object.assign([{transcript:'화명역'}],{isFinal:true})]});await settle();assert.equal(h.ai,0);assert.match(h.status.textContent,/취소/);
 const empty=harness();empty.click();empty.instance.onend();assert.match(empty.status.textContent,/들리지/);
});

test('이전 인식 세션의 늦은 종료 이벤트가 새 듣기 상태를 해제하지 않음',()=>{
 const h=harness();h.click();const previous=h.instance;h.click();h.click();
 previous.onend();assert.ok(h.classes.has('listening'));h.instance.onend();assert.ok(!h.classes.has('listening'));
});
