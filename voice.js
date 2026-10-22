export function voiceRoute(text) {
  const compact=text.replace(/\s+/g,'');
  const parking=/주차/.test(compact);
  // 장소가 명시된 '화명역 근처'는 현재 위치로 바꾸지 않습니다.
  const current=/내주변|내근처|현재위치|여기(?:서|주변|근처)|이근처/.test(compact) ||
    /^(?:지금)?(?:근처|주변|가까운)(?:에서|에|의)?(?:빈자리많은|여유있는)?(?:공영)?주차/.test(compact);
  return {nearby:parking&&current,sort:/빈자리|여유|주차가능/.test(compact)?'available':'name'};
}
export function voiceError(code) {
  return ({'not-allowed':'마이크 권한이 거부되었습니다. 브라우저 또는 앱 설정에서 마이크 권한을 허용해 주세요.',
    'service-not-allowed':'음성 인식 사용 권한을 확인해 주세요. 텍스트 검색도 이용할 수 있습니다.',
    'no-speech':'음성이 들리지 않았습니다. 마이크 버튼을 다시 누르고 말해 주세요.',
    'audio-capture':'마이크를 사용할 수 없습니다. 연결 상태와 다른 앱의 마이크 사용 여부를 확인해 주세요.',
    network:'음성 인식 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
    'language-not-supported':'이 브라우저는 한국어 음성 인식을 지원하지 않습니다. 텍스트로 입력해 주세요.',
    aborted:'음성 입력을 취소했습니다.'})[code]||'음성 인식을 완료하지 못했습니다. 텍스트로 입력해 주세요.';
}
export function setupVoice({button,input,status,onSearch,onNearby,isBusy=()=>false,windowImpl=globalThis.window}) {
  const Recognition=windowImpl?.SpeechRecognition||windowImpl?.webkitSpeechRecognition;
  const setListening=value=>{
    button.classList.toggle('listening',value);button.setAttribute('aria-pressed',String(value));
    button.setAttribute('aria-label',value?'음성 입력 취소':'말해서 주차장 찾기');
  };
  let recognition=null,listening=false,handled=false,cancelled=false;
  button.addEventListener('click',()=>{
    if(listening){cancelled=true;recognition.abort();return;}
    if(isBusy()){status.textContent='검색이 끝난 뒤 마이크 버튼을 눌러 주세요.';return;}
    if(!Recognition){status.textContent='이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 계열 브라우저 또는 텍스트·GPS 검색을 이용해 주세요.';return;}
    try {
      recognition=new Recognition();const session=recognition;recognition.lang='ko-KR';recognition.continuous=false;
      recognition.interimResults=false;recognition.maxAlternatives=1;
      handled=false;cancelled=false;listening=true;setListening(true);
      status.textContent='듣고 있습니다... 말씀해주세요.';
      recognition.onerror=event=>{if(recognition!==session)return;handled=true;status.textContent=voiceError(event.error);listening=false;setListening(false);};
      recognition.onend=()=>{if(recognition!==session)return;listening=false;setListening(false);if(!handled)status.textContent=cancelled?'음성 입력을 취소했습니다.':'음성이 들리지 않았습니다. 마이크 버튼을 다시 누르고 말해 주세요.';};
      recognition.onresult=event=>{
        if(recognition!==session||handled||cancelled)return;
        const result=event.results?.[event.resultIndex||0];
        if(!result?.isFinal)return;
        const text=result[0]?.transcript?.trim();if(!text)return;
        handled=true;listening=false;setListening(false);input.value=text;
        const route=voiceRoute(text);
        status.textContent=route.nearby?'현재 위치 주변 주차장을 찾고 있습니다...':'인식한 문장으로 검색하고 있습니다...';
        Promise.resolve().then(()=>route.nearby?onNearby({sort:route.sort}):onSearch()).then(()=>{
          if(route.nearby)status.textContent='주변 검색 안내와 결과를 아래 목록에서 확인해 주세요.';
        }).catch(()=>{status.textContent='검색을 완료하지 못했습니다. 텍스트 또는 GPS 버튼으로 다시 검색해 주세요.';});
      };
      recognition.start();
    } catch {handled=true;listening=false;setListening(false);status.textContent='마이크를 시작하지 못했습니다. 권한을 확인하거나 텍스트로 검색해 주세요.';}
  });
  return {cancel(){if(listening){cancelled=true;recognition.abort();}}};
}
