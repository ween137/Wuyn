// حارس الإقلاع: إن لم يعمل التطبيق خلال 9 ثوانٍ ننظف الذاكرة المؤقتة ونعيد المحاولة، ثم نعرض سبب الخلل
(function () {
  var last = '', done = false;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  addEventListener('error', function (e) { if (!window.__booted && e && e.message) last = e.message; });
  addEventListener('unhandledrejection', function (e) { if (!window.__booted && e && e.reason) last = String(e.reason.message || e.reason); });
  function clean() {
    var p = [];
    try { if (navigator.serviceWorker) p.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })); } catch (e) { }
    try { if (window.caches) p.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) { }
    return Promise.all(p).catch(function () { });
  }
  setTimeout(function () {
    if (window.__booted || done) return; done = true;
    var tried = ''; try { tried = sessionStorage.getItem('g-tried') || ''; } catch (e) { }
    if (!tried) { try { sessionStorage.setItem('g-tried', '1'); } catch (e) { } clean().then(function () { location.reload(); }); return; }
    var a = document.getElementById('app'); if (!a) return;
    a.innerHTML = '<div class="splash"><div class="auth-logo">وين؟</div><p>تعذّر تشغيل التطبيق</p><p dir="ltr" style="font-size:12px;opacity:.7;max-width:90%;word-break:break-word">' + esc(last || 'لم يكتمل التحميل (تحقق من الاتصال أو VPN)') + '</p><button class="btn" id="g-rl">إعادة المحاولة</button></div>';
    document.getElementById('g-rl').onclick = function () { try { sessionStorage.removeItem('g-tried'); } catch (e) { } clean().then(function () { location.reload(); }); };
  }, 9000);
})();
