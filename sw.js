const V = 'ween-v13';
const LIBS = /^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com)\//;
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    // كود التطبيق: الشبكة دائماً (بلا خلط نسخ). الذاكرة المحفوظة فقط عند انقطاع الإنترنت.
    e.respondWith((async () => {
      const cache = await caches.open(V);
      try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) cache.put(req, r.clone()); return r; }
      catch { return (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match('/index.html') : null) || Response.error(); }
    })());
  } else if (LIBS.test(req.url)) {
    // المكتبات الخارجية: من الذاكرة فوراً وتحديث بالخلفية
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(req); const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; }));
  }
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow('/'))); });
