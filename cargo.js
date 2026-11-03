// خدمة الشحن: حجز أماكن في شاحنات مجمّعة (للزبائن وأصحاب المحلات) + إدارة الرحلات (للأدمن)
// ملف مستقل: يضيف نفسه إلى التطبيق دون تعديل بقية الملفات.
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

/* =====================================================================
   الزبون / صاحب المحل
   ===================================================================== */
export function openCargo() {
  if (document.querySelector('.overlay.cg-main')) return;
  const L = layer('شحن البضائع'); L.el.classList.add('cg-main');
  const S = { tab: 'trips', trips: [], mine: [], dest: '', loaded: false };
  L.body.innerHTML = `<div class="cg-tabs"><button data-t="trips" class="on">${ic('truck', 18)} الرحلات المتاحة</button><button data-t="mine">${ic('box', 18)} شحناتي <em class="cg-n hidden"></em></button></div><div class="cg-pane" id="pane"></div>`;
  const pane = L.body.querySelector('#pane');
  const tabs = [...L.body.querySelectorAll('[data-t]')];
  const setTab = t => { S.tab = t; tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); L.body.scrollTop = 0; };
  tabs.forEach(b => b.onclick = () => setTab(b.dataset.t));

  async function load(silent) {
    try {
      const [t, m] = await Promise.all([rpc('cargo_trips_open', { p_dest: null }), token() ? rpc('cargo_my_items') : Promise.resolve([])]);
      S.trips = t || []; S.mine = m || []; S.loaded = true;
    } catch (e) { if (!silent) toast(e.message, 'err'); S.err = e.message; }
    if (!L.alive()) return;
    const act = S.mine.filter(i => ['booked', 'loaded'].includes(i.status)).length, n = L.body.querySelector('.cg-n'); n.textContent = act; n.classList.toggle('hidden', !act);
    render();
  }

  function tripCard(t) {
    const rem = Number(t.remaining_kg), full = rem < 1, d = new Date(t.depart_at);
    return `<article class="cg-card ${full ? 'is-full' : ''}"><div class="cg-row"><div class="cg-ico">${ic('truck', 26)}</div><div class="grow"><b>${esc(t.origin)} <span class="cg-arr">${ic('arrow', 16)}</span> ${esc(t.destination)}</b><small>${esc(t.truck_name)} · سعة ${num(t.capacity_kg)} كغ</small></div><span class="cg-pill ${full ? 'red' : 'green'}">${full ? 'ممتلئة' : 'متاحة'}</span></div>
      <div class="cg-when">${ic('clock', 16)} ${dFmt(d)} · ${tFmt(d)}</div>
      ${bar(Number(t.booked_kg), t.capacity_kg)}<div class="cg-fill"><span>محجوز ${num(t.booked_kg)} كغ</span><b>${full ? 'لا يوجد مكان' : 'متبقي ' + num(rem) + ' كغ'}</b></div>
      <div class="cg-meta"><span>${ic('scale', 15)} ${money(t.price_per_kg)} / كغ</span>${Number(t.min_charge) ? `<span>الحد الأدنى ${money(t.min_charge)}</span>` : ''}<span>${ic('box', 15)} ${t.items} شحنة</span></div>
      ${t.notes ? `<p class="cg-note">${esc(t.notes)}</p>` : ''}
      <button class="btn full ${full ? 'light' : ''}" data-book="${t.id}" ${full ? 'disabled' : ''}>${full ? 'ممتلئة' : ic('plus', 18) + ' احجز مكاناً'}</button></article>`;
  }
  function mineCard(i) {
    const steps = ['محجوز', 'تم التحميل', 'في الطريق', 'مسلّم'], cancelled = i.status === 'cancelled';
    const idx = i.status === 'delivered' ? 3 : (i.status === 'loaded' && i.trip_status === 'on_way') ? 2 : i.status === 'loaded' ? 1 : 0;
    const d = new Date(i.depart_at), live = ['booked', 'loaded'].includes(i.status);
    return `<article class="cg-card ${cancelled ? 'is-off' : ''}"><div class="cg-row"><div class="cg-ico">${ic('box', 24)}</div><div class="grow"><b>${esc(i.description)}</b><small>${esc(i.origin)} ← ${esc(i.destination)} · ${dFmt(d)}</small></div><span class="cg-pill ${i.status}">${ITEM_ST[i.status]}</span></div>
      <div class="cg-meta"><span>${ic('scale', 15)} ${num(i.weight_kg)} كغ · ${i.packages} طرد</span><span>${money(i.price)}</span>${i.fragile ? `<span class="warnx">${ic('alert', 15)} قابل للكسر</span>` : ''}${i.shop_name ? `<span>${esc(i.shop_name)}</span>` : ''}</div>
      ${cancelled ? '' : `<ol class="cg-steps">${steps.map((s, k) => `<li class="${k <= idx ? 'on' : ''}"><i>${k < idx ? ic('check', 12) : k + 1}</i><span>${s}</span></li>`).join('')}</ol>`}
      <div class="cg-to">${ic('user', 15)} المستلم: <b>${esc(i.receiver_name)}</b> <a href="tel:${tel(i.receiver_phone)}" dir="ltr">${esc(i.receiver_phone)}</a></div>
      ${live ? `<div class="cg-pin"><small>رمز التسليم</small><b dir="ltr">${esc(i.pin)}</b><small>أعطه للمستلم، يطلبه السائق عند التسليم</small></div>` : ''}
      <div class="cg-acts">${i.driver_phone && live ? `<a class="btn light" href="tel:${tel(i.driver_phone)}">${ic('phone', 18)} اتصال بالسائق</a>` : ''}${i.status === 'booked' && ['open', 'closed'].includes(i.trip_status) ? `<button class="btn light danger" data-cancel="${i.id}">إلغاء الحجز</button>` : ''}</div></article>`;
  }
  function render() {
    if (!S.loaded) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    if (S.tab === 'mine') {
      const act = S.mine.filter(i => ['booked', 'loaded'].includes(i.status)), kg = act.reduce((s, i) => s + Number(i.weight_kg), 0), tot = act.reduce((s, i) => s + Number(i.price), 0);
      pane.innerHTML = !token() ? `<div class="empty-st">${ic('shield', 44)}<h3>سجّل الدخول لحجز الشحنات</h3></div>` : !S.mine.length ? `<div class="empty-st">${ic('box', 46)}<h3>لا توجد شحنات بعد</h3><p class="muted">احجز مكاناً لبضاعتك في أقرب شاحنة.</p><button class="btn" data-go="trips">تصفح الرحلات</button></div>`
        : `<div class="cg-sum"><div><b>${act.length}</b><small>شحنة فعّالة</small></div><div><b>${num(kg)}</b><small>كغ</small></div><div><b>${num(tot)}</b><small>ل.س</small></div></div>${S.mine.map(mineCard).join('')}`;
      return;
    }
    const dests = [...new Set(S.trips.map(t => t.destination))];
    const list = S.trips.filter(t => !S.dest || t.destination === S.dest);
    pane.innerHTML = `<div class="cg-hero"><div class="cg-hero-ico">${ic('truck', 40)}</div><div><h3>شاحنات 2 طن بين المدن</h3><p>ضع بضاعتك مع بضائع غيرك حتى تمتلئ الشاحنة وتنطلق. تدفع على الوزن فقط.</p></div></div>
      <div class="cg-how"><span>${ic('list', 16)} اختر رحلة</span><i></i><span>${ic('scale', 16)} حدّد الوزن</span><i></i><span>${ic('shield', 16)} استلم رمز التسليم</span></div>
      ${dests.length > 1 ? `<div class="filt cg-dests"><button class="fchip ${!S.dest ? 'on' : ''}" data-dest="">الكل</button>${dests.map(d => `<button class="fchip ${S.dest === d ? 'on' : ''}" data-dest="${esc(d)}">${esc(d)}</button>`).join('')}</div>` : ''}
      ${list.length ? list.map(tripCard).join('') : `<div class="empty-st">${ic('truck', 46)}<h3>لا توجد رحلات معلنة</h3><p class="muted">ستظهر هنا الرحلات القادمة فور إعلانها. تابعنا أو اتصل بالدعم.</p></div>`}`;
  }
  pane.addEventListener('click', async e => {
    const g = e.target.closest('[data-go]'); if (g) return setTab(g.dataset.go);
    const d = e.target.closest('[data-dest]'); if (d) { S.dest = d.dataset.dest; return render(); }
    const b = e.target.closest('[data-book]'); if (b) { if (!token()) return toast('سجّل الدخول أولاً لحجز شحنة.', 'err'); const t = S.trips.find(x => x.id === +b.dataset.book); return openBook(t, S.trips, async r => { await load(true); if (r) setTab('mine'); }); }
    const c = e.target.closest('[data-cancel]');
    if (c) { const r = await ask({ title: 'إلغاء هذا الحجز؟', text: 'سيتحرر المكان لغيرك.', ok: 'نعم، ألغِ', danger: true }); if (!r) return; try { const ok = await rpc('cargo_cancel_item', { p_item: +c.dataset.cancel }); toast(ok ? 'تم إلغاء الحجز' : 'لا يمكن الإلغاء الآن', ok ? 'ok' : 'err'); await load(true); } catch (x) { toast(x.message, 'err'); } }
  });
  render(); load();
  const tm = setInterval(() => { if (!L.alive()) return clearInterval(tm); if (!document.hidden) load(true); }, 20000);
}

function openBook(trip, allTrips, done) {
  const L = layer('حجز مكان في الشاحنة');
  const sameDest = allTrips.filter(t => t.destination === trip.destination && Number(t.remaining_kg) >= 1);
  const freeDest = sameDest.reduce((s, t) => s + Number(t.remaining_kg), 0), rem = Number(trip.remaining_kg);
  const d = new Date(trip.depart_at);
  L.body.innerHTML = `<div class="cg-pad"><article class="cg-card slim"><div class="cg-row"><div class="cg-ico">${ic('truck', 24)}</div><div class="grow"><b>${esc(trip.origin)} ← ${esc(trip.destination)}</b><small>${dFmt(d)} · ${tFmt(d)} · ${esc(trip.truck_name)}</small></div></div>${bar(Number(trip.booked_kg), trip.capacity_kg)}<div class="cg-fill"><span>${money(trip.price_per_kg)} / كغ${Number(trip.min_charge) ? ` · حد أدنى ${money(trip.min_charge)}` : ''}</span><b>متبقي ${num(rem)} كغ</b></div></article>
    <form id="bf" novalidate>
      <label class="cg-f"><span>ماذا تشحن؟ *</span><input name="desc" maxlength="200" placeholder="مثال: 10 كراتين مواد تنظيف" required></label>
      <div class="cg-f"><span>نوع البضاعة</span><div class="cg-cats">${CATS.map((c, i) => `<button type="button" class="fchip ${i === 0 ? 'on' : ''}" data-cat="${esc(c)}">${c}</button>`).join('')}</div></div>
      <div class="cg-two"><label class="cg-f"><span>الوزن الكلي (كغ) *</span><input name="kg" inputmode="decimal" placeholder="0" dir="ltr" required></label><label class="cg-f"><span>عدد الطرود</span><input name="pk" inputmode="numeric" value="1" dir="ltr"></label></div>
      <div class="cg-quick">${[10, 50, 100, 250, 500].map(v => `<button type="button" data-add="${v}">+${v}</button>`).join('')}<button type="button" data-max>الحد الأقصى ${num(rem)}</button></div>
      <label class="cg-chk"><input type="checkbox" name="fr"><span>${ic('alert', 16)} بضاعة قابلة للكسر</span></label>
      <label class="cg-f"><span>اسم المحل (اختياري)</span><input name="shop" maxlength="80" value="${esc(lget('cargo-shop'))}" placeholder="مثال: محل الأمل"></label>
      <label class="cg-f"><span>مكان استلام البضاعة منك</span><input name="pick" maxlength="200" value="${esc(lget('cargo-pick'))}" placeholder="عنوان المحل أو المستودع"></label>
      <h4 class="cg-h">${ic('user', 18)} المستلم في الوجهة</h4>
      <div class="cg-two"><label class="cg-f"><span>الاسم *</span><input name="rn" maxlength="100" required></label><label class="cg-f"><span>الهاتف *</span><input name="rp" inputmode="tel" dir="ltr" maxlength="30" placeholder="09xxxxxxxx" required></label></div>
      <label class="cg-f"><span>عنوان التسليم</span><input name="ra" maxlength="200" placeholder="الحي، الشارع، المحل"></label>
      <div class="cg-est" id="est"></div><div id="spl"></div><p class="auth-msg" id="msg" role="alert"></p>
      <button class="btn full big" id="go" type="submit">${ic('check', 20)} تأكيد الحجز</button></form></div>`;
  const f = L.body.querySelector('#bf'), est = f.querySelector('#est'), spl = f.querySelector('#spl'), msg = f.querySelector('#msg'), go = f.querySelector('#go');
  let cat = CATS[0];
  const kg = () => Math.max(0, parseFloat(String(f.kg.value).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(',', '.')) || 0);
  const upd = () => {
    const w = kg(), price = w ? Math.max(Number(trip.min_charge), Math.round(w * Number(trip.price_per_kg))) : 0, over = w > rem;
    est.innerHTML = w ? `<div><small>التكلفة التقديرية</small><b>${money(price)}</b></div><div><small>حصتك من الشاحنة</small><b>${Math.min(100, Math.round(w / trip.capacity_kg * 100))}%</b></div>` : '<small>اكتب الوزن لتعرف التكلفة</small>';
    spl.innerHTML = over ? (w <= freeDest ? `<p class="cg-info">${ic('truck', 16)} وزنك أكبر من المتاح هنا (${num(rem)} كغ). سنوزّع الباقي تلقائياً على الشاحنات التالية إلى ${esc(trip.destination)} (${sameDest.length} رحلات، متاح ${num(freeDest)} كغ).</p>` : `<p class="cg-info bad">${ic('alert', 16)} الوزن أكبر من المتاح في كل الشاحنات القادمة إلى ${esc(trip.destination)} (${num(freeDest)} كغ).</p>`) : '';
  };
  f.addEventListener('input', upd); upd();
  f.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; f.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('on', b === c)); }
    const a = e.target.closest('[data-add]'); if (a) { f.kg.value = String((kg() + +a.dataset.add)); upd(); }
    if (e.target.closest('[data-max]')) { f.kg.value = String(Math.floor(rem)); upd(); }
  });
  f.addEventListener('submit', async e => {
    e.preventDefault(); msg.className = 'auth-msg';
    const w = kg(), fail = t => { msg.textContent = t; msg.className = 'auth-msg show'; msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    if (f.desc.value.trim().length < 2) return fail('اكتب ماذا تشحن.');
    if (!w || w < 1) return fail('اكتب الوزن بالكيلوغرام (1 كغ على الأقل).');
    if (w > freeDest) return fail(`الوزن أكبر من المتاح (${num(freeDest)} كغ).`);
    if (!f.rn.value.trim()) return fail('اكتب اسم المستلم.');
    if (!phoneOk(f.rp.value)) return fail('اكتب هاتف المستلم بشكل صحيح.');
    go.disabled = true; const lab = go.innerHTML; go.textContent = 'جارٍ الحجز…';
    const a = { p_weight: w, p_desc: f.desc.value.trim(), p_cat: cat, p_packages: Math.max(1, parseInt(f.pk.value) || 1), p_fragile: f.fr.checked, p_pickup: f.pick.value.trim(), p_rname: f.rn.value.trim(), p_rphone: f.rp.value.trim(), p_raddr: f.ra.value.trim(), p_shop: f.shop.value.trim() || null };
    try {
      lset('cargo-shop', f.shop.value.trim()); lset('cargo-pick', f.pick.value.trim());
      const r = w > rem ? await rpc('cargo_book_auto', { p_dest: trip.destination, ...a }) : [await rpc('cargo_book', { p_trip: trip.id, ...a })];
      success(L, r, trip, f.rn.value.trim(), done);
    } catch (x) { fail(x.message); go.disabled = false; go.innerHTML = lab; }
  });
}
function success(L, parts, trip, rname, done) {
  const total = parts.reduce((s, p) => s + Number(p.price), 0), pin = parts[0].pin;
  const text = `شحنة جديدة عبر تطبيق وين؟\nمن ${trip.origin} إلى ${trip.destination}\nالمستلم: ${rname}\nرمز التسليم: ${pin}\nأعطه للسائق عند الاستلام.`;
  L.body.innerHTML = `<div class="cg-ok"><div class="cg-check">${ic('check', 46)}</div><h2>تم حجز مكانك ✅</h2>
    <p class="muted">${parts.length > 1 ? `وُزّعت شحنتك على ${parts.length} شاحنات` : `${esc(trip.origin)} ← ${esc(trip.destination)}`}</p>
    <div class="cg-pin big"><small>رمز التسليم للمستلم</small><b dir="ltr">${esc(pin)}</b><small>يعطيه المستلم للسائق عند استلام البضاعة</small></div>
    <div class="cg-sum"><div><b>${num(parts.reduce((s, p) => s + Number(p.weight_kg), 0))}</b><small>كغ</small></div><div><b>${num(total)}</b><small>ل.س (نقداً عند التسليم)</small></div></div>
    <a class="btn full" target="_blank" rel="noopener" href="${waLink(text)}">${ic('share', 18)} أرسل الرمز للمستلم عبر واتساب</a><button class="btn light full" id="mine">شحناتي</button><button class="btn light full" id="again">حجز آخر</button></div>`;
  L.body.querySelector('#mine').onclick = () => { L.close(); done(true); };
  L.body.querySelector('#again').onclick = () => { L.close(); done(false); };
}

/* =====================================================================
   الإدارة
   ===================================================================== */
export function openCargoAdmin() {
  if (document.querySelector('.overlay.cg-admin')) return;
  const L = layer('إدارة الشحن'); L.el.classList.add('cg-admin');
  const S = { tab: 'trips', trips: [], trucks: [], stats: null };
  L.body.innerHTML = `<div class="cg-tabs three"><button data-t="trips" class="on">${ic('list', 18)} الرحلات</button><button data-t="trucks">${ic('truck', 18)} الشاحنات</button><button data-t="stats">${ic('chart', 18)} إحصاءات</button></div><div class="cg-pane" id="pane"></div>`;
  const pane = L.body.querySelector('#pane'), tabs = [...L.body.querySelectorAll('[data-t]')];
  const setTab = t => { S.tab = t; tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); };
  tabs.forEach(b => b.onclick = () => setTab(b.dataset.t));
  async function load() {
    try { [S.trips, S.trucks, S.stats] = await Promise.all([rpc('cargo_admin_trips'), rpc('cargo_admin_trucks'), rpc('cargo_admin_stats')]); S.ok = true; }
    catch (e) { toast(e.message, 'err'); S.err = e.message; }
    if (L.alive()) render();
  }
  const tripRow = t => { const d = new Date(t.depart_at); return `<article class="cg-card" data-trip="${t.id}"><div class="cg-row"><div class="cg-ico">${ic('truck', 24)}</div><div class="grow"><b>${esc(t.origin)} ← ${esc(t.destination)}</b><small>${esc(t.truck_name)} · ${dFmt(d)} ${tFmt(d)}</small></div><span class="cg-pill t-${t.status}">${TRIP_ST[t.status]}</span></div>${bar(Number(t.booked_kg), t.capacity_kg)}<div class="cg-fill"><span>${num(t.booked_kg)} / ${num(t.capacity_kg)} كغ · ${t.items} شحنة</span><b>${money(t.revenue)}</b></div></article>`; };
  function render() {
    if (S.err && !S.ok) { pane.innerHTML = `<div class="empty-st">${ic('shield', 44)}<h3>${esc(S.err)}</h3></div>`; return; }
    if (!S.ok) { pane.innerHTML = '<div class="spin mid"></div>'; return; }
    if (S.tab === 'trips') pane.innerHTML = `<button class="btn full" data-newtrip>${ic('plus', 18)} إعلان رحلة جديدة</button>${S.trips.length ? S.trips.map(tripRow).join('') : `<div class="empty-st">${ic('truck', 46)}<h3>لا توجد رحلات</h3><p class="muted">${S.trucks.length ? 'أعلن أول رحلة ليبدأ الزبائن بالحجز.' : 'أضف شاحنة أولاً من تبويب «الشاحنات».'}</p></div>`}`;
    else if (S.tab === 'trucks') pane.innerHTML = `<button class="btn full" data-truck="0">${ic('plus', 18)} إضافة شاحنة</button>${S.trucks.map(k => `<article class="cg-card ${k.active ? '' : 'is-off'}" data-truck="${k.id}"><div class="cg-row"><div class="cg-ico">${ic('truck', 24)}</div><div class="grow"><b>${esc(k.name)}</b><small>${esc(k.plate || '—')} · ${num(k.capacity_kg)} كغ</small></div><span class="cg-pill ${k.active ? 'green' : 'red'}">${k.active ? 'فعّالة' : 'متوقفة'}</span></div><div class="cg-to">${ic('user', 15)} ${esc(k.driver_name || 'بدون سائق')} ${k.driver_phone ? `<a href="tel:${tel(k.driver_phone)}" dir="ltr">${esc(k.driver_phone)}</a>` : ''}</div></article>`).join('')}`;
    else { const s = S.stats || {}; pane.innerHTML = `<div class="cg-stat"><div><b>${s.trips_open ?? 0}</b><small>رحلات نشطة</small></div><div><b>${num(s.booked_kg)}</b><small>كغ محجوز</small></div><div><b>${num(s.delivered_kg)}</b><small>كغ سُلّم</small></div><div class="g"><b>${num(s.revenue)}</b><small>ل.س إيراد محصّل</small></div><div><b>${num(s.pending_revenue)}</b><small>ل.س قيد التحصيل</small></div></div><p class="muted small center">الإيراد = مجموع أسعار الشحنات المسلّمة. الدفع نقداً عند التسليم خارج التطبيق.</p>`; }
  }
  pane.addEventListener('click', e => {
    if (e.target.closest('[data-newtrip]')) return tripForm(S.trucks.filter(k => k.active), null, load);
    const k = e.target.closest('[data-truck]'); if (k) return truckForm(S.trucks.find(x => x.id === +k.dataset.truck) || null, load);
    const t = e.target.closest('[data-trip]'); if (t) return tripDetail(S.trips.find(x => x.id === +t.dataset.trip), S.trucks, load);
  });
  render(); load();
}
function toLocalInput(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function tripForm(trucks, copy, after) {
  const L = layer(copy ? 'تكرار الرحلة' : 'إعلان رحلة'); if (!trucks.length) { L.body.innerHTML = `<div class="empty-st">${ic('truck', 46)}<h3>لا توجد شاحنة فعّالة</h3><p class="muted">أضف شاحنة أولاً.</p></div>`; return; }
  const tm = new Date(Date.now() + 86400000); tm.setHours(8, 0, 0, 0);
  const dd = copy ? new Date(new Date(copy.depart_at).getTime() + 7 * 86400000) : tm;
  L.body.innerHTML = `<form class="cg-pad" id="tf" novalidate><label class="cg-f"><span>الشاحنة</span><select name="truck">${trucks.map(k => `<option value="${k.id}" data-cap="${k.capacity_kg}" ${copy && copy.truck_id === k.id ? 'selected' : ''}>${esc(k.name)} (${num(k.capacity_kg)} كغ)</option>`).join('')}</select></label>
    <div class="cg-two"><label class="cg-f"><span>من</span><input name="o" value="${esc(copy?.origin || lget('cg-origin', 'يبرود'))}" maxlength="60"></label><label class="cg-f"><span>إلى *</span><input name="d" value="${esc(copy?.destination || '')}" maxlength="60" placeholder="دمشق" list="dl"></label></div><datalist id="dl"><option>دمشق<option>حمص<option>حلب<option>النبك<option>القلمون</datalist>
    <label class="cg-f"><span>موعد الانطلاق</span><input name="when" type="datetime-local" value="${toLocalInput(dd)}"></label>
    <div class="cg-two"><label class="cg-f"><span>سعة هذه الرحلة (كغ)</span><input name="cap" inputmode="numeric" dir="ltr" value="${copy?.capacity_kg || trucks[0].capacity_kg}"></label><label class="cg-f"><span>سعر الكيلو (ل.س) *</span><input name="ppk" inputmode="decimal" dir="ltr" value="${copy?.price_per_kg || ''}" placeholder="500"></label></div>
    <label class="cg-f"><span>حد أدنى للشحنة (ل.س)</span><input name="min" inputmode="decimal" dir="ltr" value="${copy?.min_charge || 0}"></label>
    <label class="cg-f"><span>ملاحظات للزبائن (اختياري)</span><input name="notes" maxlength="200" value="${esc(copy?.notes || '')}" placeholder="مثال: لا نحمل مواد خطرة"></label>
    <p class="auth-msg" id="msg" role="alert"></p><button class="btn full big" type="submit">${ic('check', 20)} نشر الرحلة</button></form>`;
  const f = L.body.querySelector('#tf'), msg = f.querySelector('#msg');
  f.truck.onchange = () => { f.cap.value = f.truck.selectedOptions[0].dataset.cap; };
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fail = t => { msg.textContent = t; msg.className = 'auth-msg show'; };
    const dt = new Date(f.when.value), ppk = parseFloat(f.ppk.value), cap = parseInt(f.cap.value);
    if (!f.d.value.trim()) return fail('اكتب الوجهة.'); if (isNaN(dt)) return fail('اختر موعد الانطلاق.'); if (!(ppk >= 0) || f.ppk.value === '') return fail('اكتب سعر الكيلو.'); if (!(cap >= 100)) return fail('السعة غير صحيحة.');
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try { lset('cg-origin', f.o.value.trim()); await rpc('cargo_admin_create_trip', { p_truck: +f.truck.value, p_origin: f.o.value.trim(), p_dest: f.d.value.trim(), p_depart: dt.toISOString(), p_cap: cap, p_ppk: ppk, p_min: parseFloat(f.min.value) || 0, p_notes: f.notes.value.trim() || null }); toast('تم نشر الرحلة', 'ok'); L.close(); after(); }
    catch (x) { fail(x.message); b.disabled = false; }
  });
}
function truckForm(k, after) {
  const L = layer(k ? 'تعديل الشاحنة' : 'إضافة شاحنة');
  L.body.innerHTML = `<form class="cg-pad" id="kf" novalidate><label class="cg-f"><span>اسم الشاحنة *</span><input name="n" maxlength="60" value="${esc(k?.name || '')}" placeholder="شاحنة 1"></label>
    <div class="cg-two"><label class="cg-f"><span>اللوحة</span><input name="p" maxlength="30" value="${esc(k?.plate || '')}" dir="ltr"></label><label class="cg-f"><span>السعة (كغ)</span><input name="c" inputmode="numeric" dir="ltr" value="${k?.capacity_kg || 2000}"></label></div>
    <div class="cg-two"><label class="cg-f"><span>اسم السائق</span><input name="dn" maxlength="60" value="${esc(k?.driver_name || '')}"></label><label class="cg-f"><span>هاتف السائق</span><input name="dp" inputmode="tel" dir="ltr" maxlength="30" value="${esc(k?.driver_phone || '')}"></label></div>
    <label class="cg-chk"><input type="checkbox" name="a" ${k?.active === false ? '' : 'checked'}><span>الشاحنة فعّالة</span></label><p class="auth-msg" id="msg"></p><button class="btn full big" type="submit">${ic('check', 20)} حفظ</button></form>`;
  const f = L.body.querySelector('#kf');
  f.addEventListener('submit', async e => {
    e.preventDefault(); const msg = f.querySelector('#msg'); if (!f.n.value.trim()) { msg.textContent = 'اكتب اسم الشاحنة.'; msg.className = 'auth-msg show'; return; }
    try { await rpc('cargo_admin_save_truck', { p_id: k?.id ?? null, p_name: f.n.value.trim(), p_plate: f.p.value.trim() || null, p_cap: parseInt(f.c.value) || 2000, p_driver: f.dn.value.trim() || null, p_phone: f.dp.value.trim() || null, p_active: f.a.checked }); toast('تم الحفظ', 'ok'); L.close(); after(); }
    catch (x) { msg.textContent = x.message; msg.className = 'auth-msg show'; }
  });
}
function tripDetail(t, trucks, after) {
  const L = layer('كشف الرحلة'); const S = { items: [] };
  const d = new Date(t.depart_at);
  async function load() { try { S.items = await rpc('cargo_admin_items', { p_trip: t.id }); } catch (e) { toast(e.message, 'err'); } if (L.alive()) draw(); }
  const manifest = () => { const live = S.items.filter(i => i.status !== 'cancelled'); return `كشف شحن ${t.origin} ← ${t.destination}\n${dFmt(d)} ${tFmt(d)} · ${t.truck_name}\n${'─'.repeat(14)}\n` + live.map((i, n) => `${n + 1}) ${i.description} — ${num(i.weight_kg)} كغ (${i.packages} طرد)${i.fragile ? ' ⚠ هش' : ''}\n   من: ${i.shop_name || i.owner_name} ${i.pickup_address ? '(' + i.pickup_address + ')' : ''}\n   إلى: ${i.receiver_name} ${i.receiver_phone} ${i.receiver_address || ''}\n   المبلغ: ${num(i.price)} ل.س`).join('\n') + `\n${'─'.repeat(14)}\nالإجمالي: ${num(live.reduce((s, i) => s + Number(i.weight_kg), 0))} كغ · ${num(live.reduce((s, i) => s + Number(i.price), 0))} ل.س`; };
  function draw() {
    const live = S.items.filter(i => i.status !== 'cancelled'), kg = live.reduce((s, i) => s + Number(i.weight_kg), 0), fin = ['delivered', 'cancelled'].includes(t.status);
    L.body.innerHTML = `<div class="cg-pad"><article class="cg-card slim"><div class="cg-row"><div class="cg-ico">${ic('truck', 24)}</div><div class="grow"><b>${esc(t.origin)} ← ${esc(t.destination)}</b><small>${esc(t.truck_name)} · ${dFmt(d)} ${tFmt(d)}</small></div><span class="cg-pill t-${t.status}">${TRIP_ST[t.status]}</span></div>${bar(kg, t.capacity_kg)}<div class="cg-fill"><span>${num(kg)} / ${num(t.capacity_kg)} كغ</span><b>${money(live.reduce((s, i) => s + Number(i.price), 0))}</b></div><div class="cg-meta"><span>${money(t.price_per_kg)} / كغ</span>${t.driver_phone ? `<a href="tel:${tel(t.driver_phone)}" dir="ltr">${ic('phone', 15)} ${esc(t.driver_name || 'السائق')}</a>` : ''}</div></article>
      ${fin ? '' : `<div class="cg-acts wrap">${t.status === 'open' ? '<button class="btn light" data-st="closed">إغلاق الحجز</button>' : ''}${t.status === 'closed' ? '<button class="btn light" data-st="open">إعادة الفتح</button>' : ''}${['open', 'closed'].includes(t.status) ? '<button class="btn" data-st="on_way">انطلقت الشاحنة</button>' : ''}${t.status === 'on_way' ? '<button class="btn" data-st="delivered">تم تسليم الكل</button>' : ''}<button class="btn light danger" data-st="cancelled">إلغاء الرحلة</button></div>`}
      <div class="cg-acts wrap"><button class="btn light" data-copy>${ic('copy', 18)} نسخ الكشف</button><a class="btn light" target="_blank" rel="noopener" href="${waLink(manifest())}">${ic('share', 18)} إرسال للسائق</a><button class="btn light" data-repeat>تكرار الرحلة</button></div>
      <h4 class="cg-h">${ic('box', 18)} الشحنات (${live.length})</h4>
      ${S.items.length ? S.items.map(i => `<article class="cg-card slim ${i.status === 'cancelled' ? 'is-off' : ''}"><div class="cg-row"><div class="grow"><b>${esc(i.description)}</b><small>${esc(i.shop_name || i.owner_name)} · <a href="tel:${tel(i.owner_phone)}" dir="ltr">${esc(i.owner_phone || '')}</a></small></div><span class="cg-pill ${i.status}">${ITEM_ST[i.status]}</span></div>
        <div class="cg-meta"><span>${num(i.weight_kg)} كغ · ${i.packages} طرد</span><span>${money(i.price)}</span>${i.fragile ? `<span class="warnx">هش</span>` : ''}${i.pickup_address ? `<span>${ic('pin', 14)} ${esc(i.pickup_address)}</span>` : ''}</div>
        <div class="cg-to">${ic('user', 15)} ${esc(i.receiver_name)} <a href="tel:${tel(i.receiver_phone)}" dir="ltr">${esc(i.receiver_phone)}</a> ${esc(i.receiver_address || '')}</div>
        ${i.status === 'booked' && !fin ? `<div class="cg-acts"><button class="btn light" data-mark="${i.id}" data-s="loaded">تم التحميل</button></div>` : ''}${['booked', 'loaded'].includes(i.status) && ['on_way', 'closed', 'open'].includes(t.status) ? `<div class="cg-acts"><button class="btn" data-mark="${i.id}" data-s="delivered">${ic('shield', 18)} تسليم برمز المستلم</button></div>` : ''}</article>`).join('') : '<p class="center muted">لا توجد حجوزات بعد.</p>'}</div>`;
  }
  L.body.addEventListener('click', async e => {
    const s = e.target.closest('[data-st]');
    if (s) {
      const st = s.dataset.st, txt = { cancelled: 'إلغاء الرحلة؟ ستُلغى كل الحجوزات.', delivered: 'تأكيد تسليم كل الشحنات؟', on_way: 'تأكيد انطلاق الشاحنة؟ ستُعلَّم الشحنات كمحمّلة.' }[st];
      if (txt && !await ask({ title: txt, ok: 'نعم', danger: st === 'cancelled' })) return;
      try { await rpc('cargo_admin_set_trip', { p_trip: t.id, p_status: st }); toast('تم', 'ok'); t.status = st; await after(); load(); } catch (x) { toast(x.message, 'err'); } return;
    }
    if (e.target.closest('[data-copy]')) { try { await navigator.clipboard.writeText(manifest()); toast('تم نسخ الكشف', 'ok'); } catch { toast('تعذر النسخ', 'err'); } return; }
    if (e.target.closest('[data-repeat]')) return tripForm(trucks.filter(k => k.active), t, after);
    const m = e.target.closest('[data-mark]');
    if (m) {
      const id = +m.dataset.mark, st = m.dataset.s;
      try {
        if (st === 'loaded') { await rpc('cargo_admin_mark', { p_item: id, p_status: 'loaded' }); toast('تم', 'ok'); }
        else {
          const r = await ask({ title: 'تسليم الشحنة', text: 'اطلب من المستلم رمز التسليم (4 أرقام).', fields: [{ name: 'pin', label: 'الرمز', inputmode: 'numeric', dir: 'ltr', maxlength: 4 }], ok: 'تسليم' }); if (!r) return;
          const res = await rpc('cargo_admin_mark', { p_item: id, p_status: 'delivered', p_pin: r.pin });
          if (res === 'bad_pin') { const force = await ask({ title: 'الرمز غير صحيح', text: 'هل تريد تسليمها دون رمز (على مسؤوليتك)؟', ok: 'تسليم دون رمز', danger: true }); if (!force) return; await rpc('cargo_admin_mark', { p_item: id, p_status: 'delivered', p_force: true }); }
          toast('تم التسليم', 'ok');
        }
        await after(); load();
      } catch (x) { toast(x.message, 'err'); }
    }
  });
  L.body.innerHTML = '<div class="spin mid"></div>'; load();
}

/* =====================================================================
   الربط بالتطبيق: بلاطة الشحن في الرئيسية + زر الإدارة (دون تعديل ملفات أخرى)
   ===================================================================== */
let adminTok = null, isAdmin = false, checking = false;
async function checkAdmin() {
  const t = token(); if (t === adminTok || checking) return; adminTok = t; isAdmin = false; checking = true;
  try { if (t) { await rpc('cargo_admin_stats'); isAdmin = true; } } catch { isAdmin = false; } finally { checking = false; }
  inject();
}
function inject() {
  const svc = document.querySelector('#sheet .svc');
  if (svc && !svc.parentElement.querySelector('.cg-tile')) {
    const b = document.createElement('button'); b.className = 'cg-tile'; b.type = 'button'; b.dataset.cargo = '1';
    b.innerHTML = `<span class="cg-tile-ico">${ic('truck', 30)}</span><span class="grow"><b>شحن بضائع</b><small>شاحنة 2 طن · للمحلات والتجار · ادفع على الوزن</small></span>${ic('back', 18, 'chev')}`;
    svc.insertAdjacentElement('afterend', b);
  }
  const shell = document.querySelector('.shell'), fab = document.querySelector('.cg-fab');
  if (isAdmin && shell && !fab) { const b = document.createElement('button'); b.className = 'cg-fab'; b.type = 'button'; b.dataset.cargoAdmin = '1'; b.innerHTML = `${ic('truck', 22)}<span>الشحن</span>`; document.body.appendChild(b); }
  if ((!isAdmin || !shell) && fab) fab.remove();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-cargo]')) { e.preventDefault(); openCargo(); }
  else if (e.target.closest('[data-cargo-admin]')) { e.preventDefault(); openCargoAdmin(); }
});
let tmr = null;
new MutationObserver(() => { clearTimeout(tmr); tmr = setTimeout(() => { inject(); checkAdmin(); }, 120); }).observe(document.documentElement, { childList: true, subtree: true });
window.openCargo = openCargo; window.openCargoAdmin = openCargoAdmin;
setTimeout(() => { inject(); checkAdmin(); }, 400);
