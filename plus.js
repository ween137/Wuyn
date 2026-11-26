// تحديث «وين؟» الكبير: الشعار، قائمة الخدمات، شريط الإعلانات، إدارة الإعلانات، الإعدادات، السيارات التزيينية، واجهة المحلات
// ملف مستقل: يضيف نفسه إلى التطبيق دون تعديل بقية الملفات.
import { esc, toast, toggleTheme } from './utils.js';
import { openLegal } from './legal.js';

try { if (!document.getElementById('plus-css')) { const l = document.createElement('link'); l.id = 'plus-css'; l.rel = 'stylesheet'; l.href = '/plus.css'; document.head.appendChild(l); } } catch { }

/* ---------- أدوات ---------- */
const P = {
  car: '<path d="M4 15v-3l2-5h12l2 5v3"/><path d="M3 15h18v3H3z"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/>',
  box: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  truck: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4.2l2.8 3v3h-7z"/><circle cx="7" cy="17.6" r="1.9"/><circle cx="16.8" cy="17.6" r="1.9"/>',
  bus: '<rect x="4" y="3.5" width="16" height="14" rx="3"/><path d="M4 11h16M8 21v-3.5M16 21v-3.5"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-5h4v5"/>',
  office: '<path d="M4 21V5l8-2 8 2v16"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M10.5 21v-5h3v5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  back: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  mega: '<path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', text: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>', zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>', check: '<path d="M5 12l5 5 9-10"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  vib: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4 8v8M20 8v8"/>', list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const ic = (n, s = 22) => `<svg class="pl-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
const lget = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
function token() { try { const k = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k)); if (!k) return null; const j = JSON.parse(localStorage.getItem(k)); return j?.access_token || j?.currentSession?.access_token || null; } catch { return null; } }
async function rpc(name, args = {}) {
  const C = window.WEIN_CONFIG || {}; const t = token();
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (t || C.SUPABASE_ANON_KEY) }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.message || 'تعذّر تنفيذ الطلب');
  return j;
}
function layer(title, right = '') {
  const el = document.createElement('div'); el.className = 'overlay pl';
  el.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back')}</button><div class="ttl">${esc(title)}</div>${right || '<span style="width:40px"></span>'}</header><div class="pl-body"></div>`;
  document.body.appendChild(el); el.querySelector('[data-x]').onclick = () => el.remove();
  return { el, body: el.querySelector('.pl-body'), close: () => el.remove(), alive: () => el.isConnected };
}
const buzz = () => { try { if (S.get('vib') !== '0') navigator.vibrate?.(12); } catch { } };

/* ---------- الإعدادات (محفوظة على الجهاز) ---------- */
const S = {
  d: (() => { try { return JSON.parse(lget('wn-set', '{}')) || {}; } catch { return {}; } })(),
  get(k) { return this.d[k] ?? ({ size: '1', cars: '1', vib: '1', motion: '1', ads: '1', dvk: 'taxi' })[k]; },
  set(k, v) { this.d[k] = v; lset('wn-set', JSON.stringify(this.d)); applySettings(); },
};
function applySettings() {
  const h = document.documentElement; h.dataset.size = S.get('size');
  h.classList.toggle('pl-nomotion', S.get('motion') === '0');
  const th = S.get('theme');
  if (th === 'auto') { const dark = matchMedia('(prefers-color-scheme: dark)').matches; document.body.classList.toggle('dark', dark); lset('ween-theme', dark ? 'dark' : 'light'); }
  carsToggle();
}

/* ---------- الشعار والأيقونات ---------- */
function brandInit() {
  const head = document.head;
  const setLink = (rel, href, extra = {}) => { let l = head.querySelector(`link[rel="${rel}"]`); if (!l) { l = document.createElement('link'); l.rel = rel; head.appendChild(l); } l.href = href; Object.entries(extra).forEach(([k, v]) => l.setAttribute(k, v)); };
  setLink('manifest', '/wein.webmanifest'); setLink('icon', '/favicon-32.png', { type: 'image/png' }); setLink('apple-touch-icon', '/icon-180.png');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000');
}
function swapLogos(root = document) {
  root.querySelectorAll?.('.auth-logo:not(.pl-done),.logo:not(.pl-done),.splash .logo:not(.pl-done)').forEach(e => {
    if (e.querySelector('img')) return; e.classList.add('pl-done'); e.innerHTML = '<img class="pl-logo" src="/logo-w.png" alt="وين" draggable="false">';
    if (!e.classList.contains('auth-logo')) e.classList.add('pl-hdr-logo');
  });
}

/* ---------- الإعلانات: شريط في الأعلى ---------- */
const AD = { list: [], i: 0, timer: null, closed: false };
async function loadAds() {
  try { AD.list = (await rpc('ads_active')) || []; } catch { AD.list = []; }
  AD.i = 0; drawAd();
}
function drawAd() {
  let bar = document.querySelector('.pl-ad');
  const host = document.querySelector('.shell .body'); const cust = !!document.querySelector('#sheet');
  if (!AD.list.length || AD.closed || !host || !cust || S.get('ads') === '0') { bar?.remove(); clearInterval(AD.timer); AD.timer = null; return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'pl-ad'; host.appendChild(bar); }
  const a = AD.list[AD.i % AD.list.length];
  bar.innerHTML = `${a.image ? `<img src="${esc(a.image)}" alt="">` : `<span class="pl-ad-i">${ic('mega', 24)}</span>`}<div class="pl-ad-t"><b>${esc(a.title)}</b>${a.body ? `<small>${esc(a.body)}</small>` : ''}</div>${a.link ? `<span class="pl-ad-go">${esc(a.link_label || 'افتح')}</span>` : ''}<button class="pl-ad-x" aria-label="إغلاق">${ic('x', 16)}</button>${AD.list.length > 1 ? `<div class="pl-ad-d">${AD.list.map((_, i) => `<i class="${i === AD.i % AD.list.length ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
  bar.onclick = e => {
    if (e.target.closest('.pl-ad-x')) { AD.closed = true; drawAd(); return; }
    if (a.link) { rpc('ads_click', { p_id: a.id }).catch(() => { }); window.open(a.link, '_blank', 'noopener'); }
  };
  bar.classList.toggle('link', !!a.link);
  if (!AD.timer && AD.list.length > 1) AD.timer = setInterval(() => { AD.i++; drawAd(); }, 6000);
}

/* ---------- إدارة الإعلانات (للأدمن) ---------- */
let isAdmin = null;
async function checkAdmin() { if (isAdmin !== null || !token()) return; isAdmin = false; try { await rpc('admin_ads'); isAdmin = true; } catch { isAdmin = false; } if (isAdmin) ensureFab(); }
function fileToJpeg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      let w = Math.min(900, im.width), h = Math.round(im.height * w / im.width); const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
      let q = .8, out = c.toDataURL('image/jpeg', q); while (out.length > 330000 && q > .3) { q -= .1; out = c.toDataURL('image/jpeg', q); }
      out.length > 340000 ? rej(new Error('الصورة كبيرة جداً، اختر صورة أصغر')) : res(out);
    };
    im.onerror = () => rej(new Error('تعذّر قراءة الصورة')); im.src = url;
  });
}
function openAdsAdmin() {
  if (document.querySelector('.overlay.pl-ads')) return;
  const L = layer('إعلانات التطبيق', `<button class="icon-btn" id="add" aria-label="إعلان جديد">${ic('plus')}</button>`); L.el.classList.add('pl-ads');
  let list = [];
  const draw = () => {
    L.body.innerHTML = list.length ? list.map(a => `<div class="pl-card pl-adm ${a.running ? '' : 'off'}">${a.image ? `<img src="${esc(a.image)}" alt="">` : ''}<div class="g"><b>${esc(a.title)}</b><small>${esc(a.body || '')}</small>
      <small class="m">${a.running ? '🟢 يعمل الآن' : (a.active ? '⏰ منتهٍ' : '⏸ متوقف')} · نقرات: ${a.clicks ?? 0} · ينتهي: ${a.ends_at ? new Date(a.ends_at).toLocaleDateString('ar') : '—'}</small></div>
      <div class="pl-row"><button class="btn light" data-e="${a.id}">تعديل</button><button class="btn light" data-t="${a.id}">${a.active ? 'إيقاف' : 'تشغيل'}</button><button class="btn light" data-a="${a.id}">أرشفة</button></div></div>`).join('') : '<div class="pl-empty">لا توجد إعلانات بعد.<br>اضغط + لإضافة أول إعلان.</div>';
    L.body.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(list.find(x => x.id == b.dataset.e)));
    L.body.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => { const a = list.find(x => x.id == b.dataset.t); try { await rpc('admin_set_ad', { p_id: a.id, p_active: !a.active, p_archive: false }); load(); } catch (e) { toast(e.message, 'err'); } });
    L.body.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { if (!confirm('أرشفة هذا الإعلان؟ سيختفي من القائمة.')) return; try { await rpc('admin_set_ad', { p_id: +b.dataset.a, p_active: false, p_archive: true }); load(); } catch (e) { toast(e.message, 'err'); } });
  };
  async function load() { try { list = (await rpc('admin_ads')) || []; draw(); loadAds(); } catch (e) { L.body.innerHTML = `<div class="pl-empty">${esc(e.message)}</div>`; } }
  function form(a) {
    const F = layer(a ? 'تعديل إعلان' : 'إعلان جديد'); let img = a?.image || '';
    F.body.innerHTML = `<form class="pl-form"><div class="pl-pic" id="pic">${img ? `<img src="${esc(img)}">` : ic('image', 36) + '<span>اضغط لاختيار صورة</span>'}</div><input type="file" accept="image/*" id="file" hidden>
      <label><span>العنوان</span><input name="t" maxlength="60" required value="${esc(a?.title || '')}" placeholder="مثال: خصم 20% على التوصيل"></label>
      <label><span>الوصف (اختياري)</span><textarea name="b" maxlength="140" rows="2" placeholder="سطر قصير يظهر تحت العنوان">${esc(a?.body || '')}</textarea></label>
      <label><span>رابط عند الضغط (اختياري)</span><input name="l" dir="ltr" inputmode="url" placeholder="https://..." value="${esc(a?.link || '')}"></label>
      <label><span>نص الزر</span><input name="lb" maxlength="20" placeholder="افتح" value="${esc(a?.link_label || '')}"></label>
      <div class="pl-row2"><label><span>المدة (أيام)</span><input name="d" type="number" min="1" max="365" value="7" inputmode="numeric"></label><label><span>الترتيب</span><input name="s" type="number" value="${a?.sort ?? 0}" inputmode="numeric"></label></div>
      <label class="pl-chk"><input type="checkbox" name="ac" ${a ? (a.active ? 'checked' : '') : 'checked'}> يعمل مباشرة</label>
      <p class="auth-msg" id="msg"></p><button class="btn full big" type="submit">حفظ الإعلان</button></form>`;
    const f = F.body.querySelector('form'), msg = F.body.querySelector('#msg');
    F.body.querySelector('#pic').onclick = () => F.body.querySelector('#file').click();
    F.body.querySelector('#file').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { img = await fileToJpeg(file); F.body.querySelector('#pic').innerHTML = `<img src="${img}">`; msg.textContent = ''; } catch (x) { msg.textContent = x.message; msg.className = 'auth-msg err show'; } };
    f.onsubmit = async ev => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      let link = f.l.value.trim(); if (link && !/^https:\/\//i.test(link)) link = 'https://' + link;
      try { await rpc('admin_save_ad', { p_id: a?.id ?? null, p_title: f.t.value.trim(), p_body: f.b.value.trim() || null, p_image: img || null, p_link: link || null, p_label: f.lb.value.trim() || null, p_days: Math.max(1, parseInt(f.d.value) || 7), p_active: f.ac.checked, p_sort: parseInt(f.s.value) || 0 }); toast('تم حفظ الإعلان', 'ok'); F.close(); load(); }
      catch (x) { msg.textContent = x.message; msg.className = 'auth-msg err show'; btn.disabled = false; }
    };
  }
  L.el.querySelector('#add').onclick = () => form(null);
  load();
}
window.openAdsAdmin = openAdsAdmin;
function ensureFab() {
  if (!isAdmin || document.querySelector('.pl-fab')) return;
  const b = document.createElement('button'); b.className = 'pl-fab'; b.setAttribute('aria-label', 'الإعلانات'); b.innerHTML = ic('mega', 24); b.onclick = openAdsAdmin; document.body.appendChild(b);
}

/* ---------- واجهة المحلات ---------- */
function openShop() {
  if (document.querySelector('.overlay.pl-shop')) return;
  const L = layer('المحلات والشحن'); L.el.classList.add('pl-shop');
  const draw = () => {
    const name = lget('cargo-shop'), pick = lget('cargo-pick'), ph = lget('wn-shop-phone');
    L.body.innerHTML = `<div class="pl-hero">${ic('shop', 40)}<h2>${name ? esc(name) : 'محلّك على «وين؟»'}</h2><p>أرسل بضاعة محلّك إلى أي مدينة، واستلم رمزاً للمستلم، واتابع شحناتك.</p></div>
      <button class="btn full big" id="ship">${ic('truck', 20)} شحن بضاعة جديدة</button>
      <button class="btn light full" id="mine">${ic('box', 20)} شحناتي وحالتها</button>
      <button class="btn light full" id="dlv">${ic('car', 20)} توصيل طلب داخل يبرود</button>
      <form class="pl-form pl-card" id="pf"><b>بيانات محلّك (تُحفظ على جهازك وتُملأ تلقائياً)</b>
        <label><span>اسم المحل</span><input name="n" maxlength="60" value="${esc(name)}" placeholder="مثال: ملابس الأمل"></label>
        <label><span>هاتف المحل</span><input name="p" dir="ltr" inputmode="tel" value="${esc(ph)}" placeholder="09xxxxxxxx"></label>
        <label><span>عنوان الاستلام (من أين يأخذ السائق البضاعة)</span><input name="a" maxlength="120" value="${esc(pick)}" placeholder="الشارع، قرب…"></label>
        <button class="btn light full" type="submit">حفظ بيانات المحل</button></form>
      <div class="pl-tips"><b>كيف يعمل؟</b><ol><li>اضغط «شحن بضاعة جديدة» واختر الرحلة.</li><li>اكتب بيانات المستلم والوزن.</li><li>تحصل على رمز تسليم ترسله للمستلم عبر واتساب.</li><li>الدفع نقداً عند التسليم.</li></ol></div>`;
    L.body.querySelector('#ship').onclick = () => { L.close(); window.openCargo?.(); };
    L.body.querySelector('#mine').onclick = () => { L.close(); window.openCargo?.(); setTimeout(() => document.querySelector('.cg-main [data-t=mine]')?.click(), 60); };
    L.body.querySelector('#dlv').onclick = () => { L.close(); document.querySelector('[data-act=start][data-kind=delivery]')?.click(); };
    L.body.querySelector('#pf').onsubmit = e => { e.preventDefault(); const f = e.target; lset('cargo-shop', f.n.value.trim()); lset('wn-shop-phone', f.p.value.trim()); lset('cargo-pick', f.a.value.trim()); toast('تم حفظ بيانات المحل', 'ok'); draw(); };
  };
  draw();
}
window.openShop = openShop;

/* ---------- قائمة الخدمات (الرئيسية) ---------- */
const SERVICES = [
  ['taxi', 'car', 'اطلب سيارة', 'تنقّل داخل يبرود', () => document.querySelector('[data-act=start][data-kind=taxi]')?.click()],
  ['dlv', 'zap', 'توصيل طلب', 'متور أو سيارة', () => document.querySelector('[data-act=start][data-kind=delivery]')?.click()],
  ['cargo', 'truck', 'شحن البضائع', 'شاحنات بين المدن', () => window.openCargo?.()],
  ['bus', 'bus', 'حجز باص', 'رحلات بين المدن', () => window.openBuses?.()],
  ['shop', 'shop', 'المحلات', 'شحن بضاعة محلّك', () => openShop()],
];
function hubHtml() {
  const ord = S.get('dvk') === 'delivery' ? [SERVICES[1], SERVICES[0], ...SERVICES.slice(2)] : SERVICES;
  return `<div class="pl-hub"><div class="pl-hub-h"><b>الخدمات</b><small>اختر ما تحتاجه</small></div>` + ord.map(s => `<button class="pl-svc" data-s="${s[0]}"><span class="pl-svc-i">${ic(s[1], 26)}</span><span class="g"><b>${s[2]}</b><small>${s[3]}</small></span><span class="pl-svc-a">${ic('back', 18)}</span></button>`).join('') + `</div>`;
}
/* customer.js يرسم القائمة بنفسه داخل الورقة (بلا وميض)، وplus.js يستدعي الدالتين فقط */
window.plHubHtml = hubHtml;
window.plService = k => { buzz(); SERVICES.find(s => s[0] === k)?.[4](); };
function hubInit() {
  const sheet = document.querySelector('#sheet'); if (!sheet) return;
  const svc = sheet.querySelector('.svc'); if (!svc) return;
  if (sheet.querySelector('.pl-hub')) { svc.classList.add('pl-hidden'); return; }
  /* احتياط فقط: إن لم يرسمها customer.js */
  svc.insertAdjacentHTML('afterend', hubHtml());
  svc.classList.add('pl-hidden');
  sheet.querySelector('.pl-hub').onclick = e => { const b = e.target.closest('[data-s]'); if (b) window.plService(b.dataset.s); };
}

/* ---------- شاشة الإعدادات ---------- */
function openSettings() {
  if (document.querySelector('.overlay.pl-set')) return;
  const L = layer('الإعدادات'); L.el.classList.add('pl-set');
  const seg = (k, opts) => `<div class="pl-seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(S.get(k)) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const sw = (k, ico, t, d) => `<div class="pl-opt">${ic(ico, 22)}<span class="g"><b>${t}</b><small>${d}</small></span><label class="pl-sw"><input type="checkbox" data-sw="${k}" ${S.get(k) !== '0' ? 'checked' : ''}><i></i></label></div>`;
  const dark = document.body.classList.contains('dark');
  L.body.innerHTML = `
    <h4 class="pl-sec">المظهر</h4>
    <div class="pl-card"><div class="pl-opt">${ic('moon', 22)}<span class="g"><b>المظهر</b><small>فاتح، ليلي، أو حسب الجهاز</small></span></div>${seg('theme', [['light', 'فاتح'], ['dark', 'ليلي'], ['auto', 'تلقائي']])}
      <div class="pl-opt">${ic('text', 22)}<span class="g"><b>حجم الخط</b><small>كبّر النصوص لتسهيل القراءة</small></span></div>${seg('size', [['0', 'صغير'], ['1', 'عادي'], ['2', 'كبير'], ['3', 'كبير جداً']])}
      ${sw('motion', 'zap', 'الحركات والانتقالات', 'أوقفها لتوفير البطارية')}</div>
    <h4 class="pl-sec">الخريطة والطلبات</h4>
    <div class="pl-card">${sw('cars', 'car', 'سيارات تزيينية على الخريطة', 'للجمال فقط، وليست سيارات حقيقية')}
      <div class="pl-opt">${ic('pin', 22)}<span class="g"><b>الخدمة المفضّلة</b><small>أي خدمة تظهر أولاً</small></span></div>${seg('dvk', [['taxi', 'سيارة'], ['delivery', 'توصيل']])}
      ${sw('vib', 'vib', 'الاهتزاز عند اللمس', 'ردّ فعل خفيف عند الضغط على الأزرار')}
      ${sw('ads', 'mega', 'شريط الإعلانات', 'عرض إعلانات التطبيق في أعلى الشاشة')}</div>
    <h4 class="pl-sec">الإشعارات والتثبيت</h4>
    <div class="pl-card"><button class="pl-opt btn-like" id="notif">${ic('bell', 22)}<span class="g"><b>تفعيل الإشعارات</b><small id="ns">${'Notification' in window ? (Notification.permission === 'granted' ? 'مفعّلة ✅' : Notification.permission === 'denied' ? 'محظورة من إعدادات المتصفح' : 'اضغط للسماح') : 'غير مدعومة على هذا الجهاز'}</small></span></button>
      <button class="pl-opt btn-like" id="inst">${ic('down', 22)}<span class="g"><b>تثبيت التطبيق على الشاشة الرئيسية</b><small>يعمل كتطبيق كامل</small></span></button></div>
    <h4 class="pl-sec">الخدمات</h4>
    <div class="pl-card"><button class="pl-opt btn-like" data-go="shop">${ic('shop', 22)}<span class="g"><b>واجهة المحلات</b><small>شحن بضاعة محلّك</small></span></button>
      <button class="pl-opt btn-like" data-go="cargo">${ic('truck', 22)}<span class="g"><b>شحناتي</b><small>تتبّع شحناتك</small></span></button>
      <button class="pl-opt btn-like" data-go="bus">${ic('bus', 22)}<span class="g"><b>حجوزات الباصات</b><small>ابحث واحجز مقعدك</small></span></button>
      ${isAdmin ? `<button class="pl-opt btn-like" data-go="ads">${ic('mega', 22)}<span class="g"><b>إدارة الإعلانات</b><small>للأدمن فقط</small></span></button>` : ''}</div>
    <h4 class="pl-sec">القانونية</h4>
    <div class="pl-card"><button class="pl-opt btn-like" data-lg="terms">${ic('info', 22)}<span class="g"><b>الشروط والأحكام</b></span></button>
      <button class="pl-opt btn-like" data-lg="privacy">${ic('eye', 22)}<span class="g"><b>سياسة الخصوصية</b></span></button>
      <button class="pl-opt btn-like" data-lg="aup">${ic('check', 22)}<span class="g"><b>الاستخدام المقبول</b></span></button></div>
    <h4 class="pl-sec">الدعم والبيانات</h4>
    <div class="pl-card"><a class="pl-opt btn-like" href="tel:+963933712979">${ic('phone', 22)}<span class="g"><b>اتصل بالدعم</b><small>+963 933 712 979</small></span></a>
      <button class="pl-opt btn-like" id="refresh">${ic('zap', 22)}<span class="g"><b>تحديث التطبيق</b><small>مسح الذاكرة المؤقتة وجلب أحدث نسخة</small></span></button>
      <button class="pl-opt btn-like" id="reset">${ic('trash', 22)}<span class="g"><b>إعادة الإعدادات</b><small>يرجع كل شيء كما كان (لا يحذف حسابك)</small></span></button></div>
    <p class="pl-ver">«وين؟» · يبرود · الإصدار 5</p>`;
  L.body.querySelectorAll('.pl-seg').forEach(g => g.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; buzz(); const k = g.dataset.k, v = b.dataset.v;
    g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (k === 'theme') { if (v === 'auto') S.set('theme', 'auto'); else { S.set('theme', v); const d = document.body.classList.contains('dark'); if ((v === 'dark') !== d) toggleTheme(); } } else S.set(k, v);
  });
  L.body.querySelectorAll('[data-sw]').forEach(i => i.onchange = () => { S.set(i.dataset.sw, i.checked ? '1' : '0'); if (i.dataset.sw === 'ads') drawAd(); });
  L.body.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => openLegal(b.dataset.lg));
  L.body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { L.close(); ({ shop: openShop, cargo: () => window.openCargo?.(), bus: () => window.openBuses?.(), ads: openAdsAdmin })[b.dataset.go](); });
  L.body.querySelector('#notif').onclick = async () => { if (!('Notification' in window)) return; try { const r = await Notification.requestPermission(); L.body.querySelector('#ns').textContent = r === 'granted' ? 'مفعّلة ✅' : 'لم يتم السماح'; } catch { } };
  L.body.querySelector('#inst').onclick = async () => { if (deferred) { deferred.prompt(); deferred = null; } else toast('من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 'ok'); };
  L.body.querySelector('#refresh').onclick = async () => { try { (await navigator.serviceWorker?.getRegistrations?.())?.forEach(r => r.unregister()); (await caches?.keys?.())?.forEach(k => caches.delete(k)); } catch { } toast('جارٍ التحديث…', 'ok'); setTimeout(() => location.reload(), 600); };
  L.body.querySelector('#reset').onclick = () => { if (!confirm('إعادة كل الإعدادات؟')) return; try { localStorage.removeItem('wn-set'); } catch { } S.d = {}; applySettings(); L.close(); toast('تمت إعادة الإعدادات', 'ok'); };
}
window.openSettings = openSettings;
let deferred = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });

function injectSettingsRow() {
  const menu = document.querySelector('.menu'); if (!menu || menu.querySelector('.pl-menu-row')) return;
  const b = document.createElement('button'); b.className = 'menu-row pl-menu-row'; b.innerHTML = `${ic('gear', 22)}<span class="grow">الإعدادات</span>`; b.onclick = openSettings; menu.prepend(b);
}

/* ---------- سيارات تزيينية على الخريطة ---------- */
let LMap = null, cars = [], carTimer = null, carsBusy = false;
(function trapLeaflet() {
  const hook = L => { try { L.Map.addInitHook(function () { LMap = this; setTimeout(carsInit, 400); }); } catch { } };
  if (window.L?.Map) { hook(window.L); return; }
  let val; try {
    Object.defineProperty(window, 'L', { configurable: true, get: () => val, set: v => { val = v; if (v?.Map) hook(v); } });
  } catch { }
})();
const CAR_SVG = '<svg viewBox="0 0 24 40" width="22" height="36"><rect x="3" y="2" width="18" height="36" rx="7" fill="#111" stroke="#fff" stroke-width="1.6"/><rect x="6" y="9" width="12" height="7" rx="2" fill="#9fb4c7"/><rect x="6" y="25" width="12" height="5" rx="2" fill="#9fb4c7"/><rect x="8" y="4" width="8" height="2" rx="1" fill="#c9a24a"/></svg>';
async function carsInit() {
  if (carsBusy || !LMap || !window.L || cars.length || S.get('cars') === '0') return; carsBusy = true;
  try {
    const c = LMap.getCenter(); let dir = [];
    try { dir = (await rpc('directory_v2', { p_lat: c.lat, p_lng: c.lng })) || []; } catch { }
    let offices = dir.filter(x => x.role === 'office');
    if (!offices.length) offices = [{ name: 'مكتب تكسي يبرود', state: 'live' }, { name: 'مكتب الأمين', state: 'offline' }, { name: 'مكتب النور', state: 'live' }];
    const n = Math.min(7, Math.max(4, offices.length)); const base = [33.9675, 36.6575];
    for (let i = 0; i < n; i++) {
      const o = offices[i % offices.length];
      const car = { o, lat: base[0] + (Math.random() - .5) * .014, lng: base[1] + (Math.random() - .5) * .016, h: Math.random() * 360, v: .00002 + Math.random() * .00002 };
      car.m = L.marker([car.lat, car.lng], { icon: L.divIcon({ className: 'pl-car', html: `<div class="pl-car-i">${CAR_SVG}</div>`, iconSize: [22, 36], iconAnchor: [11, 18] }), zIndexOffset: -500, keyboard: false }).addTo(LMap);
      car.m.on('click', () => {
        const open = car.o.state === 'live';
        L.popup({ closeButton: false, className: 'pl-pop', offset: [0, -14] }).setLatLng([car.lat, car.lng]).setContent(`<div class="pl-pop-i"><b>${esc(car.o.name || 'مكتب')}</b><span class="${open ? 'ok' : 'bad'}">${open ? '● مفتوح' : '● مغلق'}</span><small>تمثيل توضيحي</small></div>`).openOn(LMap);
      });
      cars.push(car);
    }
    clearInterval(carTimer); carTimer = setInterval(stepCars, 140);
  } finally { carsBusy = false; }
}
function stepCars() {
  if (!LMap || !LMap._container?.isConnected) { clearInterval(carTimer); carTimer = null; cars.forEach(c => c.m.remove()); cars = []; LMap = null; return; }
  const base = [33.9675, 36.6575];
  for (const c of cars) {
    if (Math.random() < .04) c.h += (Math.random() - .5) * 110;
    const dx = c.lat - base[0], dy = c.lng - base[1];
    if (Math.hypot(dx * 1.1, dy) > .011) { const back = Math.atan2(-dx, -dy) * 180 / Math.PI; c.h = back; }
    const r = c.h * Math.PI / 180; c.lat += Math.cos(r) * c.v; c.lng += Math.sin(r) * c.v * 1.15;
    c.m.setLatLng([c.lat, c.lng]); const el = c.m.getElement()?.firstChild; if (el) el.style.transform = `rotate(${180 - c.h}deg)`;
  }
}
function carsToggle() {
  const on = S.get('cars') !== '0';
  cars.forEach(c => { const el = c.m.getElement(); if (el) el.style.display = on ? '' : 'none'; });
  if (on && LMap && !cars.length) carsInit();
}

/* ---------- المراقب ---------- */
let t0 = 0;
function tick() { clearTimeout(t0); t0 = setTimeout(() => { swapLogos(); hubInit(); injectSettingsRow(); if (!AD.loaded && document.querySelector('#sheet')) { AD.loaded = true; loadAds(); } else if (document.querySelector('#sheet') && !document.querySelector('.pl-ad') && AD.list.length && !AD.closed) drawAd(); checkAdmin(); }, 120); }
brandInit(); applySettings();
new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
tick();
document.addEventListener('click', e => { if (e.target.closest('button,.btn')) buzz(); }, true);
