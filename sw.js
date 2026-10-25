const V = 'ween-v6';
const LIBS = /^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com)\//;
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    // كود التطبيق: الشبكة أولاً (مهلة 3 ثوانٍ) ثم النسخة المحفوظة
    e.respondWith((async () => {
      const cache = await caches.open(V), hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
      // إن وُجدت نسخة محفوظة ننتظر الشبكة 3 ثوانٍ فقط؛ وإلا ننتظرها بلا حد
      if (hit) return Promise.race([net, new Promise(res => setTimeout(() => res(hit), 8000))]).catch(() => hit);
      try { return await net; } catch { return req.mode === 'navigate' ? (await cache.match('/index.html')) || Response.error() : Response.error(); }
    })());
  } else if (LIBS.test(req.url)) {
    // المكتبات الخارجية: من الذاكرة فوراً وتحديث بالخلفية
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(req); const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; }));
  }
});
