import {renderAnswerHtml} from './answer-renderer.js';
(() => {
  const get=id=>document.getElementById(id);
  let token='',widget=null,busy=false;
  const update=()=>{get('chat-send').disabled=busy||!token;};
  async function setup(){
    try {
      const response=await fetch('/api/chat',{cache:'no-store'});
      const config=await response.json();
      if(!response.ok||!config.enabled){get('chat-config').textContent='AI 안내를 준비 중입니다. 아래 목록에서 주차장을 검색해 주세요.';return;}
      const script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
      script.onerror=()=>{get('chat-config').textContent='사용자 확인을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';};
      script.onload=()=>{
        get('chat-form').hidden=false;get('chat-config').textContent='주차장 검색·상세정보·비교를 도와드립니다.';
        widget=window.turnstile.render('#chat-verify',{sitekey:config.siteKey,action:'parking_chat',
          callback:value=>{token=value;update();},'expired-callback':()=>{token='';update();},
          'error-callback':()=>{token='';update();get('chat-status').textContent='사용자 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.';}});
      };
      document.head.append(script);
    }catch{get('chat-config').textContent='AI 안내 연결을 확인하지 못했습니다. 페이지를 새로고침해 주세요.';}
  }
  get('chat-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!token)return;
    const question=get('chat-question').value.trim();if(!question)return;
    busy=true;update();get('chat-question').disabled=true;
    get('chat-status').textContent='최신 주차정보를 확인하고 있습니다…';get('chat-answer').hidden=true;
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({question,turnstileToken:token}),cache:'no-store',signal:AbortSignal.timeout(130000)});
      const data=await response.json();if(!response.ok)throw new Error(data.message||'답변을 확인하지 못했습니다.');
      get('chat-answer').innerHTML=renderAnswerHtml(data.answer);get('chat-answer').hidden=false;get('chat-answer').focus();
      get('chat-status').textContent=(data.warnings||[]).join(' ')||'최신 주차정보 조회를 마쳤습니다.';
    }catch(error){get('chat-status').textContent=error.name==='TimeoutError'?'답변이 지연되고 있습니다. 잠시 후 다시 질문해 주세요.':error.message;}
    finally{busy=false;token='';get('chat-question').disabled=false;if(widget!==null)window.turnstile.reset(widget);update();}
  });
  setup();
})();
