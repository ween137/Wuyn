// مكاتب التكسي: لوحة المكتب (سائقون وطلبات وإحصاءات) + إدارة المكاتب للأدمن
// يحتاج cargo.css (موجود).
import { esc, toast } from './utils.js';
try { if (!document.getElementById('cargo-css')) { const l = document.createElement('link'); l.id = 'cargo-css'; l.rel = 'stylesheet'; l.href = '/cargo.css'; document.head.appendChild(l); } } catch { }

/* ---------- أيقونات ---------- */
const P = {
  truck: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4.2l2.8 3v3h-7z"/><circle cx="7" cy="17.6" r="1.9"/><circle cx="16.8" cy="17.6" r="1.9"/>',
  box: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  scale: '<path d="M12 4v16M6 20h12"/><path d="M5 8h14"/><path d="M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  check: '<path d="M5 12l5 5 9-10"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z"/>', list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>', arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};
const ic = (n, s = 20, c = '') => `<svg class="ic ${c}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------- اتصال (REST مباشر بجلسة التطبيق، بدون عميل ثانٍ) ---------- */
const cfg = () => window.WEIN_CONFIG || {};
function token() { try { const k = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k)); if (!k) return null; const j = JSON.parse(localStorage.getItem(k)); return j?.access_token || j?.currentSession?.access_token || null; } catch { return null; } }
const ERR = m => {
  m = String(m || '');
  if (/no_driver/.test(m)) return 'لا يوجد سائق بهذا الرقم.';
  if (/bad_driver/.test(m)) return 'هذا الحساب ليس حساب سائق.';
  if (/no_office/.test(m)) return 'لا يوجد مكتب بهذا الرقم.';
  if (/full:/.test(m)) return `لا تتسع الشاحنة. المتاح فقط ${num(m.match(/full:(\d+)/)?.[1])} كغ.`;
  if (/no_capacity/.test(m)) return `لا تتسع الشاحنات القادمة لهذا الوزن. المتاح مجتمعاً ${num(m.match(/no_capacity:(\d+)/)?.[1])} كغ فقط.`;
  if (/not_open/.test(m)) return 'الحجز على هذه الرحلة مغلق.';
  if (/rate/.test(m)) return 'محاولات كثيرة. انتظر قليلاً.';
  if (/inactive/.test(m)) return 'حسابك غير فعّال.';
  if (/bad_input/.test(m)) return 'تحقق من البيانات: الوصف والوزن واسم المستلم وهاتفه.';
  if (/forbidden/.test(m)) return 'هذه الصفحة للإدارة فقط.';
  if (/finished/.test(m)) return 'الرحلة منتهية ولا يمكن تعديلها.';
  if (/no_truck/.test(m)) return 'اختر شاحنة فعّالة.';
  if (/auth|JWT|jwt/.test(m)) return 'سجّل الدخول أولاً.';
  return 'تعذر تنفيذ الطلب. تحقق من الاتصال وحاول مجدداً.';
};
async function rpc(name, args = {}) {
  const c = cfg(), t = token();
  const r = await fetch(`${c.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (t || c.SUPABASE_ANON_KEY) }, body: JSON.stringify(args) });
  let j = null; try { j = await r.json(); } catch { }
  if (!r.ok) throw new Error(ERR(j?.message || j?.hint || r.status));
  return j;
}

/* ---------- أدوات ---------- */
const num = x => Number(x || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const money = x => num(Math.round(Number(x || 0))) + ' ل.س';
const LOC = 'ar-u-nu-latn';
const dFmt = d => new Date(d).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
const tFmt = d => new Date(d).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });
const CATS = ['مواد غذائية', 'ملابس وأقمشة', 'أدوات وكهربائيات', 'مواد بناء', 'أثاث', 'أخرى'];
const ITEM_ST = { booked: 'محجوز', loaded: 'تم التحميل', delivered: 'تم التسليم', cancelled: 'ملغى' };
const TRIP_ST = { open: 'مفتوحة للحجز', closed: 'الحجز مغلق', on_way: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغاة' };
const bar = (used, cap) => { const p = Math.max(0, Math.min(100, Math.round(used / cap * 100))); return `<div class="cg-bar" role="progressbar" aria-valuenow="${p}"><i class="${p >= 100 ? 'full' : p >= 75 ? 'hi' : ''}" style="width:${p}%"></i></div>`; };
const phoneOk = s => /^[+\d][\d\s\-()]{6,}$/.test(String(s || '').trim());
const lget = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
const tel = s => String(s || '').replace(/[^\d+]/g, '');
const waLink = text => 'https://wa.me/?text=' + encodeURIComponent(text);
const hold = (btn, fn) => async () => { if (btn.disabled) return; btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };

function layer(title, { right = '' } = {}) {
  const el = document.createElement('div'); el.className = 'overlay cg';
  el.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back', 22)}</button><div class="ttl">${esc(title)}</div>${right || '<span style="width:40px"></span>'}</header><div class="cg-body"></div>`;
  document.body.appendChild(el);
  el.querySelector('[data-x]').onclick = () => el.remove();
  return { el, body: el.querySelector('.cg-body'), close: () => el.remove(), alive: () => el.isConnected };
}
function ask({ title, text = '', fields = [], ok = 'تأكيد', danger = false }) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal'; document.body.appendChild(m);
    m.innerHTML = `<div class="modal-card cg-ask"><p class="big-p">${esc(title)}</p>${text ? `<p class="small">${esc(text)}</p>` : ''}${fields.map(f => `<label class="cg-f"><span>${esc(f.label)}</span><input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" inputmode="${f.inputmode || 'text'}" dir="${f.dir || 'auto'}" ${f.maxlength ? `maxlength="${f.maxlength}"` : ''}></label>`).join('')}
      <button class="btn ${danger ? 'danger-solid' : ''} full" id="y">${esc(ok)}</button><button class="btn light full" id="n">رجوع</button></div>`;
    const done = v => { m.remove(); res(v); };
    m.querySelector('#y').onclick = () => done(Object.fromEntries(fields.map(f => [f.name, m.querySelector(`[name=${f.name}]`).value.trim()])));
    m.querySelector('#n').onclick = () => done(null);
    m.querySelector('input')?.focus();
  });
}

Object.assign(P, { office: '<path d="M4 21V5l8-2v18M12 9h8v12M4 21h16M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2"/>', car: '<path d="M4 15v-3l2-5h12l2 5v3zM4 15v3h3v-3M17 15v3h3v-3"/><circle cx="8" cy="12.5" r=".8"/><circle cx="16" cy="12.5" r=".8"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' });
try { if (!document.getElementById('offices-css')) { const l = document.createElement('style'); l.id = 'offices-css'; l.textContent = '.of-fab{bottom:calc(var(--nav,64px) + 118px)!important;background:#c9a24a!important}.of-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--line);margin-inline-end:4px}.of-dot.on{background:var(--ok)}.cg-pill.of-st-completed{background:#e3f4e8;color:var(--ok)}.cg-pill.of-st-cancelled,.cg-pill.of-st-no_driver{background:#fdecea;color:var(--bad)}.cg-pill.of-st-searching{background:#fff4d6;color:#8a6a10}.cg-pill.of-st-accepted,.cg-pill.of-st-on_the_way,.cg-pill.of-st-arrived,.cg-pill.of-st-started{background:#e4eefc;color:#1f5fb4}'; document.head.appendChild(l); } } catch { }
const RIDE_ST = { searching: 'قيد البحث', accepted: 'مقبول', on_the_way: 'في الطريق', arrived: 'وصل', started: 'بدأت الرحلة', completed: 'مكتمل', cancelled: 'ملغى', no_driver: 'بلا سائق' };

/* =====================================================================
   لوحة مكتب التكسي
   ===================================================================== */
export function openOffice() {
  if (document.querySelector('.overlay.of-main')) return;
  const L = layer('لوحة المكتب'); L.el.classList.add('of-main');
  const S = { tab: 'stats', drivers: [], rides: [], stats: {}, ok: false, f: 'all' };
  L.body.innerHTML = `<div class="cg-tabs three"><button data-t="stats" class="on">${ic('chart', 18)} إحصاءات</button><button data-t="drivers">${ic('car', 18)} السائقون</button><button data-t="rides">${ic('list', 18)} الطلبات</button></div><div class="cg-pane" id="pane"></div>`;
  const pane = L.body.querySelector('#pane'), tabs = [...L.body.querySelectorAll('[data-t]')];
  const setTab = t => { S.tab = t; tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); }; tabs.forEach(b => b.onclick = () => setTab(b.dataset.t));
  async function load(silent) { try { [S.stats, S.drivers, S.rides] = await Promise.all([rpc('office_stats'), rpc('office_drivers'), rpc('office_rides', { p_limit: 150 })]); S.ok = true; } catch (e) { if (!silent) toast(e.message, 'err'); S.err = e.message; } if (L.alive()) render(); }
  function render() {
    if (S.err && !S.ok) { pane.innerHTML = `<div class="empty-st">${ic('shield', 44)}<h3>${esc(S.err)}</h3></div>`; return; }
    if (!S.ok) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    if (S.tab === 'stats') { const s = S.stats; pane.innerHTML = `<div class="cg-stat"><div><b>${s.active_now || 0}</b><small>طلبات جارية الآن</small></div><div><b>${s.today || 0}</b><small>طلبات اليوم</small></div><div><b>${s.week || 0}</b><small>آخر 7 أيام</small></div><div><b>${s.completed_week || 0}</b><small>مكتملة (7 أيام)</small></div><div><b>${s.cancelled_week || 0}</b><small>ملغاة (7 أيام)</small></div><div><b>${s.drivers_online || 0} / ${s.drivers || 0}</b><small>سائقون متصلون</small></div><div class="g"><b>${num(s.revenue_week)}</b><small>ل.س إجمالي الرحلات المكتملة (7 أيام)</small></div></div>${s.avg_rating ? `<p class="center">${ic('star', 16)} متوسط تقييم الزبائن: <b>${s.avg_rating}</b> / 5</p>` : ''}<p class="cg-note">${ic('info', 14)} الطلبات الجديدة تصلك وتقبلها أو ترفضها من الشاشة الرئيسية للمكتب كالمعتاد. هذه اللوحة للمتابعة وإدارة السائقين.</p>`; return; }
    if (S.tab === 'drivers') { pane.innerHTML = S.drivers.length ? S.drivers.map(d => `<article class="cg-card ${d.status === 'active' ? '' : 'is-off'}"><div class="cg-row"><div class="cg-ico">${ic('car', 24)}</div><div class="grow"><b>${esc(d.full_name)}</b><small><a href="tel:${tel(d.phone)}" dir="ltr">${esc(d.phone || '')}</a></small></div><span><i class="of-dot ${d.available ? 'on' : ''}"></i><small>${d.available ? 'متصل' : 'غير متصل'}</small></span></div><div class="cg-meta"><span>${d.vehicle_kind === 'motor' ? 'متور' : 'سيارة'} ${esc([d.vehicle_make, d.vehicle_model, d.vehicle_color].filter(Boolean).join(' '))}</span><span>${d.rides_done} رحلة مكتملة</span></div></article>`).join('') + '<p class="cg-note">لإضافة سائق أو إزالته تواصل مع إدارة وين؟.</p>' : `<div class="empty-st">${ic('car', 46)}<h3>لا يوجد سائقون مرتبطون بمكتبك</h3><p class="muted">تواصل مع إدارة وين؟ لربط سائقيك بالمكتب.</p></div>`; return; }
    const F = { all: 'الكل', live: 'جارية', completed: 'مكتملة', cancelled: 'ملغاة' };
    const list = S.rides.filter(r => S.f === 'all' || (S.f === 'live' ? ['accepted', 'on_the_way', 'arrived', 'started'].includes(r.status) : S.f === 'cancelled' ? ['cancelled', 'no_driver'].includes(r.status) : r.status === S.f));
    pane.innerHTML = `<div class="filt">${Object.entries(F).map(([k, v]) => `<button class="fchip ${S.f === k ? 'on' : ''}" data-f="${k}">${v}</button>`).join('')}</div>` + (list.length ? list.map(r => `<article class="cg-card slim"><div class="cg-row"><div class="grow"><b>${esc(r.pickup)} ← ${esc(r.dropoff)}</b><small>${dFmt(r.created_at)} ${tFmt(r.created_at)} · ${r.kind === 'delivery' ? 'توصيل' : 'تكسي'} · ${esc(r.handler_name || '')}${r.by_driver ? ' (سائق)' : ''}</small></div><span class="cg-pill of-st-${r.status}">${RIDE_ST[r.status] || r.status}</span></div>${r.price ? `<div class="cg-meta"><span>${money(r.price)}</span>${r.rating ? `<span>${ic('star', 14)} ${r.rating}</span>` : ''}</div>` : ''}</article>`).join('') : `<div class="empty-st">${ic('list', 46)}<h3>لا توجد طلبات</h3></div>`);
  }
  pane.addEventListener('click', e => { const f = e.target.closest('[data-f]'); if (f) { S.f = f.dataset.f; render(); } });
  render(); load();
  const tm = setInterval(() => { if (!L.alive()) return clearInterval(tm); if (!document.hidden) load(true); }, 30000);
}

/* =====================================================================
   إدارة المكاتب (للأدمن)
   ===================================================================== */
export function openOfficesAdmin() {
  if (document.querySelector('.overlay.of-admin')) return;
  const L = layer('مكاتب التكسي'); L.el.classList.add('of-admin');
  const S = { list: [], ok: false };
  L.body.innerHTML = '<div class="cg-pane" id="pane"></div>'; const pane = L.body.querySelector('#pane');
  async function load() { try { S.list = await rpc('admin_offices'); S.ok = true; } catch (e) { toast(e.message, 'err'); S.err = e.message; } if (L.alive()) render(); }
  function render() {
    if (S.err && !S.ok) { pane.innerHTML = `<div class="empty-st">${ic('shield', 44)}<h3>${esc(S.err)}</h3></div>`; return; }
    if (!S.ok) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    pane.innerHTML = `<button class="btn full" data-link>${ic('plus', 18)} ربط سائق بمكتب</button>` + S.list.map(o => `<article class="cg-card ${o.status === 'active' ? '' : 'is-off'}"><div class="cg-row"><div class="cg-ico">${ic('office', 24)}</div><div class="grow"><b>${esc(o.full_name)}</b><small><span dir="ltr">${esc(o.phone || '')}</span></small></div><span class="cg-pill ${o.status === 'active' ? 'green' : 'red'}">${o.status === 'active' ? 'فعّال' : 'معطّل'}</span></div><div class="cg-meta"><span>${o.drivers} سائق</span><span>${o.rides} طلب</span><span>${o.completed} مكتمل</span><span>${money(o.revenue)}</span></div><button class="btn light ${o.status === 'active' ? 'danger' : ''} full" data-tg="${o.id}" data-s="${o.status === 'active' ? 'disabled' : 'active'}">${o.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}</button></article>`).join('') || `<div class="empty-st">${ic('office', 46)}<h3>لا توجد مكاتب</h3></div>`;
  }
  pane.addEventListener('click', async e => {
    if (e.target.closest('[data-link]')) {
      const r = await ask({ title: 'ربط سائق بمكتب', text: 'اترك هاتف المكتب فارغاً لفك الارتباط.', fields: [{ name: 'd', label: 'هاتف السائق', inputmode: 'tel', dir: 'ltr' }, { name: 'o', label: 'هاتف المكتب', inputmode: 'tel', dir: 'ltr' }], ok: 'حفظ' });
      if (!r || !r.d) return; try { const x = await rpc('admin_link_driver', { p_driver_phone: r.d, p_office_phone: r.o || null }); toast(x === 'linked' ? 'تم الربط' : 'تم فك الارتباط', 'ok'); load(); } catch (x) { toast(x.message, 'err'); } return;
    }
    const t = e.target.closest('[data-tg]'); if (!t) return;
    if (t.dataset.s === 'disabled' && !await ask({ title: 'تعطيل هذا الحساب؟', text: 'لن يتمكن من استقبال الطلبات.', ok: 'تعطيل', danger: true })) return;
    try { await rpc('admin_set_account_status', { p_id: t.dataset.tg, p_status: t.dataset.s }); toast('تم', 'ok'); load(); } catch (x) { toast(x.message, 'err'); }
  });
  render(); load();
}

/* =====================================================================
   الربط بالتطبيق
   ===================================================================== */
const ST = { tok: undefined, kind: null, busy: false };
async function detect() {
  const t = token(); if (t === ST.tok || ST.busy) return; ST.tok = t; ST.kind = null; ST.busy = true;
  try { if (t) { if (await rpc('office_stats').then(() => true).catch(() => false)) ST.kind = 'office'; else if (await rpc('admin_offices').then(() => true).catch(() => false)) ST.kind = 'admin'; } } finally { ST.busy = false; }
  inject();
}
function inject() {
  const shell = document.querySelector('.shell') || document.querySelector('#sheet'), fab = document.querySelector('.of-fab');
  if (ST.kind && shell && !fab) { const b = document.createElement('button'); b.className = 'cg-fab of-fab'; b.type = 'button'; b.dataset.ofFab = ST.kind; b.innerHTML = `${ic('office', 22)}<span>${ST.kind === 'office' ? 'لوحة المكتب' : 'المكاتب'}</span>`; document.body.appendChild(b); }
  if ((!ST.kind || !shell) && fab) fab.remove();
}
document.addEventListener('click', e => { const f = e.target.closest('[data-of-fab]'); if (f) { e.preventDefault(); f.dataset.ofFab === 'office' ? openOffice() : openOfficesAdmin(); } });
let tmr = null;
new MutationObserver(() => { clearTimeout(tmr); tmr = setTimeout(() => { inject(); detect(); }, 200); }).observe(document.documentElement, { childList: true, subtree: true });
window.openOffice = openOffice; window.openOfficesAdmin = openOfficesAdmin;
setTimeout(() => { inject(); detect(); }, 600);
