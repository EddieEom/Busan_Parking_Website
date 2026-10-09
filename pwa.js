(() => {
  const install=document.getElementById('install-app'),note=document.getElementById('install-note');
  let prompt=null;
  const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
  if(!standalone){
    note.hidden=false;
    note.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'Safari 공유 메뉴에서 “홈 화면에 추가”를 선택하면 앱처럼 사용할 수 있습니다.':'브라우저의 설치 또는 홈 화면에 추가 메뉴로 앱처럼 사용할 수 있습니다.';
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
  install.addEventListener('click',async()=>{
    if(!prompt)return;
    await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;
  });
  window.addEventListener('appinstalled',()=>{install.hidden=true;note.hidden=true;prompt=null;});
  if('serviceWorker' in navigator){
    let hadController=!!navigator.serviceWorker.controller,pendingReload=false,reloading=false;
    const refreshWhenIdle=()=>{
      const question=document.getElementById('chat-question'),answer=document.getElementById('chat-answer');
      // 작성 중인 질문·진행 중인 요청·읽고 있는 답변은 지우지 않습니다.
      if(!pendingReload||reloading||document.visibilityState==='hidden'||question?.disabled||question?.value.trim()||answer&&!answer.hidden)return;
      reloading=true;window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadController){pendingReload=true;refreshWhenIdle();}
      hadController=true;
    });
    navigator.serviceWorker.register('/service-worker.js').then(registration=>{
      const applyUpdate=()=>{registration.waiting?.postMessage({type:'SKIP_WAITING'});};
      applyUpdate();registration.addEventListener('updatefound',()=>{
        registration.installing?.addEventListener('statechange',applyUpdate);
      });
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible'){registration.update().catch(()=>{});refreshWhenIdle();}
      });
    }).catch(()=>{note.hidden=false;note.textContent='앱 설치 준비를 완료하지 못했습니다. 온라인에서 페이지를 새로고침해 주세요.';});
  }
})();
