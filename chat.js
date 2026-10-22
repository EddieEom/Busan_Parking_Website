import {renderAnswerHtml} from './answer-renderer.js';
import {makeCard} from './parking-card.js';
(() => {
  const get=id=>document.getElementById(id);
  let token='',widget=null,busy=false;
  const update=()=>{get('chat-send').disabled=busy;};
  async function setup(){
    try {
      const response=await fetch('/api/ai-parking',{cache:'no-store'});
      const config=await response.json();
      if(!response.ok||!config.enabled){get('chat-config').textContent='AI 안내를 준비 중입니다. 아래 목록에서 주차장을 검색해 주세요.';return;}
      get('chat-form').hidden=false;
      get('chat-config').textContent='이름·빈자리·요금·운영시간을 물어보세요.';
      update();
      if(!config.siteKey)return;
      const script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
      script.onerror=()=>{get('chat-config').textContent='이름·빈자리 검색을 사용할 수 있습니다. 복잡한 질문은 사용자 확인 연결 후 이용해 주세요.';};
      script.onload=()=>{
        get('chat-form').hidden=false;get('chat-config').textContent='주차장 검색·상세정보·비교를 도와드립니다.';
        widget=window.turnstile.render('#chat-verify',{sitekey:config.siteKey,action:'parking_chat',
          callback:value=>{token=value;update();},'expired-callback':()=>{token='';update();},
          'error-callback':()=>{token='';update();get('chat-status').textContent='사용자 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.';}});
      };
      document.head.append(script);
    }catch{get('chat-form').hidden=false;update();get('chat-config').textContent='연결을 확인하지 못했습니다. 이름·빈자리 조건으로 다시 검색해 주세요.';}
  }
  get('chat-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const question=get('chat-question').value.trim();if(!question)return;
    busy=true;update();get('chat-question').disabled=true;
    get('chat-results').hidden=true;get('chat-parking-list').replaceChildren();
    get('chat-status').textContent='최신 주차정보를 확인하고 있습니다…';get('chat-answer').hidden=true;
    try{
      const response=await fetch('/api/ai-parking',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({question,turnstileToken:token}),cache:'no-store',signal:AbortSignal.timeout(130000)});
      const data=await response.json();if(!response.ok)throw new Error(data.message||'답변을 확인하지 못했습니다.');
      get('chat-answer').innerHTML=renderAnswerHtml(data.answer);get('chat-answer').hidden=false;get('chat-answer').focus();
      const parkings=Array.isArray(data.parkings)?data.parkings:[];
      for(const parking of parkings) get('chat-parking-list').append(makeCard(parking,{showRaw:false,headingLevel:'h4'}));
      get('chat-results').hidden=parkings.length===0;
      get('chat-results-title').textContent=data.requiresSelection?'이름과 위치를 확인해 주세요':'조회한 주차장';
      get('chat-results-note').textContent=data.requiresSelection
        ? `일치하는 주차장 ${data.matchedCount}곳 중 ${parkings.length}곳입니다. 다음 질문에 정확한 이름과 지역을 적어 주세요.`
        : `조회 결과 ${parkings.length}곳입니다. 현황 갱신 시각과 공공데이터 기준일을 확인하세요.`;
      get('chat-status').textContent=(data.warnings||[]).join(' ')||'최신 주차정보 조회를 마쳤습니다.';
    }catch(error){get('chat-status').textContent=error.name==='TimeoutError'?'답변이 지연되고 있습니다. 잠시 후 다시 질문해 주세요.':error.message;}
    finally{busy=false;token='';get('chat-question').disabled=false;if(widget!==null)window.turnstile.reset(widget);update();}
  });
  setup();
  // 답변을 오래 읽는 동안에도 과거 빈자리를 현재 가능 대수로 표시하지 않습니다.
  setInterval(()=>{
    const list=get('chat-parking-list');
    if(get('chat-results').hidden)return;
    for(const card of list.children){
      const parking=card.parkingData;
      if(parking)card.replaceWith(makeCard(parking,{showRaw:false,headingLevel:'h4'}));
    }
  },60000);
})();
