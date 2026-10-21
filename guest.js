// وضع الضيف: تصفح الخريطة والسيارات المتاحة فقط، دون أي طلب أو بيانات شخصية
import { esc, errMsg, toast } from './utils.js';
import { ic } from './icons.js';
import { buildShell } from './shell.js';
import { createMap, YABROUD } from './map.js';
import { ensureLeaflet } from './loader.js';
import { taxiCard, openDirectory } from './directory.js';

export function mountGuest({ app, db, goLogin }) {
  let map = null, timer = null, pane = null, alive = true, taxis = [], dir = [], sel = null;
  const SUPPORT = '0933712979';
  buildShell(app, {
    subtitle: 'ضيف · تصفّح فقط', start: 'map',
    right: `<button class="tab" id="g-login">دخول</button>`,
    tabs: [['map', 'الخريطة', 'home'], ['about', 'عن الخدمة', 'info']],
    onShow: (id, p, first) => {
      if (id === 'map') { if (first) initMap(p); else map?.fix(); }
      else if (first) p.innerHTML = `<div class="page"><h2 class="ph">وين؟ تكسي يبرود</h2>
        <div class="card"><b>كيف تعمل الخدمة؟</b><ol class="how"><li>تنشئ حساباً وتوثّق هويتك مرة واحدة.</li><li>تحدد الانطلاق والوجهة وتختار خياراتك.</li><li>تصلك أسعار المكاتب والسائقين وتختار الأنسب.</li><li>تتابع السيارة على الخريطة وتراسل السائق.</li></ol></div>
        <div class="guest-note">${ic('lock', 20)}<span>كضيف يمكنك التصفح فقط. لطلب رحلة أنشئ حساباً.</span></div>
        <div class="guest-cta"><button class="btn big" data-g="register">إنشاء حساب</button><button class="btn light big" data-g="login">تسجيل الدخول</button></div>
        <p class="center small" style="margin-top:14px">للدعم: <a href="tel:${SUPPORT}" dir="ltr">${SUPPORT}</a></p></div>`;
      if (first && id === 'about') p.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) goLogin(b.dataset.g); });
    },
  });
  app.querySelector('#g-login').onclick = () => goLogin('login');

  function initMap(p) {
    pane = p;
    p.innerHTML = `<div class="stage"><div class="map-full" id="gmap"></div><div class="sheet" id="gsheet"></div></div>`;
    draw();
    p.querySelector('#gsheet').addEventListener('click', e => {
      const b = e.target.closest('[data-g],[data-act]'); if (!b) return; if (b.dataset.g) return goLogin(b.dataset.g);
      const a = b.dataset.act;
      if (a === 'dir') openDirectory(dir, t => { sel = t; if (t.state === 'live' && t.lat != null) map?.flyTo([t.lat, t.lng], 16); draw(); });
      else if (a === 'tclose') { sel = null; draw(); } else if (a === 'tlocate') { const t = dir.find(x => x.k === b.dataset.k); if (t?.lat != null) map?.flyTo([t.lat, t.lng], 17); }
    });
    ensureLeaflet().then(() => {
      if (!alive) return; map = createMap(p.querySelector('#gmap'), { center: YABROUD, zoom: 14 }); load();
      timer = setInterval(() => { if (!document.hidden) load(); }, 12000);
    }).catch(e => { p.querySelector('#gmap').innerHTML = `<p class="center pad">${esc(errMsg(e))}</p>`; });
  }
  async function load() {
    const c = map.center(); const { data, error } = await db.rpc('taxi_directory', { p_lat: c[0], p_lng: c[1] });
    if (error) return; dir = data || []; taxis = dir.filter(t => t.state === 'live' && t.lat != null); if (sel) sel = dir.find(t => t.k === sel.k) || null;
    map.syncCars(taxis, t => { sel = dir.find(x => x.k === t.k) || t; draw(); }); draw();
  }
  function draw() {
    const el = pane?.querySelector('#gsheet'); if (!el) return; const n = taxis.length;
    if (sel) { el.innerHTML = `<div class="handle"></div>${taxiCard(sel)}`; return; }
    el.innerHTML = `<div class="handle"></div><div class="guest-note">${ic('eye', 20)}<span>أنت تتصفح كضيف. لا يمكنك طلب رحلة قبل إنشاء حساب.</span></div>
      <p class="avail">${n ? `<i class="live-dot"></i> ${n} ${n === 1 ? 'سيارة متاحة' : 'سيارات متاحة'} الآن` : 'لا توجد سيارات ظاهرة الآن'}</p>
      <button class="dirbtn" data-act="dir">${ic('users', 18)} المكاتب والسائقون (${dir.length})</button>
      <div class="guest-cta"><button class="btn" data-g="register">إنشاء حساب</button><button class="btn light" data-g="login">دخول</button></div>`;
  }
  return () => { alive = false; clearInterval(timer); map?.destroy(); };
}
