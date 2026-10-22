// 화면 효과는 데이터 조회·GPS·음성 인식과 독립적으로 동작합니다.
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const clock=document.getElementById('city-clock');
const tick=()=>{if(clock){const now=new Date();clock.textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);clock.dateTime=now.toISOString();}};
tick();setInterval(tick,1000);
for(const counter of document.querySelectorAll('[data-count]')) {
  let frame=0,last=0;
  const animate=()=>{
    cancelAnimationFrame(frame);
    const target=Number(counter.getAttribute('data-count'));
    if(!Number.isFinite(target))return;
    if(reduced.matches){counter.textContent=target.toLocaleString('ko-KR');last=target;return;}
    const start=performance.now(),from=last;
    const draw=time=>{const t=Math.min((time-start)/650,1),value=Math.round(from+(target-from)*(1-(1-t)**3));counter.textContent=value.toLocaleString('ko-KR');if(t<1)frame=requestAnimationFrame(draw);else last=target;};
    frame=requestAnimationFrame(draw);
  };
  new MutationObserver(animate).observe(counter,{attributes:true,attributeFilter:['data-count']});
  animate();
}
document.addEventListener('click',event=>{
  const chip=event.target.closest('[data-query]');
  if(chip){const input=document.getElementById('chat-question');if(!input.disabled){input.value=chip.dataset.query;document.getElementById('chat-form').requestSubmit();}}
  const nearby=event.target.closest('[data-nearby]');
  if(nearby)document.getElementById('gps-button').click();
  const button=event.target.closest('button,.map-link');
  if(!button||button.disabled||reduced.matches)return;
  const rect=button.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*2;
  const ripple=document.createElement('span');ripple.className='ui-ripple';ripple.setAttribute('aria-hidden','true');
  Object.assign(ripple.style,{width:`${size}px`,height:`${size}px`,left:`${(event.clientX||rect.left+rect.width/2)-rect.left-size/2}px`,top:`${(event.clientY||rect.top+rect.height/2)-rect.top-size/2}px`});
  button.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
});
