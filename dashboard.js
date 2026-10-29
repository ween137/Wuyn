// لوحة الإدارة: نظرة عامة، كل الطلبات بتفاصيلها، خريطة حية، الحسابات، طلبات التفعيل والرموز
import { esc, toast, money, fmtKm, fmtDate, fmtTime, ago, errMsg, roleNames, stName, sizeNames, toggleTheme } from './utils.js';
import { ic } from './icons.js';
import { buildShell } from './shell.js';
import { createMap, YABROUD } from './map.js';
import { ensureLeaflet } from './loader.js';
import { confirmBox } from './rides.js';
import { normalizePhone } from './signin.js';
import { openChat } from './chat.js';
import { starRow } from './directory.js';

const APP_URL = 'https://wuyn.netlify.app';
const WANT = { driver: 'سائق سيارة', motor: 'متور توصيل', office: 'مكتب تكسي' };
const ACTIVE = ['searching', 'accepted', 'on_the_way', 'arrived', 'started', 'no_driver'];
const stCls = s => s === 'completed' ? 'ok' : (s === 'cancelled' || s === 'no_driver') ? 'bad' : 'live';
const tel = p => p ? `<a class="tl" href="tel:${esc(p)}" dir="ltr">${esc(p)}</a>` : '';
const roleOf = p => p.vehicle_kind === 'motor' ? 'motor' : p.role;

export function mountAdmin({ app, db, user, logout }) {
  const A = { daily: [], top: [], reviews: [], custs: {}, allRev: false, stats: null, rides: [], live: [], people: [], invites: [], reqs: [], rf: { kind: 'all', st: 'all', q: '' }, pf: { role: 'all', q: '' }, rendered: {} };
  const timers = []; let map = null, shell, alive = true;
  const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if (error) throw error; return data; };
  const $ = (id) => shell.panes[id];

  shell = buildShell(app, {
    subtitle: 'لوحة الإدارة', start: 'over',
    right: `<button class="tab" id="a-out">خروج</button>`,
    tabs: [['over', 'نظرة', 'chart'], ['rides', 'الطلبات', 'list'], ['live', 'الخريطة', 'pin'], ['people', 'الحسابات', 'users'], ['codes', 'التفعيل', 'lock']],
    onShow: (id, pane, first) => {
      if (first) { pane.addEventListener('click', onClick); pane.addEventListener('input', onInput); }
      ({ over: showOver, rides: showRides, live: showLive, people: showPeople, codes: showCodes })[id](pane, first);
    },
  });
  app.querySelector('#a-out').onclick = () => logout();
  timers.push(setInterval(() => { if (document.hidden) return; const c = shell.current(); if (c === 'over') loadOver(); else if (c === 'rides') loadRides(); else if (c === 'live') loadLive(); }, 15000));

  /* ---------- نظرة عامة ---------- */
  function showOver(pane, first) { if (first) pane.innerHTML = '<div class="page"><h2 class="ph">نظرة عامة</h2><div id="ov"><div class="spin mid"></div></div></div>'; loadOver(); }
  async function loadOver() {
    try { [A.stats, A.daily, A.top, A.reviews] = await Promise.all([rpc('admin_stats'), rpc('admin_daily', { p_days: 14 }), rpc('admin_top'), rpc('admin_reviews')]); } catch (e) { $('over').querySelector('#ov').innerHTML = `<p class="center">${esc(errMsg(e))}</p>`; return; }
    const s = A.stats, c = (n, l, cls = '', act = '') => `<div class="sc ${cls}" ${act ? `data-act="${act}"` : ''}><b>${n ?? 0}</b><small>${l}</small></div>`;
    $('over').querySelector('#ov').innerHTML = `
      <div class="hero-card"><small>إيراد اليوم (الرحلات المكتملة)</small><b>${money(s.revenue_today)}</b><span>${s.rides_today} طلب اليوم · منها ${s.deliveries_today} توصيل</span></div>
      ${s.pending_requests ? `<button class="alert-row" data-act="goto" data-t="codes">${ic('bell', 20)}<span><b>${s.pending_requests}</b> طلب تفعيل ينتظر رمزك</span>${ic('back', 16)}</button>` : ''}
      <h3 class="sec">الآن</h3><div class="sgrid">${c(s.active_now, 'طلبات جارية', 'hot', 'goto-rides')}${c(s.online, 'ظاهرون على الخريطة', 'ok', 'goto-live')}</div>
      <h3 class="sec">الطلبات</h3><div class="sgrid">${c(s.rides_total, 'كل الطلبات')}${c(s.deliveries_total, 'طلبات التوصيل')}${c(s.completed, 'مكتملة')}${c(s.cancelled, 'ملغاة / بلا رد')}</div>
      <h3 class="sec">الشبكة</h3><div class="sgrid">${c(s.offices, 'مكاتب')}${c(s.drivers, 'سائقو سيارات')}${c(s.motors, 'متورات')}${c(s.customers, 'زبائن')}${c(s.verified, 'هويات موثّقة')}${c(s.rating_avg ?? '—', 'متوسط التقييم')}</div>
      <h3 class="sec">آخر 14 يوماً</h3>${chart()}
      <h3 class="sec">أفضل المنفّذين</h3>${A.top.slice(0, 8).map((t, i) => `<div class="acard slim"><div class="rr-top"><b>${i + 1}. ${esc(t.name)}</b><span class="rate">${starRow(blend(t))}<b>${blend(t).toFixed(1)}</b><small>${t.rating_n ? '(' + t.rating_n + ')' : 'جديد'}</small></span></div>
        <small>${esc(roleNames[t.role] || '')} · ${t.trips} مكتملة · ${money(t.revenue)}${t.cancels ? ' · ألغى ' + t.cancels : ''}</small></div>`).join('') || '<p class="center muted">لا بيانات بعد.</p>'}
      <div class="row"><h3 class="sec">التقييمات</h3><button class="link" data-act="allrev">${A.allRev ? 'إخفاء' : 'عرض الكل'}</button></div>
      ${(A.allRev ? A.reviews : A.reviews.filter(r => r.rating <= 3).slice(0, 5)).map(r => `<div class="acard slim ${r.rating <= 2 ? 'warnc' : ''}"><div class="rr-top"><b>${esc(r.provider || '—')}</b>${starRow(r.rating)}</div><small>من ${esc(r.customer || '—')} · طلب #${r.id}${r.completed_at ? ' · ' + fmtDate(r.completed_at) : ''}</small>${r.comment ? `<p class="note">«${esc(r.comment)}»</p>` : ''}</div>`).join('') || `<p class="center muted">${A.allRev ? 'لا تقييمات بعد.' : 'لا توجد تقييمات منخفضة. ممتاز!'}</p>`}
      <p class="small center">إجمالي الإيراد: <b>${money(s.revenue_total)}</b> · يتحدث تلقائياً كل 15 ثانية</p>`;
  }

  const blend = t => (4 * 3 + (t.rating || 0) * (t.rating_n || 0)) / (3 + (t.rating_n || 0));
  function chart() {
    const d = A.daily; if (!d.length) return '';
    const mx = Math.max(1, ...d.map(x => x.rides)), mr = Math.max(1, ...d.map(x => x.revenue));
    return `<div class="card"><div class="bars14">${d.map(x => `<div title="${x.d}: ${x.rides} طلب"><b>${x.rides || ''}</b><i style="height:${Math.max(3, x.rides / mx * 100)}%"></i><small>${x.d.slice(8)}</small></div>`).join('')}</div>
      <div class="row"><small>الطلبات يومياً</small><small>إيراد 14 يوماً: <b>${money(d.reduce((s, x) => s + x.revenue, 0))}</b></small></div>
      <div class="bars14 rev">${d.map(x => `<div title="${x.d}: ${x.revenue}"><i style="height:${Math.max(2, x.revenue / mr * 100)}%"></i></div>`).join('')}</div><small>الإيراد يومياً</small></div>`;
  }

  /* ---------- الطلبات ---------- */
  function showRides(pane, first) {
    if (first) pane.innerHTML = `<div class="page"><div class="row"><h2 class="ph">كل الطلبات</h2><button class="btn light sm" data-act="csv">${ic('list', 16)} تصدير</button></div>
      <input class="notes" id="rq" placeholder="ابحث: اسم، رقم هاتف، مكان، رقم طلب" value="">
      <div class="filt" id="rf1"></div><div class="filt" id="rf2"></div><div id="rlist"><div class="spin mid"></div></div></div>`;
    loadRides();
  }
  async function loadRides() { try { A.rides = await rpc('admin_rides', { p_limit: 300 }) || []; drawRides(); } catch (e) { const l = $('rides').querySelector('#rlist'); if (l) l.innerHTML = `<p class="center">${esc(errMsg(e))}</p>`; } }
  function drawRides() {
    const p = $('rides'), f = A.rf;
    const K = [['all', 'الكل'], ['taxi', 'تكسي'], ['delivery', 'توصيل']], S = [['all', 'كل الحالات'], ['act', 'جارية'], ['completed', 'مكتملة'], ['bad', 'ملغاة']];
    p.querySelector('#rf1').innerHTML = K.map(([k, l]) => `<button class="fchip ${f.kind === k ? 'on' : ''}" data-act="rk" data-v="${k}">${l}</button>`).join('');
    p.querySelector('#rf2').innerHTML = S.map(([k, l]) => `<button class="fchip ${f.st === k ? 'on' : ''}" data-act="rs" data-v="${k}">${l}</button>`).join('');
    const q = f.q.toLowerCase();
    const rows = A.rides.filter(r => (f.kind === 'all' || r.kind === f.kind)
      && (f.st === 'all' || (f.st === 'act' ? ACTIVE.includes(r.status) && r.status !== 'no_driver' : f.st === 'bad' ? ['cancelled', 'no_driver'].includes(r.status) : r.status === f.st))
      && (!q || [r.id, r.customer_name, r.customer_phone, r.provider_name, r.provider_phone, r.pickup, r.dropoff, r.item].join(' ').toLowerCase().includes(q)));
    p.querySelector('#rlist').innerHTML = rows.length ? rows.map(rideCard).join('') : `<div class="empty-st">${ic('list', 40)}<h3>لا توجد طلبات</h3></div>`;
  }
  function rideCard(r) {
    const del = r.kind === 'delivery', o = r.options || {};
    const wait = r.accepted_at ? Math.max(1, Math.round((new Date(r.accepted_at) - new Date(r.created_at)) / 60000)) : null;
    const dur = r.started_at && r.completed_at ? Math.max(1, Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 60000)) : null;
    const optTxt = [o.luggage && 'أمتعة', o.ac && 'تكييف', o.child_seat && 'مقعد أطفال', o.pets && 'حيوان أليف'].filter(Boolean);
    const quotes = (r.quotes || []).map(q => `<div class="qrow"><span>${esc(q.provider)} <small>${esc(roleNames[q.role] || '')}</small></span><b>${money(q.price)}</b><small>${q.eta != null ? q.eta + ' د' : ''}</small><small>${q.state === 'accepted' ? '✓ مختار' : ''}</small></div>`).join('');
    return `<div class="acard"><div class="rr-top"><span class="pill ${stCls(r.status)}">${esc(stName(r.status, r.kind))}</span>${del ? `<span class="pill">${ic('box', 12)} توصيل</span>` : ''}<small>#${r.id} · ${fmtDate(r.created_at)} ${fmtTime(r.created_at)}</small></div>
      <div class="o-route">${del ? `<div class="item">${ic('box', 16)} <b>${esc(r.item || 'طلب')}</b>${o.size ? ` <small>(${sizeNames[o.size] || ''})</small>` : ''}</div>` : ''}<div>${ic('pin', 16)} <small>من</small> <b>${esc(r.pickup)}</b></div><div>${ic('flag', 16)} <small>إلى</small> <b>${esc(r.dropoff)}</b></div></div>
      <div class="kv"><div><small>خط مباشر</small><b>${fmtKm(r.direct_m)}</b></div><div><small>المسافة الفعلية</small><b>${r.distance_m ? fmtKm(r.distance_m) : '—'}</b></div><div><small>السعر</small><b>${r.price ? money(r.price) : '—'}</b></div></div>
      <div class="who"><div><small>${del ? 'صاحب الطلب' : 'الزبون'}</small><b>${esc(r.customer_name || '—')}</b>${tel(r.customer_phone)}</div>
      <div><small>${r.provider_name ? esc(roleNames[r.provider_role] || 'المنفّذ') : 'المنفّذ'}</small><b>${esc(r.provider_name || 'لم يُختر بعد')}</b>${r.vehicle ? `<small>${esc(r.vehicle)}</small>` : ''}${tel(r.provider_phone)}</div></div>
      <div class="chips"><span class="chip">${r.offers} وصلهم الطلب</span><span class="chip">${(r.quotes || []).length} عرض</span>${wait ? `<span class="chip">قُبل بعد ${wait} د</span>` : ''}${dur ? `<span class="chip">مدة ${dur} د</span>` : ''}${!del && r.passengers > 1 ? `<span class="chip">${r.passengers} ركاب</span>` : ''}${!del && r.vehicle_type ? `<span class="chip">${r.vehicle_type === 'comfort' ? 'مريح' : 'اقتصادي'}</span>` : ''}${del ? `<span class="chip">${r.vehicle_type === 'car' ? 'بسيارة' : 'بمتور'}</span>` : ''}${optTxt.map(t => `<span class="chip">${t}</span>`).join('')}${r.cancelled_by ? `<span class="chip bad">ألغاه ${r.cancelled_by === 'customer' ? 'الزبون' : 'المنفّذ'}</span>` : ''}${r.rating ? `<span class="chip stars">${ic('star', 14)} ${r.rating}</span>` : ''}</div>
      ${r.notes ? `<p class="note">${ic('chat', 14)} ${esc(r.notes)}</p>` : ''}${r.rating_comment ? `<p class="note">«${esc(r.rating_comment)}»</p>` : ''}
      ${quotes ? `<details class="qs"><summary>العروض المقدّمة (${r.quotes.length})</summary>${quotes}</details>` : ''}
      <div class="row2"><button class="btn light" data-act="amap" data-id="${r.id}">${ic('route', 18)} المسار</button>${r.accepted_at ? `<button class="btn light" data-act="achat" data-id="${r.id}">${ic('chat', 18)} المحادثة</button>` : ''}</div></div>`;
  }
  async function rideMap(r) {
    const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
    ov.innerHTML = `<header class="top"><button class="icon-btn" data-x>${ic('back', 22)}</button><div class="ttl">طلب #${r.id}</div><span style="width:40px"></span></header><div class="route-map" id="rmap"></div>
      <div class="route-info"><div class="kv"><div><small>خط مباشر</small><b>${fmtKm(r.direct_m)}</b></div><div><small>الفعلية</small><b>${r.distance_m ? fmtKm(r.distance_m) : '—'}</b></div><div><small>السعر</small><b>${r.price ? money(r.price) : '—'}</b></div></div>
      <p class="small center"><b>من:</b> ${esc(r.pickup)}<br><b>إلى:</b> ${esc(r.dropoff)}</p></div>`;
    let m; ov.querySelector('[data-x]').onclick = () => { m?.destroy(); ov.remove(); };
    try {
      await ensureLeaflet(); m = createMap(ov.querySelector('#rmap'), {});
      const a = [r.pickup_lat, r.pickup_lng], b = [r.dropoff_lat, r.dropoff_lng];
      m.put('a', a, 'pin', '#1a7f37'); m.put('b', b, 'pin', '#c0392b'); let pts = [a, b], trip = null;
      try { const d = await rpc('get_ride_track', { p_ride_id: r.id }); if (d?.trip?.length > 1) { trip = d.trip; pts = [...pts, ...trip]; if (d.approach?.length > 1) m.line('ap', d.approach, { color: '#888', weight: 4, dashArray: '2 9' }); } } catch { }
      m.line('trip', trip || [a, b], trip ? {} : { dashArray: '6 8', color: '#555' }); m.fit(pts); m.fix();
    } catch (e) { ov.querySelector('.route-info').insertAdjacentHTML('afterbegin', `<p class="center">${esc(errMsg(e))}</p>`); }
  }

  function exportCsv() {
    const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const rows = [['رقم', 'النوع', 'الحالة', 'التاريخ', 'الزبون', 'هاتف الزبون', 'المنفّذ', 'هاتف المنفّذ', 'من', 'إلى', 'مسافة مباشرة (م)', 'مسافة فعلية (م)', 'السعر', 'التقييم']];
    A.rides.forEach(r => rows.push([r.id, r.kind === 'delivery' ? 'توصيل' : 'تكسي', stName(r.status, r.kind), r.created_at, r.customer_name, r.customer_phone, r.provider_name, r.provider_phone, r.pickup, r.dropoff, r.direct_m, r.distance_m, r.price, r.rating]));
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wein-rides-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); toast('تم تنزيل الملف', 'ok');
  }

  /* ---------- الخريطة الحية ---------- */
  function showLive(pane, first) {
    if (first) {
      pane.innerHTML = `<div class="page"><h2 class="ph">المتواجدون الآن</h2><div class="admin-map" id="amap"></div><div class="filt" id="lsum"></div><div id="llist"></div></div>`;
      ensureLeaflet().then(() => { if (!alive) return; map = createMap(pane.querySelector('#amap'), { center: YABROUD, zoom: 13 }); drawLive(); }).catch(e => { pane.querySelector('#amap').innerHTML = `<p class="center pad">${esc(errMsg(e))}</p>`; });
    } else map?.fix();
    loadLive();
  }
  async function loadLive() { try { A.live = await rpc('admin_live') || []; drawLive(); } catch (e) { const l = $('live').querySelector('#llist'); if (l) l.innerHTML = `<p class="center">${esc(errMsg(e))}</p>`; } }
  const STL = { live: ['متاح', 'ok'], busy: ['في طلب', 'live'], offline: ['غير متصل', ''], never: ['لم يظهر قط', ''] };
  function drawLive() {
    const p = $('live'); if (!p?.querySelector('#llist')) return;
    const on = A.live.filter(t => (t.state === 'live' || t.state === 'busy') && t.lat != null);
    map?.syncCars(on.map(t => ({ ...t, k: t.id })), t => { p.querySelector('#llist').scrollIntoView({ behavior: 'smooth' }); toast(`${t.name} · ${roleNames[t.role] || ''}`); });
    const cnt = r => A.live.filter(t => t.role === r && (t.state === 'live' || t.state === 'busy')).length;
    p.querySelector('#lsum').innerHTML = `<span class="fchip on">سيارات ${cnt('driver')}</span><span class="fchip on">متورات ${cnt('motor')}</span><span class="fchip on">مكاتب ${cnt('office')}</span>`;
    p.querySelector('#llist').innerHTML = A.live.map(t => { const [l, c] = STL[t.state] || STL.offline; return `<div class="acard slim"><div class="rr-top"><b>${ic(t.role === 'office' ? 'bag' : t.role === 'motor' ? 'motor' : 'car', 16)} ${esc(t.name)}</b><span class="pill ${c}">${l}</span></div>
      <small>${esc(roleNames[t.role] || '')}${t.area ? ' · ' + esc(t.area) : ''}${t.vehicle ? ' · ' + esc(t.vehicle) : ''}</small>
      <small>${t.updated_at ? 'آخر موقع ' + ago(t.updated_at) : 'لم يشارك موقعه بعد'}${t.state === 'busy' && t.ride_id ? ' · طلب #' + t.ride_id : ''}${t.status !== 'active' ? ' · الحساب ' + esc(t.status) : ''}</small>${tel(t.phone)}${t.lat != null && (t.state === 'live' || t.state === 'busy') ? `<button class="btn light sm" data-act="lfly" data-id="${t.id}">${ic('target', 16)} على الخريطة</button>` : ''}</div>`; }).join('') || '<p class="center muted">لا يوجد مكاتب أو سائقون مسجّلون.</p>';
  }

  /* ---------- الحسابات ---------- */
  function showPeople(pane, first) {
    if (first) pane.innerHTML = `<div class="page"><h2 class="ph">الحسابات</h2><input class="notes" id="pq" placeholder="ابحث بالاسم أو الرقم"><div class="filt" id="pf"></div><div id="plist"><div class="spin mid"></div></div></div>`;
    loadPeople();
  }
  async function loadPeople() {
    const { data, error } = await db.from('profiles').select('id,full_name,phone,role,status,available,vehicle_kind,area,created_at').order('created_at', { ascending: false }).limit(600);
    if (error) { $('people').querySelector('#plist').innerHTML = `<p class="center">${esc(errMsg(error))}</p>`; return; }
    A.people = data; try { A.custs = Object.fromEntries((await rpc('admin_customers') || []).map(c => [c.id, c])); } catch { } drawPeople();
  }
  function drawPeople() {
    const p = $('people'), f = A.pf, q = f.q.toLowerCase();
    const R = [['all', 'الكل'], ['customer', 'زبائن'], ['office', 'مكاتب'], ['driver', 'سائقون'], ['motor', 'متورات']];
    p.querySelector('#pf').innerHTML = R.map(([k, l]) => `<button class="fchip ${f.role === k ? 'on' : ''}" data-act="pr" data-v="${k}">${l} <em>${k === 'all' ? A.people.length : A.people.filter(x => roleOf(x) === k).length}</em></button>`).join('');
    const rows = A.people.filter(x => (f.role === 'all' || roleOf(x) === f.role) && (!q || (x.full_name + ' ' + x.phone).toLowerCase().includes(q)));
    p.querySelector('#plist').innerHTML = rows.map(x => `<div class="acard slim"><div class="rr-top"><b>${esc(x.full_name)}</b><span class="pill ${x.status === 'active' ? 'ok' : 'bad'}">${x.status === 'active' ? 'فعّال' : x.status === 'disabled' ? 'معطّل' : 'معلّق'}</span></div>
      <small>${esc(roleNames[roleOf(x)] || '')}${x.area ? ' · ' + esc(x.area) : ''} · منذ ${fmtDate(x.created_at)}</small>${A.custs[x.id] ? `<div class="chips"><span class="chip">${A.custs[x.id].rides} طلب</span><span class="chip">${A.custs[x.id].completed} مكتمل</span>${A.custs[x.id].cancels ? `<span class="chip bad">ألغى ${A.custs[x.id].cancels}</span>` : ''}<span class="chip">${money(A.custs[x.id].spent)}</span><span class="chip ${A.custs[x.id].verified ? '' : 'bad'}">${A.custs[x.id].verified ? 'هوية موثّقة' : 'غير موثّق'}</span></div>` : ''}${tel(x.phone)}
      ${x.role !== 'admin' ? `<button class="btn light sm ${x.status === 'active' ? 'danger' : ''}" data-act="pstatus" data-id="${x.id}" data-s="${x.status === 'active' ? 'disabled' : 'active'}">${x.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}</button>` : ''}</div>`).join('') || '<p class="center muted">لا توجد نتائج.</p>';
  }

  /* ---------- التفعيل ---------- */
  function showCodes(pane, first) {
    if (first) pane.innerHTML = `<div class="page"><h2 class="ph">طلبات التفعيل والرموز</h2><div id="reqs"><div class="spin mid"></div></div>
      <h3 class="sec">إنشاء رمز لحساب جديد</h3>
      <form class="card" id="invf" novalidate onsubmit="return false">
        <label class="fld"><span>الاسم</span><input name="name" maxlength="100" required></label>
        <label class="fld"><span>رقم الهاتف</span><input name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="09xxxxxxxx" required></label>
        <div class="fld"><span>النوع</span><div class="kinds"><label><input type="radio" name="role" value="driver" checked><b>سائق سيارة</b></label><label><input type="radio" name="role" value="motor"><b>متور توصيل</b></label><label><input type="radio" name="role" value="office"><b>مكتب تكسي</b></label></div></div>
        <label class="fld"><span>المنطقة (اختياري)</span><input name="area" maxlength="60"></label>
        <label class="fld"><span>المركبة: النوع والموديل (اختياري)</span><input name="make" maxlength="40" placeholder="مثال: كيا ريو"></label>
        <div class="row2"><label class="fld"><span>السنة</span><input name="year" inputmode="numeric" dir="ltr" maxlength="4"></label><label class="fld"><span>اللون</span><input name="color" maxlength="20"></label></div>
        <button type="button" class="btn full big" data-act="mkcode">إنشاء الرمز</button></form>
      <h3 class="sec">الرموز الصادرة</h3><div id="invs"></div></div>`;
    loadCodes();
  }
  async function loadCodes() {
    try { [A.reqs, A.invites] = await Promise.all([rpc('admin_requests'), rpc('admin_invites')]); } catch (e) { $('codes').querySelector('#reqs').innerHTML = `<p class="center">${esc(errMsg(e))}</p>`; return; }
    const p = $('codes'), nw = (A.reqs || []).filter(r => r.state === 'new'), old = (A.reqs || []).filter(r => r.state !== 'new').slice(0, 8);
    p.querySelector('#reqs').innerHTML = nw.length ? nw.map(r => `<div class="acard req"><div class="rr-top"><b>${esc(r.full_name)}</b><span class="pill live">${WANT[r.wanted] || ''}</span></div>${tel(r.phone)}<small>${ago(r.created_at)}${r.note ? ' · ' + esc(r.note) : ''}</small>
      <div class="row2"><button class="btn" data-act="reqcode" data-id="${r.id}">إنشاء رمز له</button><button class="btn light" data-act="reqno" data-id="${r.id}">رفض</button></div></div>`).join('') : `<div class="empty-st">${ic('check', 36)}<h3>لا توجد طلبات جديدة</h3><p class="muted small">عندما يكتب أحدهم رقمه في «اطلب رمز التفعيل» يظهر هنا.</p></div>`;
    if (old.length) p.querySelector('#reqs').insertAdjacentHTML('beforeend', `<details class="qs"><summary>طلبات سابقة (${old.length})</summary>${old.map(r => `<div class="qrow"><span>${esc(r.full_name)} <small>${WANT[r.wanted] || ''}</small></span><small>${r.state === 'done' ? (r.registered ? 'سُجّل' : 'أُصدر رمز') : 'مرفوض'}</small></div>`).join('')}</details>`);
    p.querySelector('#invs').innerHTML = (A.invites || []).map(i => { const exp = !i.used && new Date(i.expires_at) < new Date(); return `<div class="acard slim"><div class="rr-top"><b>${esc(i.full_name)}</b><span class="pill ${i.used ? 'ok' : exp ? 'bad' : 'live'}">${i.used ? 'استُخدم' : exp ? 'منتهي' : 'بانتظار التفعيل'}</span></div><small>${esc(roleNames[i.role] || '')}${i.area ? ' · ' + esc(i.area) : ''}</small>${tel(i.phone)}</div>`; }).join('') || '<p class="center muted">لم تُصدر رموز بعد.</p>';
  }
  function codeModal(name, phone, code, role) {
    const msg = `مرحباً ${name}\nرمز تفعيل حسابك في تطبيق «وين؟» (${WANT[role] || ''}):\n${code}\n\nافتح ${APP_URL} ثم اختر «مكتب / سائق / متور»، وأدخل رقمك والرمز وكلمة مرور جديدة.`;
    const wa = 'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
    const ov = document.createElement('div'); ov.className = 'modal'; document.body.appendChild(ov);
    ov.innerHTML = `<div class="modal-card"><div class="done-ic">${ic('check', 34)}</div><h3>رمز التفعيل لـ ${esc(name)}</h3><div class="bigcode" dir="ltr">${esc(code)}</div><p class="small">يظهر هذا الرمز مرة واحدة فقط. أرسله للشخص الآن (صالح 30 يوماً).</p>
      <a class="btn full big" target="_blank" rel="noopener" href="${wa}">إرسال عبر واتساب</a><a class="btn light full" href="sms:${esc(phone)}?body=${encodeURIComponent(msg)}">إرسال برسالة نصية</a>
      <button class="btn light full" id="cp">نسخ الرمز</button><button class="link" id="cl">إغلاق</button></div>`;
    ov.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(code); toast('تم النسخ', 'ok'); } catch { toast(code); } };
    ov.querySelector('#cl').onclick = () => ov.remove();
  }

  /* ---------- الأحداث ---------- */
  function onInput(e) {
    const t = e.target;
    if (t.id === 'rq') { A.rf.q = t.value.trim(); drawRides(); const n = $('rides').querySelector('#rq'); } else if (t.id === 'pq') { A.pf.q = t.value.trim(); drawPeople(); }
  }
  async function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    try {
      if (a === 'rk') { A.rf.kind = b.dataset.v; drawRides(); } else if (a === 'rs') { A.rf.st = b.dataset.v; drawRides(); } else if (a === 'pr') { A.pf.role = b.dataset.v; drawPeople(); }
      else if (a === 'goto') shell.show(b.dataset.t); else if (a === 'goto-rides') { A.rf = { kind: 'all', st: 'act', q: '' }; shell.show('rides'); drawRides(); } else if (a === 'goto-live') shell.show('live');
      else if (a === 'allrev') { A.allRev = !A.allRev; loadOver(); }
      else if (a === 'csv') exportCsv();
      else if (a === 'achat') { const r = A.rides.find(x => x.id === +b.dataset.id); await openChat({ db, user, rideId: r.id, name: `طلب #${r.id}: ${r.customer_name || ''} ↔ ${r.provider_name || ''}`, canSend: false, role: 'customer' }); }
      else if (a === 'amap') rideMap(A.rides.find(r => r.id === +b.dataset.id));
      else if (a === 'lfly') { const t = A.live.find(x => x.id === b.dataset.id); if (t) { $('live').querySelector('#amap').scrollIntoView({ behavior: 'smooth' }); map?.flyTo([t.lat, t.lng], 16); } }
      else if (a === 'pstatus') {
        const x = A.people.find(p => p.id === b.dataset.id), on = b.dataset.s === 'active';
        if (!await confirmBox(`${on ? 'تفعيل' : 'تعطيل'} حساب ${x.full_name}؟`, 'نعم', 'رجوع')) return;
        const { error } = await db.from('profiles').update({ status: b.dataset.s }).eq('id', x.id); if (error) throw error; x.status = b.dataset.s; drawPeople(); toast('تم', 'ok');
      }
      else if (a === 'reqcode') {
        const r = A.reqs.find(x => x.id === +b.dataset.id), f = $('codes').querySelector('#invf');
        f.elements.name.value = r.full_name; f.elements.phone.value = r.phone; f.querySelector(`[name=role][value=${r.wanted}]`).checked = true; f.scrollIntoView({ behavior: 'smooth' }); toast('راجع البيانات ثم اضغط «إنشاء الرمز»');
      }
      else if (a === 'reqno') { if (!await confirmBox('رفض هذا الطلب؟', 'رفض', 'رجوع')) return; await rpc('admin_resolve_request', { p_id: +b.dataset.id, p_state: 'rejected' }); loadCodes(); }
      else if (a === 'mkcode') {
        const f = $('codes').querySelector('#invf'), v = n => f.elements[n].value.trim(), phone = normalizePhone(v('phone'));
        if (!v('name') || !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('اكتب الاسم ورقماً صحيحاً (09xxxxxxxx).');
        const role = f.querySelector('[name=role]:checked').value; b.disabled = true;
        try {
          const code = await rpc('admin_create_invite', { p_phone: phone, p_name: v('name'), p_role: role, p_make: v('make') || null, p_model: null, p_year: parseInt(v('year'), 10) || null, p_color: v('color') || null, p_area: v('area') || null });
          codeModal(v('name'), phone, code, role); f.reset(); loadCodes();
        } finally { b.disabled = false; }
      }
    } catch (x) { toast(errMsg(x), 'err'); }
  }

  return () => { alive = false; timers.forEach(clearInterval); map?.destroy(); };
}
