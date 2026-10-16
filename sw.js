// الشبكة أولاً حتى تصل التحديثات فوراً، والذاكرة المؤقتة احتياط عند انقطاع الإنترنت
const CACHE='ween-static-v2';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
    return r;
  }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/index.html'))));
});
