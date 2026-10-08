(() => {
  const install=document.getElementById('install-app'),note=document.getElementById('install-note'),update=document.getElementById('update-app');
  let prompt=null,waiting=null;
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
    navigator.serviceWorker.register('/service-worker.js').then(registration=>{
      const showUpdate=()=>{waiting=registration.waiting;if(waiting&&navigator.serviceWorker.controller)update.hidden=false;};
      showUpdate();registration.addEventListener('updatefound',()=>{
        registration.installing?.addEventListener('statechange',showUpdate);
      });
    }).catch(()=>{note.hidden=false;note.textContent='앱 설치 준비를 완료하지 못했습니다. 온라인에서 페이지를 새로고침해 주세요.';});
    let refreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)window.location.reload();});
    update.addEventListener('click',()=>{if(waiting){refreshing=true;waiting.postMessage({type:'SKIP_WAITING'});}});
  }
})();
