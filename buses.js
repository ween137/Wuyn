// الباصات والسفر: حجز مقاعد (للزبائن) + لوحة شركة النقل + إدارة الشركات (للأدمن)
// يحتاج cargo.css (موجود) وbuses.css.
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
  if (/taken/.test(m)) return 'بعض المقاعد حُجزت للتو. اختر مقاعد أخرى.';
  if (/^full$/.test(m)) return 'لا تكفي المقاعد المتبقية.';
  if (/seats_low/.test(m)) return `لا يمكن تقليل المقاعد عن ${m.match(/seats_low:(\d+)/)?.[1] || 'المحجوز'} (محجوزة).`;
  if (/^late$/.test(m)) return 'انتهت مهلة الإلغاء لهذه الرحلة.';
  if (/bad_transition/.test(m)) return 'لا يمكن تغيير الحالة بهذا الشكل.';
  if (/no_owner/.test(m)) return 'لا يوجد حساب بهذا الرقم. يجب أن يسجّل صاحب الشركة في التطبيق أولاً.';
  if (/bad_owner/.test(m)) return 'الحساب يجب أن يكون حساب زبون عادياً.';
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

try { if (!document.getElementById('buses-css')) { const l = document.createElement('link'); l.id = 'buses-css'; l.rel = 'stylesheet'; l.href = '/buses.css'; document.head.appendChild(l); } } catch { }
Object.assign(P, {
  bus: '<rect x="3.5" y="4" width="17" height="13" rx="3"/><path d="M3.5 11h17M7 20v-3M17 20v-3"/><circle cx="7.5" cy="14" r=".8"/><circle cx="16.5" cy="14" r=".8"/>',
  seat: '<path d="M7 4h6a2 2 0 0 1 2 2v6H7z"/><path d="M5 12h12a2 2 0 0 1 2 2v3H5zM8 20v-3M16 20v-3"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  office: '<path d="M4 21V5l8-2v18M12 9h8v12M4 21h16M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
});

const BTRIP = { open: 'متاحة', full: 'مكتملة', departed: 'انطلقت', arrived: 'وصلت', cancelled: 'ملغاة' };
const tripState = t => t.status === 'open' && Number(t.seats_total) - Number(t.seats_booked ?? (t.seats_total - t.seats_left)) < 1 ? 'full' : t.status;
const uid = () => { try { return crypto.randomUUID(); } catch { return 'k' + Date.now() + Math.random().toString(36).slice(2); } };
const dayKey = d => { const x = new Date(d); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); };
const timeRange = t => tFmt(t.depart_at) + (t.arrive_at ? ' ← ' + tFmt(t.arrive_at) : '');
const policy = h => Number(h) ? `يمكنك إلغاء الحجز حتى ${h} ساعات قبل الانطلاق.` : 'يمكنك الإلغاء حتى لحظة الانطلاق.';

/* ---------- شبكة المقاعد ---------- */
function seatGrid(total, taken, sel) {
  const rows = []; for (let i = 1; i <= total; i += 4) {
    const cell = n => n > total ? '<i class="bs-gap"></i>' : `<button type="button" class="bs-seat ${taken.includes(n) ? 'taken' : sel.has(n) ? 'sel' : ''}" data-seat="${n}" ${taken.includes(n) ? 'disabled' : ''} aria-label="مقعد ${n}">${n}</button>`;
    rows.push(`<div class="bs-row">${cell(i)}${cell(i + 1)}<i class="bs-aisle"></i>${cell(i + 2)}${cell(i + 3)}</div>`);
  }
  return `<div class="bs-bus"><div class="bs-front">${ic('bus', 18)} <span>مقدمة الباص</span></div>${rows.join('')}</div>`;
}

/* =====================================================================
   الزبون
   ===================================================================== */
export function openBuses() {
  if (document.querySelector('.overlay.bs-main')) return;
  const L = layer('الباصات والسفر'); L.el.classList.add('bs-main');
  const S = { tab: 'trips', trips: [], mine: [], from: '', to: '', day: '', loaded: false };
  L.body.innerHTML = `<div class="cg-tabs"><button data-t="trips" class="on">${ic('bus', 18)} الرحلات</button><button data-t="mine">${ic('seat', 18)} حجوزاتي <em class="cg-n hidden"></em></button></div><div class="cg-pane" id="pane"></div>`;
  const pane = L.body.querySelector('#pane'), tabs = [...L.body.querySelectorAll('[data-t]')];
  const setTab = t => { S.tab = t; tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); L.body.scrollTop = 0; };
  tabs.forEach(b => b.onclick = () => setTab(b.dataset.t));
  async function load(silent) {
    try { const [t, m] = await Promise.all([rpc('bus_trips_open', {}), token() ? rpc('bus_my_bookings') : Promise.resolve([])]); S.trips = t || []; S.mine = m || []; S.loaded = true; }
    catch (e) { if (!silent) toast(e.message, 'err'); S.loaded = true; }
    if (!L.alive()) return;
    const n = S.mine.filter(b => b.status === 'confirmed' && ['open', 'departed'].includes(b.trip_status)).length, el = L.body.querySelector('.cg-n'); el.textContent = n; el.classList.toggle('hidden', !n);
    render();
  }
  const card = t => {
    const left = Number(t.seats_left), full = left < 1, d = new Date(t.depart_at);
    return `<article class="cg-card bs-trip ${full ? 'is-full' : ''}" data-trip="${t.id}"><div class="cg-row"><div class="cg-ico">${ic('bus', 26)}</div><div class="grow"><b>${esc(t.origin)} <span class="cg-arr">${ic('arrow', 16)}</span> ${esc(t.destination)}</b><small>${esc(t.company_name)}${t.bus_info ? ' · ' + esc(t.bus_info) : ''}</small></div><div class="bs-price"><b>${num(t.price)}</b><small>ل.س / مقعد</small></div></div>
      <div class="bs-times"><div>${ic('cal', 15)} ${dFmt(d)}</div><div>${ic('clock', 15)} ${timeRange(t)}</div></div>
      <div class="cg-fill"><span class="cg-pill ${full ? 'red' : left <= 5 ? 'booked' : 'green'}">${full ? 'مكتملة' : left <= 5 ? 'بقي ' + left + ' مقاعد' : left + ' مقعداً متاحاً'}</span><b>التفاصيل والحجز ‹</b></div></article>`;
  };
  const book = b => {
    const live = b.status === 'confirmed', d = new Date(b.depart_at), st = b.status === 'cancelled' ? 'cancelled' : b.trip_status === 'arrived' ? 'delivered' : b.trip_status === 'departed' ? 'loaded' : 'booked';
    const lab = b.status === 'cancelled' ? 'ملغى' : { arrived: 'وصلت', departed: 'انطلقت', cancelled: 'ملغاة', open: 'مؤكد' }[b.trip_status];
    return `<article class="cg-card ${b.status === 'cancelled' ? 'is-off' : ''}"><div class="cg-row"><div class="cg-ico">${ic('seat', 24)}</div><div class="grow"><b>${esc(b.origin)} ← ${esc(b.destination)}</b><small>${esc(b.company_name)} · ${dFmt(d)} ${tFmt(d)}</small></div><span class="cg-pill ${st}">${lab}</span></div>
      <div class="cg-meta"><span>${ic('seat', 15)} مقاعد: <b dir="ltr">${b.seats.slice().sort((x, y) => x - y).join(' - ')}</b></span><span>${money(b.total)}</span><span>${ic('user', 15)} ${esc(b.passenger_name)}</span><span>حجز رقم ${b.id}</span></div>
      ${live && b.trip_status === 'open' ? (b.can_cancel ? `<button class="btn light danger full" data-cancel="${b.id}">إلغاء الحجز</button>` : `<p class="cg-note">${ic('info', 14)} انتهت مهلة الإلغاء (${b.cancel_hours} ساعات قبل الانطلاق).</p>`) : ''}</article>`;
  };
  function render() {
    if (!S.loaded) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    if (S.tab === 'mine') {
      pane.innerHTML = !token() ? `<div class="empty-st">${ic('shield', 44)}<h3>سجّل الدخول لعرض حجوزاتك</h3></div>` : !S.mine.length ? `<div class="empty-st">${ic('seat', 46)}<h3>لا توجد حجوزات</h3><p class="muted">احجز مقعدك في أقرب رحلة.</p><button class="btn" data-go="trips">تصفح الرحلات</button></div>` : S.mine.map(book).join(''); return;
    }
    const froms = [...new Set(S.trips.map(t => t.origin))], tos = [...new Set(S.trips.map(t => t.destination))];
    const today = dayKey(Date.now()), tom = dayKey(Date.now() + 864e5);
    const list = S.trips.filter(t => (!S.from || t.origin === S.from) && (!S.to || t.destination === S.to) && (!S.day || (S.day === 'today' ? dayKey(t.depart_at) === today : S.day === 'tom' ? dayKey(t.depart_at) === tom : true)));
    const opt = (arr, v) => `<option value="">الكل</option>${arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
    pane.innerHTML = `<div class="bs-search"><div class="bs-sel"><label><span>من</span><select id="f1">${opt(froms, S.from)}</select></label><button class="bs-swap" id="sw" type="button" aria-label="تبديل">${ic('swap', 20)}</button><label><span>إلى</span><select id="f2">${opt(tos, S.to)}</select></label></div>
      <div class="filt"><button class="fchip ${!S.day ? 'on' : ''}" data-day="">كل المواعيد</button><button class="fchip ${S.day === 'today' ? 'on' : ''}" data-day="today">اليوم</button><button class="fchip ${S.day === 'tom' ? 'on' : ''}" data-day="tom">غداً</button></div></div>
      ${list.length ? list.map(card).join('') : `<div class="empty-st">${ic('bus', 46)}<h3>لا توجد رحلات مطابقة</h3><p class="muted">جرّب تغيير المدينة أو الموعد. الرحلات الجديدة تظهر هنا فور نشرها.</p></div>`}`;
  }
  pane.addEventListener('change', e => { if (e.target.id === 'f1') { S.from = e.target.value; render(); } if (e.target.id === 'f2') { S.to = e.target.value; render(); } });
  pane.addEventListener('click', async e => {
    const g = e.target.closest('[data-go]'); if (g) return setTab(g.dataset.go);
    if (e.target.closest('#sw')) { [S.from, S.to] = [S.to, S.from]; return render(); }
    const dy = e.target.closest('[data-day]'); if (dy) { S.day = dy.dataset.day; return render(); }
    const t = e.target.closest('[data-trip]'); if (t) return openTrip(S.trips.find(x => x.id === +t.dataset.trip), async go => { await load(true); if (go) setTab('mine'); });
    const c = e.target.closest('[data-cancel]');
    if (c) {
      const b = S.mine.find(x => x.id === +c.dataset.cancel); if (!await ask({ title: 'إلغاء هذا الحجز؟', text: policy(b.cancel_hours), ok: 'نعم، ألغِ', danger: true })) return;
      try { const r = await rpc('bus_cancel', { p_booking: b.id }); toast(r === 'ok' ? 'تم إلغاء الحجز' : r === 'late' ? ERR('late') : 'لا يمكن الإلغاء', r === 'ok' ? 'ok' : 'err'); await load(true); } catch (x) { toast(x.message, 'err'); }
    }
  });
  render(); load();
  const tm = setInterval(() => { if (!L.alive()) return clearInterval(tm); if (!document.hidden) load(true); }, 25000);
}

function openTrip(trip, done) {
  const L = layer('تفاصيل الرحلة'); const sel = new Set(); let taken = [], key = uid();
  const d = new Date(trip.depart_at);
  L.body.innerHTML = `<div class="cg-pad"><article class="cg-card slim"><div class="cg-row"><div class="cg-ico">${ic('bus', 24)}</div><div class="grow"><b>${esc(trip.origin)} ← ${esc(trip.destination)}</b><small>${esc(trip.company_name)}</small></div><div class="bs-price"><b>${num(trip.price)}</b><small>ل.س / مقعد</small></div></div>
    <div class="bs-times"><div>${ic('cal', 15)} ${dFmt(d)}</div><div>${ic('clock', 15)} ${timeRange(trip)}</div></div>
    ${trip.bus_info ? `<div class="cg-meta"><span>${ic('bus', 15)} ${esc(trip.bus_info)}</span></div>` : ''}${trip.description ? `<p class="cg-note">${esc(trip.description)}</p>` : ''}${trip.notes ? `<p class="cg-note">${esc(trip.notes)}</p>` : ''}
    <p class="cg-note">${ic('info', 14)} ${policy(trip.cancel_hours)} الدفع للشركة عند الصعود.</p></article>
    <h4 class="cg-h">${ic('seat', 18)} اختر مقاعدك (حتى 6)</h4><div id="grid"><div class="spin mid"></div></div>
    <div class="bs-legend"><span><i class="bs-seat"></i> متاح</span><span><i class="bs-seat sel"></i> مختار</span><span><i class="bs-seat taken"></i> محجوز</span></div>
    <form id="bf" novalidate class="bs-form"><label class="cg-f"><span>اسم المسافر *</span><input name="n" maxlength="80" value="${esc(lget('bs-name'))}"></label><label class="cg-f"><span>هاتف المسافر *</span><input name="p" inputmode="tel" dir="ltr" maxlength="30" value="${esc(lget('bs-phone'))}" placeholder="09xxxxxxxx"></label>
    <div class="cg-est" id="est"></div><p class="auth-msg" id="msg" role="alert"></p><button class="btn full big" id="go" type="submit">${ic('check', 20)} تأكيد الحجز</button></form></div>`;
  const grid = L.body.querySelector('#grid'), est = L.body.querySelector('#est'), f = L.body.querySelector('#bf'), msg = f.querySelector('#msg'), go = f.querySelector('#go');
  const draw = () => { grid.innerHTML = seatGrid(trip.seats_total, taken, sel); const n = sel.size; est.innerHTML = n ? `<div><small>المقاعد</small><b dir="ltr">${[...sel].sort((a, b) => a - b).join(' - ')}</b></div><div><small>المجموع</small><b>${money(n * trip.price)}</b></div>` : '<small>اضغط على المقاعد التي تريدها</small>'; };
  async function seats() { try { taken = await rpc('bus_trip_seats', { p_trip: trip.id }) || []; } catch (e) { toast(e.message, 'err'); } taken.forEach(n => sel.delete(n)); if (L.alive()) draw(); }
  grid.addEventListener('click', e => { const b = e.target.closest('[data-seat]'); if (!b) return; const n = +b.dataset.seat; if (sel.has(n)) sel.delete(n); else if (sel.size >= 6) return toast('الحد الأقصى 6 مقاعد.', 'err'); else sel.add(n); draw(); });
  seats();
  f.addEventListener('submit', async e => {
    e.preventDefault(); msg.className = 'auth-msg'; const fail = t => { msg.textContent = t; msg.className = 'auth-msg show'; msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    if (!token()) return fail('سجّل الدخول أولاً.'); if (!sel.size) return fail('اختر مقعداً واحداً على الأقل.');
    if (f.n.value.trim().length < 2) return fail('اكتب اسم المسافر.'); if (!phoneOk(f.p.value)) return fail('اكتب هاتفاً صحيحاً.');
    go.disabled = true; const lab = go.innerHTML; go.textContent = 'جارٍ تأكيد الحجز…';
    try {
      lset('bs-name', f.n.value.trim()); lset('bs-phone', f.p.value.trim());
      const r = await rpc('bus_book', { p_trip: trip.id, p_seats: [...sel].sort((a, b) => a - b), p_name: f.n.value.trim(), p_phone: f.p.value.trim(), p_key: key });
      if (!r || !r.id) throw new Error('لم يتأكد الحجز. راجع «حجوزاتي» قبل المحاولة مجدداً.');
      key = uid(); bookOk(L, r, trip, done);
    } catch (x) { fail(x.message); go.disabled = false; go.innerHTML = lab; seats(); }
  });
}
function bookOk(L, r, trip, done) {
  const text = `تأكيد حجز باص عبر تطبيق وين؟\n${trip.company_name}\n${trip.origin} ← ${trip.destination}\n${dFmt(trip.depart_at)} ${tFmt(trip.depart_at)}\nالمقاعد: ${r.seats.join(' - ')}\nرقم الحجز: ${r.id}`;
  L.body.innerHTML = `<div class="cg-ok"><div class="cg-check">${ic('check', 46)}</div><h2>تم تأكيد حجزك ✅</h2><p class="muted">${esc(trip.origin)} ← ${esc(trip.destination)} · ${dFmt(trip.depart_at)} ${tFmt(trip.depart_at)}</p>
    <div class="cg-pin big"><small>رقم الحجز</small><b dir="ltr">${r.id}</b><small>مقاعدك: ${r.seats.join(' - ')}</small></div>
    <div class="cg-sum" style="grid-template-columns:1fr 1fr"><div><b>${r.seats.length}</b><small>مقعد</small></div><div><b>${num(r.total)}</b><small>ل.س تُدفع عند الصعود</small></div></div>
    <a class="btn full" target="_blank" rel="noopener" href="${waLink(text)}">${ic('share', 18)} مشاركة التذكرة</a><button class="btn light full" id="mine">حجوزاتي</button><button class="btn light full" id="back">رجوع للرحلات</button></div>`;
  L.body.querySelector('#mine').onclick = () => { L.close(); done(true); }; L.body.querySelector('#back').onclick = () => { L.close(); done(false); };
}

/* =====================================================================
   لوحة شركة النقل (مدير رحلات)
   ===================================================================== */
export function openCompany(co) {
  if (document.querySelector('.overlay.bs-co')) return;
  const L = layer(co?.name || 'لوحة الشركة'); L.el.classList.add('bs-co');
  const S = { tab: 'trips', trips: [], stats: {}, ok: false };
  L.body.innerHTML = `<div class="cg-tabs"><button data-t="trips" class="on">${ic('bus', 18)} رحلاتي</button><button data-t="stats">${ic('chart', 18)} إحصاءات</button></div><div class="cg-pane" id="pane"></div>`;
  const pane = L.body.querySelector('#pane'), tabs = [...L.body.querySelectorAll('[data-t]')];
  const setTab = t => { S.tab = t; tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); };
  tabs.forEach(b => b.onclick = () => setTab(b.dataset.t));
  async function load() { try { [S.trips, S.stats] = await Promise.all([rpc('bus_co_trips'), rpc('bus_co_stats')]); S.ok = true; } catch (e) { toast(e.message, 'err'); S.err = e.message; } if (L.alive()) render(); }
  const row = t => { const d = new Date(t.depart_at), st = tripState(t); return `<article class="cg-card" data-trip="${t.id}"><div class="cg-row"><div class="cg-ico">${ic('bus', 24)}</div><div class="grow"><b>${esc(t.origin)} ← ${esc(t.destination)}</b><small>${dFmt(d)} · ${timeRange(t)}</small></div><span class="cg-pill bs-st-${st}">${BTRIP[st]}</span></div>${bar(t.seats_booked, t.seats_total)}<div class="cg-fill"><span>${t.seats_booked} / ${t.seats_total} مقعد · ${t.bookings} حجز</span><b>${money(t.revenue)}</b></div></article>`; };
  function render() {
    if (S.err && !S.ok) { pane.innerHTML = `<div class="empty-st">${ic('shield', 44)}<h3>${esc(S.err)}</h3></div>`; return; }
    if (!S.ok) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    if (S.tab === 'stats') { const s = S.stats; pane.innerHTML = `<div class="cg-stat"><div><b>${s.trips_open || 0}</b><small>رحلات قادمة</small></div><div><b>${s.seats_booked || 0}</b><small>مقعد محجوز</small></div><div><b>${s.seats_free || 0}</b><small>مقعد متبقٍ</small></div><div class="g"><b>${num(s.revenue)}</b><small>ل.س إجمالي الحجوزات المؤكدة</small></div></div><p class="muted small center">يُحصَّل المبلغ نقداً عند الصعود.</p>`; return; }
    pane.innerHTML = `<button class="btn full" data-new>${ic('plus', 18)} إنشاء رحلة جديدة</button>${S.trips.length ? S.trips.map(row).join('') : `<div class="empty-st">${ic('bus', 46)}<h3>لا توجد رحلات بعد</h3><p class="muted">أنشئ أول رحلة ليبدأ الزبائن بالحجز.</p></div>`}`;
  }
  pane.addEventListener('click', e => { if (e.target.closest('[data-new]')) return coTripForm(null, load); const t = e.target.closest('[data-trip]'); if (t) coDetail(S.trips.find(x => x.id === +t.dataset.trip), load); });
  render(); load();
}
function coTripForm(t, after) {
  const L = layer(t ? 'تعديل الرحلة' : 'رحلة جديدة');
  const tm = new Date(Date.now() + 864e5); tm.setHours(8, 0, 0, 0);
  const dd = t ? new Date(t.depart_at) : tm, aa = t?.arrive_at ? new Date(t.arrive_at) : null;
  L.body.innerHTML = `<form class="cg-pad" id="tf" novalidate><div class="cg-two"><label class="cg-f"><span>مدينة الانطلاق *</span><input name="o" list="cl" maxlength="60" value="${esc(t?.origin || lget('bs-origin', 'يبرود'))}"></label><label class="cg-f"><span>مدينة الوصول *</span><input name="d" list="cl" maxlength="60" value="${esc(t?.destination || '')}" placeholder="دمشق"></label></div><datalist id="cl"><option>يبرود<option>دمشق<option>حمص<option>حلب<option>النبك<option>حماة<option>اللاذقية</datalist>
    <label class="cg-f"><span>تاريخ ووقت الانطلاق *</span><input name="w" type="datetime-local" value="${toLocalInput(dd)}"></label><label class="cg-f"><span>وقت الوصول المتوقع (اختياري)</span><input name="a" type="datetime-local" value="${aa ? toLocalInput(aa) : ''}"></label>
    <label class="cg-f"><span>نوع الباص / بياناته</span><input name="b" maxlength="100" value="${esc(t?.bus_info || '')}" placeholder="مرسيدس 50 مقعد مكيّف"></label><div class="cg-two"><label class="cg-f"><span>رقم اللوحة</span><input name="pl" maxlength="30" dir="ltr" value="${esc(t?.bus_plate || '')}"></label><label class="cg-f"><span>عدد المقاعد *</span><input name="s" inputmode="numeric" dir="ltr" value="${t?.seats_total || 50}"></label></div>
    <label class="cg-f"><span>سعر المقعد (ل.س) *</span><input name="pr" inputmode="numeric" dir="ltr" value="${t?.price ?? ''}" placeholder="15000"></label><label class="cg-f"><span>وصف الرحلة</span><input name="ds" maxlength="500" value="${esc(t?.description || '')}"></label><label class="cg-f"><span>ملاحظات للمسافرين</span><input name="nt" maxlength="300" value="${esc(t?.notes || '')}" placeholder="الحضور قبل 30 دقيقة"></label>
    <p class="auth-msg" id="msg" role="alert"></p><button class="btn full big" type="submit">${ic('check', 20)} ${t ? 'حفظ التعديلات' : 'نشر الرحلة'}</button></form>`;
  const f = L.body.querySelector('#tf'), msg = f.querySelector('#msg');
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fail = x => { msg.textContent = x; msg.className = 'auth-msg show'; msg.scrollIntoView({ block: 'center' }); };
    const dt = new Date(f.w.value), at = f.a.value ? new Date(f.a.value) : null, seats = parseInt(f.s.value), pr = parseInt(f.pr.value);
    if (!f.o.value.trim() || !f.d.value.trim()) return fail('اكتب مدينتي الانطلاق والوصول.'); if (f.o.value.trim() === f.d.value.trim()) return fail('مدينة الوصول يجب أن تختلف عن الانطلاق.');
    if (isNaN(dt)) return fail('اختر موعد الانطلاق.'); if (!t && dt <= new Date()) return fail('موعد الانطلاق يجب أن يكون في المستقبل.'); if (at && at <= dt) return fail('وقت الوصول يجب أن يكون بعد الانطلاق.');
    if (!(seats >= 1 && seats <= 60)) return fail('عدد المقاعد من 1 إلى 60.'); if (!(pr >= 0)) return fail('اكتب سعر المقعد.');
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try { lset('bs-origin', f.o.value.trim()); await rpc('bus_co_save_trip', { p_id: t?.id ?? null, p_origin: f.o.value.trim(), p_dest: f.d.value.trim(), p_depart: dt.toISOString(), p_arrive: at ? at.toISOString() : null, p_bus: f.b.value.trim() || null, p_plate: f.pl.value.trim() || null, p_seats: seats, p_price: pr, p_desc: f.ds.value.trim() || null, p_notes: f.nt.value.trim() || null }); toast(t ? 'تم الحفظ' : 'تم نشر الرحلة', 'ok'); L.close(); after(); }
    catch (x) { fail(x.message); b.disabled = false; }
  });
}
function toLocalInput(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function coDetail(t, after) {
  const L = layer('تفاصيل الرحلة'); const S = { pax: [] }; const d = new Date(t.depart_at);
  async function load() { try { S.pax = await rpc('bus_co_passengers', { p_trip: t.id }); } catch (e) { toast(e.message, 'err'); } if (L.alive()) draw(); }
  const list = () => S.pax.filter(p => p.status === 'confirmed');
  const manifest = () => `قائمة ركاب ${t.origin} ← ${t.destination}\n${dFmt(d)} ${tFmt(d)}\n${'─'.repeat(14)}\n` + list().map(p => `مقعد ${p.seats.slice().sort((a, b) => a - b).join('،')}: ${p.passenger_name} ${p.passenger_phone}`).join('\n') + `\n${'─'.repeat(14)}\nالركاب: ${list().reduce((s, p) => s + p.seats.length, 0)} من ${t.seats_total}`;
  function draw() {
    const st = tripState(t), n = list().reduce((s, p) => s + p.seats.length, 0), fin = ['arrived', 'cancelled'].includes(t.status);
    L.body.innerHTML = `<div class="cg-pad"><article class="cg-card slim"><div class="cg-row"><div class="cg-ico">${ic('bus', 24)}</div><div class="grow"><b>${esc(t.origin)} ← ${esc(t.destination)}</b><small>${dFmt(d)} · ${timeRange(t)}</small></div><span class="cg-pill bs-st-${st}">${BTRIP[st]}</span></div>${bar(n, t.seats_total)}<div class="cg-fill"><span>محجوز ${n} · متبقٍ ${t.seats_total - n}</span><b>${money(t.price)} / مقعد</b></div>${t.bus_info ? `<div class="cg-meta"><span>${ic('bus', 15)} ${esc(t.bus_info)} ${esc(t.bus_plate || '')}</span></div>` : ''}</article>
      ${fin ? '' : `<div class="cg-acts wrap">${t.status === 'open' ? `<button class="btn" data-st="departed">انطلقت الرحلة</button><button class="btn light" data-edit>${ic('edit', 18)} تعديل</button>` : ''}${t.status === 'departed' ? '<button class="btn" data-st="arrived">وصلت الرحلة</button>' : ''}${t.status === 'open' ? '<button class="btn light danger" data-st="cancelled">إلغاء الرحلة</button>' : ''}</div>`}
      <div class="cg-acts wrap"><button class="btn light" data-copy>${ic('copy', 18)} نسخ القائمة</button><a class="btn light" target="_blank" rel="noopener" href="${waLink(manifest())}">${ic('share', 18)} مشاركة</a></div>
      <h4 class="cg-h">${ic('user', 18)} الركاب والحجوزات (${S.pax.length})</h4>
      ${S.pax.length ? S.pax.map(p => `<article class="cg-card slim ${p.status === 'cancelled' ? 'is-off' : ''}"><div class="cg-row"><div class="grow"><b>${esc(p.passenger_name)}</b><small><a href="tel:${tel(p.passenger_phone)}" dir="ltr">${esc(p.passenger_phone)}</a></small></div><span class="cg-pill ${p.status === 'confirmed' ? 'green' : 'red'}">${p.status === 'confirmed' ? 'مؤكد' : 'ملغى'}</span></div><div class="cg-meta"><span>${ic('seat', 15)} <b dir="ltr">${p.seats.slice().sort((a, b) => a - b).join(' - ')}</b></span><span>${money(p.total)}</span></div></article>`).join('') : '<p class="center muted">لا توجد حجوزات بعد.</p>'}</div>`;
  }
  L.body.addEventListener('click', async e => {
    const s = e.target.closest('[data-st]');
    if (s) {
      const st = s.dataset.st, txt = { cancelled: 'إلغاء الرحلة؟ ستُلغى كل الحجوزات وتُحرَّر المقاعد.', departed: 'تأكيد انطلاق الرحلة؟ لن يعود الحجز متاحاً.', arrived: 'تأكيد وصول الرحلة؟' }[st];
      if (!await ask({ title: txt, ok: 'نعم', danger: st === 'cancelled' })) return;
      try { await rpc('bus_co_set_status', { p_trip: t.id, p_status: st }); toast('تم', 'ok'); t.status = st; await after(); load(); } catch (x) { toast(x.message, 'err'); } return;
    }
    if (e.target.closest('[data-edit]')) return coTripForm(t, async () => { await after(); L.close(); });
    if (e.target.closest('[data-copy]')) { try { await navigator.clipboard.writeText(manifest()); toast('تم النسخ', 'ok'); } catch { toast('تعذر النسخ', 'err'); } }
  });
  L.body.innerHTML = '<div class="spin mid"></div>'; load();
}

/* =====================================================================
   إدارة وين؟ للشركات والرحلات
   ===================================================================== */
export function openBusAdmin() {
  if (document.querySelector('.overlay.bs-admin')) return;
  const L = layer('الباصات والشركات'); L.el.classList.add('bs-admin');
  const S = { tab: 'cos', cos: [], trips: [], stats: {}, ok: false };
  L.body.innerHTML = `<div class="cg-tabs three"><button data-t="cos" class="on">${ic('office', 18)} الشركات</button><button data-t="trips">${ic('bus', 18)} الرحلات</button><button data-t="stats">${ic('chart', 18)} إحصاءات</button></div><div class="cg-pane" id="pane"></div>`;
  const pane = L.body.querySelector('#pane'), tabs = [...L.body.querySelectorAll('[data-t]')];
  const setTab = t => { S.tab = t; tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); }; tabs.forEach(b => b.onclick = () => setTab(b.dataset.t));
  async function load() { try { [S.cos, S.trips, S.stats] = await Promise.all([rpc('bus_admin_companies'), rpc('bus_admin_trips'), rpc('bus_admin_stats')]); S.ok = true; } catch (e) { toast(e.message, 'err'); S.err = e.message; } if (L.alive()) render(); }
  function render() {
    if (S.err && !S.ok) { pane.innerHTML = `<div class="empty-st">${ic('shield', 44)}<h3>${esc(S.err)}</h3></div>`; return; }
    if (!S.ok) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    if (S.tab === 'cos') pane.innerHTML = `<button class="btn full" data-co="0">${ic('plus', 18)} إضافة شركة نقل</button>${S.cos.map(c => `<article class="cg-card ${c.active ? '' : 'is-off'}" data-co="${c.id}"><div class="cg-row"><div class="cg-ico">${ic('office', 24)}</div><div class="grow"><b>${esc(c.name)}</b><small>${esc(c.owner_name || '')} · <span dir="ltr">${esc(c.owner_phone || '')}</span></small></div><span class="cg-pill ${c.active ? 'green' : 'red'}">${c.active ? 'فعّالة' : 'معطّلة'}</span></div><div class="cg-meta"><span>${c.trips} رحلة</span><span>${c.bookings} حجز مؤكد</span><span>إلغاء قبل ${c.cancel_hours} ساعات</span></div></article>`).join('') || `<div class="empty-st">${ic('office', 46)}<h3>لا توجد شركات</h3><p class="muted">اطلب من صاحب الشركة أن يسجّل حساب زبون، ثم أضفه برقم هاتفه.</p></div>`}`;
    else if (S.tab === 'trips') pane.innerHTML = S.trips.map(t => { const d = new Date(t.depart_at), st = tripState(t); return `<article class="cg-card" data-trip="${t.id}"><div class="cg-row"><div class="cg-ico">${ic('bus', 24)}</div><div class="grow"><b>${esc(t.origin)} ← ${esc(t.destination)}</b><small>${esc(t.company_name)} · ${dFmt(d)} ${tFmt(d)}</small></div><span class="cg-pill bs-st-${st}">${BTRIP[st]}</span></div>${bar(t.seats_booked, t.seats_total)}<div class="cg-fill"><span>${t.seats_booked} / ${t.seats_total} مقعد</span><b>${money(t.price)}</b></div></article>`; }).join('') || `<div class="empty-st">${ic('bus', 46)}<h3>لا توجد رحلات</h3></div>`;
    else { const s = S.stats; pane.innerHTML = `<div class="cg-stat"><div><b>${s.companies || 0}</b><small>شركات</small></div><div><b>${s.trips_open || 0}</b><small>رحلات قادمة</small></div><div><b>${s.bookings || 0}</b><small>حجوزات مؤكدة</small></div><div><b>${s.seats || 0}</b><small>مقاعد محجوزة</small></div><div class="g"><b>${num(s.revenue)}</b><small>ل.س إجمالي الحجوزات</small></div></div>`; }
  }
  pane.addEventListener('click', async e => {
    const c = e.target.closest('[data-co]'); if (c) return coForm(S.cos.find(x => x.id === +c.dataset.co) || null, load);
    const t = e.target.closest('[data-trip]'); if (!t) return; const tr = S.trips.find(x => x.id === +t.dataset.trip);
    if (tr.status === 'open' && await ask({ title: `إلغاء رحلة ${tr.origin} ← ${tr.destination}؟`, text: `شركة ${tr.company_name}. ستُلغى كل الحجوزات.`, ok: 'إلغاء الرحلة', danger: true })) { try { await rpc('bus_admin_set_trip', { p_trip: tr.id, p_status: 'cancelled' }); toast('تم', 'ok'); load(); } catch (x) { toast(x.message, 'err'); } }
  });
  render(); load();
}
function coForm(c, after) {
  const L = layer(c ? 'تعديل الشركة' : 'إضافة شركة نقل');
  L.body.innerHTML = `<form class="cg-pad" id="cf" novalidate><label class="cg-f"><span>اسم الشركة *</span><input name="n" maxlength="80" value="${esc(c?.name || '')}" placeholder="بلاد الشام"></label>
    ${c ? `<p class="cg-note">حساب المالك: <b dir="ltr">${esc(c.owner_phone || '')}</b></p>` : `<label class="cg-f"><span>هاتف حساب مالك الشركة *</span><input name="p" inputmode="tel" dir="ltr" placeholder="09xxxxxxxx"></label><p class="cg-note">يجب أن يكون صاحب الشركة قد سجّل في التطبيق كزبون عادي بهذا الرقم. بعد الإضافة تظهر له لوحة الشركة تلقائياً.</p>`}
    <label class="cg-f"><span>مهلة الإلغاء (ساعات قبل الانطلاق)</span><input name="h" inputmode="numeric" dir="ltr" value="${c?.cancel_hours ?? 3}"></label>
    <label class="cg-chk"><input type="checkbox" name="a" ${c?.active === false ? '' : 'checked'}><span>الحساب فعّال</span></label><p class="auth-msg" id="msg"></p><button class="btn full big" type="submit">${ic('check', 20)} حفظ</button></form>`;
  const f = L.body.querySelector('#cf'), msg = f.querySelector('#msg');
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fail = x => { msg.textContent = x; msg.className = 'auth-msg show'; };
    if (!f.n.value.trim()) return fail('اكتب اسم الشركة.'); if (!c && !phoneOk(f.p.value)) return fail('اكتب هاتف المالك.');
    const h = parseInt(f.h.value); if (!(h >= 0 && h <= 168)) return fail('المهلة من 0 إلى 168 ساعة.');
    try { await rpc('bus_admin_save_company', { p_id: c?.id ?? null, p_name: f.n.value.trim(), p_owner_phone: c ? null : f.p.value.trim(), p_active: f.a.checked, p_cancel_hours: h }); toast('تم الحفظ', 'ok'); L.close(); after(); } catch (x) { fail(x.message); }
  });
}

/* =====================================================================
   الربط بالتطبيق
   ===================================================================== */
const ST = { tok: undefined, co: null, admin: false, busy: false };
async function detect() {
  const t = token(); if (t === ST.tok || ST.busy) return; ST.tok = t; ST.co = null; ST.admin = false; ST.busy = true;
  try { if (t) { ST.co = await rpc('bus_co_me').catch(() => null); if (!ST.co) ST.admin = await rpc('bus_admin_stats').then(() => true).catch(() => false); } } finally { ST.busy = false; }
  inject();
  if (ST.co) { let seen = false; try { seen = sessionStorage.getItem('bs-co-open') === ST.tok; } catch { } if (!seen) { try { sessionStorage.setItem('bs-co-open', ST.tok); } catch { } openCompany(ST.co); } }
}
function inject() {
  const svc = document.querySelector('#sheet .svc');
  if (svc && !svc.parentElement.querySelector('.bs-tile')) {
    const b = document.createElement('button'); b.className = 'bs-tile'; b.type = 'button'; b.dataset.buses = '1';
    b.innerHTML = `<span class="bs-tile-ico">${ic('bus', 30)}</span><span class="grow"><b>الباصات والسفر</b><small>احجز مقعدك بين المدن · اختر المقعد بنفسك</small></span>${ic('back', 18, 'chev')}`;
    svc.insertAdjacentElement('afterend', b);
  }
  const shell = document.querySelector('.shell') || document.querySelector('#sheet');
  const want = ST.co ? ['co', 'لوحة الشركة'] : ST.admin ? ['admin', 'الباصات'] : null, fab = document.querySelector('.bs-fab');
  if (want && shell && !fab) { const b = document.createElement('button'); b.className = 'cg-fab bs-fab'; b.type = 'button'; b.dataset.bsFab = want[0]; b.innerHTML = `${ic('bus', 22)}<span>${want[1]}</span>`; document.body.appendChild(b); }
  if ((!want || !shell) && fab) fab.remove();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-buses]')) { e.preventDefault(); openBuses(); }
  const f = e.target.closest('[data-bs-fab]'); if (f) { e.preventDefault(); f.dataset.bsFab === 'co' ? openCompany(ST.co) : openBusAdmin(); }
});
let tmr = null;
new MutationObserver(() => { clearTimeout(tmr); tmr = setTimeout(() => { inject(); detect(); }, 150); }).observe(document.documentElement, { childList: true, subtree: true });
window.openBuses = openBuses; window.openCompany = () => openCompany(ST.co); window.openBusAdmin = openBusAdmin;
setTimeout(() => { inject(); detect(); }, 500);
