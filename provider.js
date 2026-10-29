import { esc, toast, money, fmtKm, fmtTime, fmtDate, ago, errMsg, hav, roleNames, toggleTheme, latin, beep, notify } from './utils.js';
import { ic } from './icons.js';
import { buildShell } from './shell.js';
import { stepper, optChips, stars, rideRow, openRoute, confirmBox } from './rides.js';
import { openChat, watchMessages, chatOpen, renderInbox, watchInbox } from './chat.js';
import { starRow } from './directory.js';
import { extrasHtml, handleExtra } from './help.js';
import { startSharing, stopSharing, isSharing, onState, lastPoint, lastSent, lastReason } from './live.js';

const TRACK = ['accepted', 'on_the_way', 'arrived', 'started'];
const NEXT = { accepted: ['on_the_way', 'ابدأ التحرك نحو الزبون', 'nav'], on_the_way: ['arrived', 'وصلت إلى الزبون', 'pin'], arrived: ['started', 'بدء الرحلة', 'car'], started: ['completed', 'إنهاء الرحلة', 'check'] };
const NEXT_D = { accepted: ['on_the_way', 'ابدأ التحرك نحو مكان الاستلام', 'nav'], on_the_way: ['arrived', 'وصلت إلى مكان الاستلام', 'pin'], arrived: ['started', 'استلمت الطلب، انطلق للتسليم', 'box'], started: ['completed', 'تم تسليم الطلب', 'check'] };
const SUPPORT = '0933712979';

export function mountProvider({ app, db, user, profile, logout }) {
  const P = { ...profile }; const timers = []; const chans = []; const unsubs = [];
  const S = { ride: null, contact: null, offers: [], mine: {}, unread: 0, pt: null, sig: '', locErr: '', today: null, seen: -1, of: 'all', rate: null }; let unwatch = null, home = null, busy = false, lastOfferIds = '';
  const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if (error) throw error; return data; };
  const myRole = P.vehicle_kind === 'motor' ? 'motor' : P.role, motor = myRole === 'motor';
  const label = P.role === 'office' ? 'مكتب' : motor ? 'متور' : 'سائق';

  const shell = buildShell(app, {
    subtitle: `${roleNames[myRole] || label} · ${P.full_name || ''}`, start: 'requests',
    tabs: [['requests', 'الطلبات', 'list'], ['msgs', 'الرسائل', 'chat'], ['stats', 'الإحصائيات', 'chart'], ['account', 'حسابي', 'user']],
    onShow: (id, pane, first) => { if (id === 'requests') { if (first) initHome(pane); } else if (id === 'msgs') renderInbox(pane, { db, user, role: 'provider', onChange: n => shell?.dot('msgs', n > 0) }); else if (id === 'stats') renderStats(pane); else renderAccount(pane); },
  });

  /* ---------- الطلبات ---------- */
  function initHome(pane) {
    home = pane;
    pane.innerHTML = `<div class="page"><div id="pcard"></div><div id="pstats"></div><div id="pmain"></div></div>`;
    pane.addEventListener('click', onClick);
    let lastDraw = 0;
    onState(s => { if (s.pt) S.pt = s.pt; if (s.err) S.locErr = s.err; if (Date.now() - lastDraw > 3000 || s.err || s.reason) { lastDraw = Date.now(); drawCard(); } });
    drawCard(); loadToday();
    timers.push(setInterval(() => { drawCard(); }, 5000));
    // أول لمسة: نبدأ مشاركة الموقع تلقائياً إن كنت متاحاً (المتصفح يشترط لمسة لطلب الإذن)
    const first = () => { if (P.available && !isSharing()) startSharing(db).then(() => { S.locErr = ''; drawCard(); }).catch(e => { S.locErr = /رفض/.test(e.message) ? 'denied' : 'needs'; drawCard(); }); };
    pane.addEventListener('pointerdown', first, { once: true });
    chans.push(db.channel('p-offers-' + user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_offers', filter: 'recipient_id=eq.' + user.id }, () => { beep(); notify('وين؟', 'وصلك طلب جديد', 'offer'); toast('وصلك طلب جديد', 'ok'); refresh(); }).subscribe());
    chans.push(db.channel('p-rides-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => refresh()).subscribe());
    timers.push(setInterval(() => { if (!document.hidden) refresh(); }, 6000));
    if (P.available && !isSharing()) startSharing(db).catch(() => { S.locErr = 'needs'; drawCard(); });
    unsubs.push(watchInbox(db, user.id, m => { if (!chatOpen) { beep(); notify('رسالة جديدة', (m?.body || '').startsWith('📍') ? '📍 موقع' : (m?.body || ''), 'msg'); shell?.dot('msgs', true); } }));
    db.rpc('chat_inbox').then(({ data }) => shell?.dot('msgs', (data || []).some(x => x.unread > 0)));
    refresh();
  }

  const REASON = { low_accuracy: 'دقة GPS ضعيفة. اخرج لمكان مفتوح أو شغّل «دقة عالية» في الهاتف.', rpc: 'تعذر إرسال الموقع للخادم.', net: 'لا يوجد اتصال بالإنترنت.', rejected: 'رفض الخادم الموقع.' };
  function drawCard() {
    const el = home?.querySelector('#pcard'); if (!el) return;
    const sh = isSharing(), inRide = !!S.ride, denied = S.locErr === 'denied', ls = lastSent(), reason = lastReason();
    const ago = ls ? Math.round((Date.now() - ls) / 1000) : null;
    let v;
    if (!P.available) v = ['off', 'غير ظاهر للزبائن', 'فعّل التوفر لتصلك الطلبات وتظهر على الخريطة'];
    else if (!sh) v = ['bad', 'غير ظاهر: مشاركة الموقع متوقفة', 'الزبائن لا يرونك على الخريطة قبل تشغيل الموقع'];
    else if (reason) v = ['warn', 'موقعك لا يصل', REASON[reason] || ''];
    else if (ago == null) v = ['warn', 'جارٍ تحديد موقعك…', 'قد يستغرق ثوانٍ في أول مرة'];
    else if (ago > 90) v = ['warn', 'موقعك متأخر', 'أبقِ التطبيق مفتوحاً والشاشة مضاءة'];
    else v = ['ok', 'ظاهر للزبائن على الخريطة', `آخر تحديث منذ ${ago} ث`];
    el.innerHTML = `<div class="pcard v-${v[0]}"><div class="vis v-${v[0]}"><i></i><div><b>${v[1]}</b><small>${esc(v[2])}</small></div></div>
      <div class="row"><div><b>التوفر لاستقبال الطلبات</b></div><button class="switch ${P.available ? 'on' : ''}" data-act="avail" aria-label="التوفر" ${inRide ? 'disabled' : ''}><i></i></button></div>
      <div class="row loc"><div>${ic('target', 18)} <span>مشاركة الموقع</span> <small class="${sh ? 'g' : 'r'}">${sh ? 'تعمل' : 'متوقفة'}</small></div>
      <button class="switch ${sh ? 'on' : ''}" data-act="loc" aria-label="الموقع"><i></i></button></div>
      ${(P.available && !sh) || (inRide && !sh) ? `<button class="btn full big" data-act="locstart">${ic('target', 20)} تشغيل الموقع الآن</button>` : ''}
      ${inRide && !sh ? `<div class="warn">${ic('warn', 16)} الموقع إجباري أثناء الرحلة.</div>` : ''}
      ${denied ? `<div class="warn">${ic('warn', 16)} إذن الموقع مرفوض. من إعدادات المتصفح للموقع (أيقونة القفل بجانب العنوان) اسمح بالموقع ثم اضغط «تشغيل الموقع الآن».</div>` : ''}</div>`;
  }
  async function loadToday() { try {
    const sod = new Date(); sod.setHours(0, 0, 0, 0);
    const { data: all } = await db.from('rides').select('price,rating,completed_at').eq('accepted_by', user.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(500);
    const data = (all || []).filter(r => r.completed_at && new Date(r.completed_at) >= sod), rs = (all || []).filter(r => r.rating);
    S.rate = { v: (4 * 3 + rs.reduce((s, r) => s + r.rating, 0)) / (3 + rs.length), n: rs.length };
    S.today = { n: data.length, sum: data.reduce((s, r) => s + (r.price || 0), 0) };
    const el = home?.querySelector('#pstats'); if (el) el.innerHTML = `<div class="stats today"><div><b>${S.today.n}</b><small>رحلات اليوم</small></div><div><b>${S.today.sum.toLocaleString('en-US')}</b><small>ل.س اليوم</small></div><div><b>${S.rate.v.toFixed(1)}</b>${starRow(S.rate.v)}<small>${S.rate.n ? S.rate.n + ' تقييم' : 'تقييم جديد'}</small></div></div>`;
  } catch { } }

  async function refresh() {
    if (busy) return; busy = true;
    try {
      // رحلة جارية؟
      const { data: act } = await db.from('rides').select('*').eq('accepted_by', user.id).in('status', TRACK).order('updated_at', { ascending: false }).limit(1);
      const prev = S.ride, r = act?.[0] || null; S.ride = r;
      if (r && (!prev || prev.id !== r.id)) { S.contact = null; S.unread = 0; unwatch?.(); unwatch = watchMessages(db, r.id, user.id, () => { if (!chatOpen) { S.unread++; draw(true); } }); try { S.contact = (await rpc('ride_contact', { p_ride_id: r.id }))?.[0]; } catch { } if (!isSharing()) startSharing(db).catch(e => { S.locErr = 'denied'; drawCard(); }); drawCard(); }
      if (!r && prev) { unwatch?.(); unwatch = null; S.contact = null; drawCard(); const { data: fin } = await db.from('rides').select('status,price').eq('id', prev.id).maybeSingle(); if (fin?.status === 'completed') toast('اكتملت الرحلة. ' + money(fin.price), 'ok'); else if (fin?.status === 'cancelled') toast('أُلغيت الرحلة من الزبون.', 'err'); }
      if (!r) await loadOffers();
      if (!r && S.offers.length > S.seen && S.seen >= 0) beep(); S.seen = r ? S.seen : S.offers.length;
      if (prev && !r) loadToday();
      draw();
    } catch (e) { console.error(e); } finally { busy = false; }
  }
  async function loadOffers() {
    if (!P.available) { S.offers = []; return; }
    const { data: of } = await db.from('ride_offers').select('ride_id').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(40);
    const ids = (of || []).map(o => o.ride_id); if (!ids.length) { S.offers = []; S.mine = {}; return; }
    const [{ data: rs }, { data: qs }] = await Promise.all([
      db.from('rides').select('*').in('id', ids).eq('status', 'searching').order('created_at', { ascending: false }),
      db.from('ride_quotes').select('ride_id,price,eta_minutes,state').eq('provider_id', user.id).in('ride_id', ids)]);
    S.offers = rs || []; S.mine = Object.fromEntries((qs || []).filter(q => q.state !== 'withdrawn').map(q => [q.ride_id, q]));
  }

  function draw(force) {
    const el = home?.querySelector('#pmain'); if (!el) return;
    const r = S.ride; let html;
    if (r) html = activeHtml(r);
    else if (!P.available) html = `<div class="empty-st">${ic(motor ? 'motor' : 'car', 44)}<h3>أنت غير متاح</h3><p class="muted">شغّل التوفر في الأعلى لتستقبل طلبات الزبائن القريبة.</p></div>`;
    else if (!S.offers.length) html = `<div class="empty-st"><div class="pulse"><i></i><i></i>${ic(motor ? 'motor' : 'car', 26)}</div><h3>بانتظار الطلبات</h3><p class="muted">سيصلك إشعار فور وصول طلب جديد. أبقِ الشاشة مفتوحة.</p></div>`;
    else {
      const me = S.pt || lastPoint(), list = S.offers.filter(o => S.of === 'all' || (o.kind || 'taxi') === S.of).sort((a, b) => me ? hav(me[0], me[1], a.pickup_lat, a.pickup_lng) - hav(me[0], me[1], b.pickup_lat, b.pickup_lng) : 0);
      const n = k => S.offers.filter(o => k === 'all' || (o.kind || 'taxi') === k).length;
      html = `<div class="row"><h3 class="sec">طلبات الزبائن (${S.offers.length})</h3></div><div class="filt">${[['all', 'الكل'], ['taxi', 'تكسي'], ['delivery', 'توصيل']].map(([k, l]) => `<button class="fchip ${S.of === k ? 'on' : ''}" data-act="of" data-v="${k}">${l} <em>${n(k)}</em></button>`).join('')}</div><p class="small muted">الأقرب إليك أولاً</p>` + (list.map(offerHtml).join('') || '<p class="center muted">لا توجد طلبات من هذا النوع.</p>');
    }
    // لا نُعيد الرسم إذا لم يتغير شيء حتى لا تضيع كتابة السعر
    const sig = S.of + html.replace(/\d+ ?د(?=<)/g, '') + (r ? S.unread : '');
    if (!force && sig === S.sig && !r) return;
    if (!force && !r && el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && S.sig.length && offerIds() === lastOfferIds) return;
    S.sig = sig; lastOfferIds = offerIds(); el.innerHTML = html;
  }
  const offerIds = () => S.offers.map(o => o.id + ':' + (S.mine[o.id]?.price || '')).join(',');

  function offerHtml(r) {
    const mine = S.mine[r.id], d = hav(r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng), me = S.pt || lastPoint();
    const near = me ? hav(me[0], me[1], r.pickup_lat, r.pickup_lng) : null;
    return `<div class="offer" data-r="${r.id}"><div class="o-top"><span class="pill ${mine ? 'ok' : 'live'}">${mine ? 'أرسلت عرضاً' : r.kind === 'delivery' ? 'طلب توصيل جديد' : 'طلب جديد'}</span><small>${ago(r.created_at)}</small></div>
      <div class="o-route">${r.kind === 'delivery' ? `<div class="item">${ic('box', 16)} <b>${esc(r.item || 'طلب')}</b></div>` : ''}<div>${ic('pin', 16)} <small>${r.kind === 'delivery' ? 'استلام: ' : ''}</small><b>${esc(r.pickup)}</b></div><div>${ic('flag', 16)} <small>${r.kind === 'delivery' ? 'تسليم: ' : ''}</small><b>${esc(r.dropoff)}</b></div></div>
      <div class="chips"><span class="chip">${ic('route', 14)} ${fmtKm(d)}</span>${near != null ? `<span class="chip">${ic('target', 14)} يبعد عنك ${fmtKm(near)}</span>` : ''}${optChips(r)}${r.vehicle_type === 'comfort' ? '<span class="chip">مريحة</span>' : ''}${r.notes ? `<span class="chip">${ic('chat', 14)} ${esc(r.notes)}</span>` : ''}</div>
      <div class="o-form"><label>سعرك (ل.س)<input type="text" inputmode="numeric" data-price value="${mine?.price || P.base_fare || ''}" placeholder="مثال: 5000" dir="ltr"></label>
      <label>الوصول (دقيقة)<select data-eta>${[2, 3, 5, 8, 10, 15, 20].map(m => `<option ${((mine?.eta_minutes) || 5) === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <div class="qp">${[-1000, -500, 500, 1000].map(d => `<button type="button" data-act="pp" data-d="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`).join('')}</div>
      <div class="row2"><button class="btn" data-act="quote" data-id="${r.id}">${mine ? 'تعديل العرض' : 'إرسال العرض'}</button>${mine ? `<button class="btn light" data-act="unquote" data-id="${r.id}">سحب</button>` : ''}</div></div>`;
  }
  function activeHtml(r) {
    const del = r.kind === 'delivery', c = S.contact || { full_name: 'الزبون', phone: '' }, nx = (del ? NEXT_D : NEXT)[r.status];
    const dest = r.status === 'started' ? [r.dropoff_lat, r.dropoff_lng] : [r.pickup_lat, r.pickup_lng];
    const canCancel = r.status !== 'started';
    return `<div class="active"><div class="row"><h3>${del ? 'توصيل جارٍ' : 'رحلة جارية'}</h3><b class="price">${money(r.price)}</b></div>${stepper(r.status, r.kind)}
      <div class="driver"><div class="avatar-s">${esc((c.full_name || '؟').trim()[0])}</div><div class="grow"><b>${esc(c.full_name)}</b><small>${del ? 'صاحب الطلب' : r.passengers + ' ' + (r.passengers > 1 ? 'ركاب' : 'راكب')}</small></div></div>
      <div class="o-route">${del ? `<div class="item">${ic('box', 16)} <b>${esc(r.item || 'طلب')}</b></div>` : ''}<div>${ic('pin', 16)} <small>${del ? 'استلام: ' : ''}</small><b>${esc(r.pickup)}</b></div><div>${ic('flag', 16)} <small>${del ? 'تسليم: ' : ''}</small><b>${esc(r.dropoff)}</b></div></div>
      <div class="chips">${optChips(r)}${r.notes ? `<span class="chip">${ic('chat', 14)} ${esc(r.notes)}</span>` : ''}</div>
      <button class="btn full big" data-act="next" data-s="${nx[0]}">${ic(nx[2], 20)} ${nx[1]}</button>
      <div class="actions3"><a class="btn light" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${dest[0]},${dest[1]}&travelmode=driving">${ic('nav', 20)} الملاحة</a>${c.phone ? `<a class="btn light" href="tel:${esc(c.phone)}">${ic('phone', 20)} اتصال</a>` : ''}<button class="btn light rel" data-act="chat">${ic('chat', 20)} رسالة${S.unread ? `<em class="badge">${S.unread}</em>` : ''}</button></div>
      ${canCancel ? '<button class="link danger" data-act="pcancel">إلغاء الرحلة</button>' : ''}</div>`;
  }

  async function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    try {
      if (a === 'avail') await toggleAvail(b);
      else if (a === 'loc') await toggleLoc(b);
      else if (a === 'locstart') { b.disabled = true; try { await startSharing(db); S.locErr = ''; toast('بدأت مشاركة الموقع', 'ok'); } catch (x) { S.locErr = /رفض/.test(x.message) ? 'denied' : 'needs'; throw x; } finally { drawCard(); } }
      else if (a === 'of') { S.of = b.dataset.v; draw(true); }
      else if (a === 'pp') { const i = b.closest('.offer').querySelector('[data-price]'), v = parseInt(latin(i.value).replace(/\D/g, ''), 10) || P.base_fare || 0; i.value = Math.max(500, v + +b.dataset.d); }
      else if (a === 'quote') await sendQuote(b);
      else if (a === 'unquote') { await rpc('withdraw_quote', { p_ride_id: +b.dataset.id }); toast('تم سحب العرض'); await refresh(); draw(true); }
      else if (a === 'next') await nextStatus(b);
      else if (a === 'pcancel') { if (await confirmBox('هل تريد إلغاء الرحلة؟ الإلغاء المتكرر يؤثر على حسابك.', 'نعم، ألغِ', 'رجوع')) { await rpc('provider_cancel_ride', { p_ride_id: S.ride.id }); S.ride = null; toast('تم إلغاء الرحلة'); await refresh(); draw(true); drawCard(); } }
      else if (a === 'chat') { S.unread = 0; draw(true); await openChat({ db, user, rideId: S.ride.id, name: S.contact?.full_name || 'الزبون', phone: S.contact?.phone || '', role: 'provider', ride: S.ride, canSend: true }); }
    } catch (x) { toast(errMsg(x), 'err'); }
  }
  async function toggleAvail(b) {
    b.disabled = true;
    try {
      if (!P.available) {
        if (!isSharing()) { if (!await confirmBox('لتظهر للزبائن وتستقبل الطلبات نحتاج إذن موقعك. يُستخدم موقعك أثناء توفرك فقط وأثناء الرحلة، ويمكنك إيقافه متى شئت خارج الرحلات.', 'السماح بالموقع', 'ليس الآن')) return; await startSharing(db); S.locErr = ''; }
        const { error } = await db.from('profiles').update({ available: true }).eq('id', user.id); if (error) throw error; P.available = true;
      } else {
        const { error } = await db.from('profiles').update({ available: false }).eq('id', user.id); if (error) throw error; P.available = false;
      }
      drawCard(); await refresh(); draw(true);
    } finally { b.disabled = false; }
  }
  async function toggleLoc(b) {
    b.disabled = true;
    try {
      if (isSharing()) {
        if (S.ride) throw new Error('الموقع إجباري أثناء الرحلة ولا يمكن إيقافه.');
        await stopSharing(db); toast('تم إيقاف مشاركة الموقع. لن تظهر للزبائن حتى تعيد التشغيل.');
      } else { await startSharing(db); S.locErr = ''; toast('بدأت مشاركة الموقع', 'ok'); }
    } catch (x) { if (/رفض|denied/.test(x.message)) S.locErr = 'denied'; throw x; } finally { b.disabled = false; drawCard(); }
  }
  async function sendQuote(b) {
    const card = b.closest('.offer'), price = parseInt(latin(card.querySelector('[data-price]').value).replace(/\D/g, ''), 10), eta = parseInt(card.querySelector('[data-eta]').value, 10);
    if (!price || price < 500) throw new Error('أدخل سعراً صحيحاً (500 ل.س على الأقل).');
    if (!isSharing()) { await startSharing(db).catch(() => { }); }
    await rpc('send_quote', { p_ride_id: +b.dataset.id, p_price: price, p_eta: eta });
    toast('تم إرسال عرضك. بانتظار اختيار الزبون.', 'ok'); S.sig = ''; await refresh(); draw(true);
  }
  async function nextStatus(b) {
    const s = b.dataset.s;
    if (s === 'completed' && !await confirmBox('هل وصلتَ إلى الوجهة وتريد إنهاء الرحلة؟', 'نعم، أنهِ', 'رجوع')) return;
    b.disabled = true;
    try {
      if (!isSharing()) await startSharing(db);
      await new Promise(r => setTimeout(r, 600)); // ننتظر أول إحداثية طازجة
      try { await rpc('update_ride_status', { p_ride_id: S.ride.id, p_status: s }); }
      catch (e) { if (e.message === 'location_required') { await new Promise(r => setTimeout(r, 3500)); await rpc('update_ride_status', { p_ride_id: S.ride.id, p_status: s }); } else throw e; }
      if (s === 'completed') toast('اكتملت الرحلة', 'ok');
      await refresh(); draw(true); drawCard();
    } finally { b.disabled = false; }
  }

  /* ---------- الإحصائيات ---------- */
  async function renderStats(pane) {
    pane.innerHTML = '<div class="page"><h2 class="ph">الإحصائيات</h2><div class="spin mid"></div></div>';
    const { data, error } = await db.from('rides').select('*').eq('accepted_by', user.id).order('created_at', { ascending: false }).limit(500);
    if (error) { pane.innerHTML = `<div class="page"><p class="center">${esc(errMsg(error))}</p></div>`; return; }
    const done = data.filter(r => r.status === 'completed'), sod = new Date(); sod.setHours(0, 0, 0, 0);
    const sum = a => a.reduce((s, r) => s + (r.price || 0), 0), at = r => new Date(r.completed_at || r.created_at);
    const today = done.filter(r => at(r) >= sod), week = done.filter(r => at(r) >= new Date(sod - 6 * 864e5));
    const rated = done.filter(r => r.rating), avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
    const days = [...Array(7)].map((_, i) => { const d0 = new Date(sod - (6 - i) * 864e5), d1 = new Date(+d0 + 864e5); return { l: d0.toLocaleDateString('ar', { weekday: 'short' }), v: sum(done.filter(r => at(r) >= d0 && at(r) < d1)) }; }).reverse();
    const mx = Math.max(1, ...days.map(d => d.v)), blend = (4 * 3 + rated.reduce((s, r) => s + r.rating, 0)) / (3 + rated.length);
    pane.innerHTML = `<div class="page"><h2 class="ph">الإحصائيات</h2>
      <div class="hero-card"><small>أرباح اليوم</small><b>${money(sum(today))}</b><span>${today.length} رحلة اليوم</span></div>
      <div class="stats"><div><b>${week.length}</b><small>رحلات الأسبوع</small></div><div><b>${done.length}</b><small>كل الرحلات</small></div><div><b>${avg ? avg.toFixed(1) : '—'}</b><small>${rated.length} تقييم</small></div></div>
      <div class="card"><div class="row"><b>تقييمك</b><span class="rate">${starRow(blend)}<b>${blend.toFixed(1)}</b><small>${rated.length ? '(' + rated.length + ')' : 'جديد'}</small></span></div>
        ${[5, 4, 3, 2, 1].map(k => { const c = rated.filter(r => r.rating === k).length; return `<div class="hist"><small>${k} ★</small><div><i style="width:${rated.length ? c / rated.length * 100 : 0}%"></i></div><small>${c}</small></div>`; }).join('')}
        ${rated.filter(r => r.rating_comment).slice(0, 3).map(r => `<p class="note">«${esc(r.rating_comment)}»</p>`).join('')}</div>
      <div class="stats"><div><b>${data.filter(r => r.status === 'cancelled' && r.cancelled_by === 'provider').length}</b><small>ألغيتها أنت</small></div><div><b>${data.filter(r => r.kind === 'delivery' && r.status === 'completed').length}</b><small>توصيلات مكتملة</small></div><div><b>${done.length ? Math.round(done.reduce((s, r) => s + (r.price || 0), 0) / done.length).toLocaleString('en-US') : '—'}</b><small>متوسط الطلب</small></div></div>
      <div class="card"><div class="row"><b>أرباح الأسبوع</b><b>${money(sum(week))}</b></div><div class="bars">${days.map(d => `<div><i style="height:${Math.max(4, d.v / mx * 100)}%"></i><small>${d.l}</small></div>`).join('')}</div></div>
      <div class="card"><div class="row"><span>إجمالي الأرباح</span><b>${money(sum(done))}</b></div><div class="row"><span>المسافة الكلية</span><b>${fmtKm(done.reduce((s, r) => s + (r.distance_m || 0), 0))}</b></div></div>
      <h3 class="sec">آخر الرحلات</h3>${data.slice(0, 20).map(r => rideRow(r)).join('') || '<p class="muted center">لا توجد رحلات بعد.</p>'}</div>`;
    pane.onclick = async e => { const b = e.target.closest('[data-ride]'); if (b) { const r = data.find(x => x.id === +b.dataset.ride); if (r.status === 'completed') await openRoute({ db, ride: r }); } };
  }

  /* ---------- حسابي ---------- */
  function renderAccount(pane) {
    const car = [P.vehicle_make, P.vehicle_model, P.vehicle_year, P.vehicle_color].filter(Boolean).join(' ');
    pane.innerHTML = `<div class="page acc"><div class="avatar">${esc((P.full_name || '؟').trim()[0])}</div><h2 class="ctr">${esc(P.full_name)}</h2><p class="ph-no">${esc(P.phone || '')}</p>
      <div class="card"><div class="row"><span>الصفة</span><b>${esc(roleNames[myRole] || '')}</b></div>${car ? `<div class="row"><span>${motor ? 'الدراجة' : 'السيارة'}</span><b>${esc(car)}</b></div>` : ''}</div>
      <div class="card"><label class="fld"><span>السعر الافتراضي لعروضك (ل.س)</span><input id="bf" inputmode="numeric" dir="ltr" value="${P.base_fare || ''}" placeholder="مثال: 5000"></label><button class="btn full" data-a="bf">حفظ السعر الافتراضي</button><p class="small">يظهر تلقائياً في خانة السعر ويمكنك تغييره لكل طلب.</p></div>
      ${extrasHtml()}<div class="menu"><button class="menu-row" data-a="theme">${ic('moon', 22)}<span class="grow">الوضع الليلي</span>${ic('back', 18, 'chev')}</button><a class="menu-row" href="tel:${SUPPORT}">${ic('phone', 22)}<span class="grow">الدعم والمساعدة</span>${ic('back', 18, 'chev')}</a></div>
      <button class="btn-soft" data-a="logout">${ic('logout', 20)} تسجيل الخروج</button></div>`;
    pane.onclick = async e => {
      const x = e.target.closest('[data-x]'); if (x) return handleExtra(x.dataset.x, 'provider', () => renderAccount(pane));
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'logout') { if (S.ride) return toast('أنهِ رحلتك الجارية أولاً.', 'err'); logout(); }
      else if (a === 'theme') toggleTheme();
      else if (a === 'bf') {
        const v = parseInt(latin(pane.querySelector('#bf').value).replace(/\D/g, ''), 10); if (!v || v < 500) return toast('أدخل سعراً صحيحاً.', 'err');
        const { error } = await db.from('profiles').update({ base_fare: v }).eq('id', user.id); if (error) return toast(errMsg(error), 'err'); P.base_fare = v; toast('تم الحفظ', 'ok');
      }
    };
  }

  return () => { timers.forEach(clearInterval); unsubs.forEach(f => f()); chans.forEach(c => db.removeChannel(c)); unwatch?.(); onState(null); };
}
