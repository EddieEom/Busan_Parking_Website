const CACHE_NAME='busan-parking-v5-4';
const STATIC_FILES=['/','/index.html','/style.css','/app.js','/chat.js','/answer-renderer.js','/pwa.js','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(STATIC_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('busan-parking-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // 모든 API·POST·외부 요청은 네트워크에 맡깁니다. 실시간 데이터와 AI 답변을 저장하지 않습니다.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||!STATIC_FILES.includes(url.pathname))return;
  // 온라인에서는 최신 파일을 우선 사용하고 오프라인일 때만 앱 화면을 복원합니다.
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(request);
      if(response.ok)await cache.put(url.pathname,response.clone()).catch(()=>{});
      return response;
    }catch{
      return await cache.match(url.pathname)||new Response('인터넷 연결 후 다시 실행해 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
