import { esc, toast, money, fmtKm, fmtTime, errMsg, hav, roleNames, toggleTheme, statusNames, vehicleNames } from './utils.js';
import { ic, pinSvg } from './icons.js';
import { createMap, YABROUD } from './map.js';
import { buildShell } from './shell.js';
import { stepper, optChips, stars, rideRow, openRoute, rateSheet, confirmBox, OPT_LABELS } from './rides.js';
import { openChat, watchMessages, chatOpen } from './chat.js';
import { openKyc } from './kyc.js';
import { ensureLeaflet } from './loader.js';
import { taxiCard, openDirectory } from './directory.js';

const ACTIVE = ['searching', 'accepted', 'on_the_way', 'arrived', 'started', 'no_driver'];
const TRACK = ['accepted', 'on_the_way', 'arrived', 'started'];
const SUPPORT = '0933712979';
const etaMin = m => Math.max(1, Math.round(m / 420)); // ~25 كم/س داخل المدينة

export function mountCustomer({ app, db, user, profile, logout }) {
  const S = { ride: null, mode: 'idle', step: 'pickup', pickup: null, dropoff: null, ptxt: '', dtxt: '', veh: 'economy', pax: 1, opts: {}, notes: '',
    quotes: [], contact: null, live: null, verified: null, me: null, unread: 0, rating: false, taxis: [], dir: [], sel: null, lastHtml: '', gone: false };
  const dismissed = new Set(); const timers = []; const chans = []; let unwatch = null, map = null, home = null, sheet = null, shell, busyRide = false, taxiAt = 0;
  const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if (error) throw error; return data; };
  const $ = s => home?.querySelector(s);

  /* ---------- الهيكل ---------- */
  shell = buildShell(app, {
    subtitle: 'زبون · ' + (profile.full_name || ''), start: 'home',
    tabs: [['home', 'الرئيسية', 'home'], ['orders', 'رحلاتي', 'list'], ['account', 'حسابي', 'user']],
    onShow: (id, pane, first) => {
      if (id === 'home') { if (first) initHome(pane); else map?.fix(); }
      else if (id === 'orders') renderOrders(pane);
      else renderAccount(pane);
    },
  });

  /* ---------- الرئيسية ---------- */
  function initHome(pane) {
    home = pane;
    pane.innerHTML = `<div class="stage"><div class="map-full" id="map"></div><div class="center-pin hidden" id="cpin">${pinSvg('#000')}</div>
      <button class="fab" data-act="locate" aria-label="موقعي">${ic('target', 22)}</button><div class="sheet" id="sheet"></div></div>`;
    sheet = $('#sheet');
    ensureLeaflet().then(() => {
      if (!home) return; map = createMap($('#map'), { center: YABROUD, zoom: 14 });
      if (S.me) { map.put('me', S.me, 'me'); if (!S.ride) map.map.setView(S.me, 15); }
      syncMap(true); loadTaxis(true);
    }).catch(e => { const m = $('#map'); if (m) m.innerHTML = `<p class="center pad">${esc(errMsg(e))}</p>`; });
    pane.addEventListener('click', onClick); pane.addEventListener('input', onInput);
    locate(true);
    db.from('customer_identity').select('user_id').eq('user_id', user.id).maybeSingle().then(({ data }) => { S.verified = !!data; draw(true); });
    chans.push(db.channel('c-rides-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: 'customer_id=eq.' + user.id }, () => tick()).subscribe());
    timers.push(setInterval(() => { if (!document.hidden) tick(); }, 4000));
    refresh();
  }

  function locate(initial) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
      S.me = [p.coords.latitude, p.coords.longitude]; map?.put('me', S.me, 'me');
      if (S.mode === 'pick') map?.map.setView(S.me, 16); else if (!S.ride && (initial || S.mode === 'idle')) map?.map.setView(S.me, 15);
      loadTaxis(true);
    }, () => { if (!initial) toast('تعذر تحديد موقعك. فعّل GPS وأذن للموقع.', 'err'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }
  async function loadTaxis(force) {
    if (!map || S.ride || Date.now() - taxiAt < (force ? 2500 : 9000)) return; taxiAt = Date.now();
    const c = S.me || map.center();
    try { S.dir = await rpc('taxi_directory', { p_lat: c[0], p_lng: c[1] }) || []; } catch { return; }
    S.taxis = S.dir.filter(t => t.state === 'live' && t.lat != null);
    if (S.sel) S.sel = S.dir.find(t => t.k === S.sel.k) || null;
    if (!S.ride) { if (S.mode === 'idle' || S.mode === 'pick') map.syncCars(S.taxis, onTapTaxi); if (S.mode === 'idle') draw(); }
  }
  function onTapTaxi(t) { if (S.mode !== 'idle' || S.ride) return; S.sel = S.dir.find(x => x.k === t.k) || t; draw(true); }

  /* ---------- تحميل الرحلة ---------- */
  async function loadRide() {
    let { data } = await db.from('rides').select('*').eq('customer_id', user.id).in('status', ACTIVE).order('created_at', { ascending: false }).limit(1);
    let r = data?.[0] || null;
    if (!r) {
      const since = new Date(Date.now() - 864e5).toISOString();
      const { data: c } = await db.from('rides').select('*').eq('customer_id', user.id).eq('status', 'completed').is('rating', null).gt('completed_at', since).order('completed_at', { ascending: false }).limit(1);
      if (c?.[0] && !dismissed.has(c[0].id)) r = c[0];
    }
    return r;
  }
  async function refresh() {
    if (busyRide) return; busyRide = true;
    try {
      const prev = S.ride, r = await loadRide();
      if (!r && prev && prev.status !== 'completed') {
        const { data } = await db.from('rides').select('status,cancelled_by').eq('id', prev.id).maybeSingle();
        if (data?.status === 'cancelled' && data.cancelled_by === 'provider') toast('ألغى السائق الرحلة. يمكنك طلب رحلة جديدة.', 'err');
      }
      const changed = !prev || !r || prev.id !== r.id || prev.status !== r.status;
      S.ride = r;
      if (r && changed) { S.quotes = []; S.live = null; S.contact = null; S.unread = 0; setupRide(); }
      if (!r && prev) { unwatch?.(); unwatch = null; map?.remove('car'); map?.remove('lineA'); map?.line('route', null); map?.line('guide', null); }
      if (r?.status === 'searching') await loadQuotes();
      if (r && TRACK.includes(r.status)) { await Promise.all([loadLive(), S.contact ? 0 : loadContact(r)]); }
      if (r?.status === 'completed' && !S.rating) { S.rating = true; draw(true); await rateSheet({ db, ride: r }); dismissed.add(r.id); S.rating = false; S.ride = null; S.mode = 'idle'; map?.line('route', null); clearRideMarks(); draw(true); loadTaxis(true); return; }
      if (r?.status === 'searching' && !S.quotes.length && Date.now() - new Date(r.created_at) > 175000) { try { await rpc('mark_no_driver', { p_ride_id: r.id }); S.ride = { ...r, status: 'no_driver' }; } catch {} }
      draw(changed); syncMap(changed);
    } catch (e) { console.error(e); } finally { busyRide = false; }
  }
  const tick = () => refresh();
  function setupRide() {
    const r = S.ride; unwatch?.(); unwatch = null;
    if (!r || !ACTIVE.includes(r.status)) return;
    chans.splice(0).forEach(c => { if (c.topic?.includes('c-rides')) chans.push(c); else db.removeChannel(c); });
    chans.push(db.channel('c-q-' + r.id).on('postgres_changes', { event: '*', schema: 'public', table: 'ride_quotes', filter: 'ride_id=eq.' + r.id }, () => tick()).subscribe());
    if (TRACK.includes(r.status)) unwatch = watchMessages(db, r.id, user.id, () => { if (!chatOpen) { S.unread++; draw(true); } });
  }
  async function loadQuotes() { try { S.quotes = (await rpc('quotes_for_ride', { p_ride_id: S.ride.id })) || []; } catch { } }
  async function loadLive() {
    try { const d = await rpc('ride_live', { p_ride_id: S.ride.id }); S.live = d?.[0] || null; } catch { }
  }
  async function loadContact(r) {
    try { const d = await rpc('ride_contact', { p_ride_id: r.id }); S.contact = d?.[0] || { full_name: 'السائق', phone: '' }; } catch { S.contact = { full_name: 'السائق', phone: '' }; }
  }
  const qinfo = id => { try { return JSON.parse(localStorage.getItem('ween-q-' + id) || 'null'); } catch { return null; } };

  /* ---------- الخريطة ---------- */
  function clearRideMarks() { ['a', 'b', 'car', 'route', 'guide'].forEach(k => { map?.remove(k); }); map?.line('route', null); map?.line('guide', null); }
  function syncMap(changed) {
    if (!map) return; const r = S.ride;
    if (!r) { if (S.mode === 'compose') return; if (S.me) map.put('me', S.me, 'me'); return; }
    map.syncCars([]); map.put('a', [r.pickup_lat, r.pickup_lng], 'pin', '#1a7f37'); map.put('b', [r.dropoff_lat, r.dropoff_lng], 'pin', '#c0392b');
    const pts = [[r.pickup_lat, r.pickup_lng], [r.dropoff_lat, r.dropoff_lng]];
    if (S.live && TRACK.includes(r.status)) {
      const car = [S.live.lat, S.live.lng]; map.put('car', car, 'car', '#000'); pts.push(car);
      const tgt = r.status === 'started' ? [r.dropoff_lat, r.dropoff_lng] : [r.pickup_lat, r.pickup_lng];
      map.line('guide', [car, tgt], { dashArray: '6 8', weight: 4, color: '#555' });
    } else map.line('guide', null);
    if (changed) { map.fix(); map.fit(pts, [50, 60], [50, (sheet?.offsetHeight || 280) + 24]); }
  }

  /* ---------- الورقة السفلية ---------- */
  function draw(force) {
    if (!sheet) return;
    const html = sheetHtml();
    $('#cpin')?.classList.toggle('hidden', S.mode !== 'pick');
    if (!force && html === S.lastHtml) return; S.lastHtml = html; sheet.innerHTML = html;
  }
  function sheetHtml() {
    const r = S.ride;
    if (r) {
      if (r.status === 'searching') return searchingHtml(r);
      if (r.status === 'no_driver') return `<div class="handle"></div><div class="empty-st">${ic('clock', 40)}<h3>لم يرد أحد حتى الآن</h3><p class="muted">لم يرسل أي مكتب أو سائق عرضاً. جرّب مرة أخرى أو ألغِ الطلب.</p></div>
        <button class="btn full big" data-act="retry">إعادة البحث</button><button class="btn light full" data-act="cancel">إلغاء الطلب</button>`;
      if (TRACK.includes(r.status)) return trackHtml(r);
      return `<div class="handle"></div><div class="empty-st"><div class="spin"></div></div>`;
    }
    if (S.mode === 'pick') return `<div class="handle"></div><h3>${S.step === 'pickup' ? 'حدّد نقطة الانطلاق' : 'حدّد الوجهة'}</h3><p class="muted small">حرّك الخريطة حتى تصبح الدبوس على المكان المطلوب.</p>
      <div class="row2">${S.step === 'pickup' ? `<button class="btn light" data-act="locate">${ic('target', 18)} موقعي</button>` : `<button class="btn light" data-act="backpick">رجوع</button>`}<button class="btn" data-act="confirmpick">تأكيد ${S.step === 'pickup' ? 'الانطلاق' : 'الوجهة'}</button></div>
      <button class="link" data-act="cancelpick">إلغاء</button>`;
    if (S.mode === 'compose') return composeHtml();
    if (S.sel) return `<div class="handle"></div>${taxiCard(S.sel)}`;
    const n = S.taxis?.length || 0;
    return `<div class="handle"></div><button class="where" data-act="start">${ic('flag', 22)}<span>وين رايح؟</span></button>
      <p class="avail">${n ? `<i class="live-dot"></i> ${n} ${n === 1 ? 'سيارة متاحة' : 'سيارات متاحة'} قربك` : 'لا توجد سيارات ظاهرة على الخريطة الآن'}</p>
      <button class="dirbtn" data-act="dir">${ic('users', 18)} المكاتب والسائقون (${S.dir.length})</button>`;
  }
  function composeHtml() {
    const d = hav(...S.pickup, ...S.dropoff);
    const opt = k => `<button type="button" class="opt ${S.opts[k] ? 'on' : ''}" data-opt="${k}">${ic(OPT_LABELS[k][0], 18)}<span>${OPT_LABELS[k][1]}</span></button>`;
    const veh = (k, n, d2) => `<button type="button" class="veh ${S.veh === k ? 'selected' : ''}" data-veh="${k}">${ic('car', 30)}<b>${n}</b><span>${d2}</span></button>`;
    return `<div class="handle"></div>
      <div class="routebox"><div>${ic('pin', 16)}<input id="ptxt" maxlength="120" value="${esc(S.ptxt)}" placeholder="وصف مكان الانطلاق"><button class="mini" data-act="repick" data-step="pickup">${ic('target', 16)}</button></div>
      <div>${ic('flag', 16)}<input id="dtxt" maxlength="120" value="${esc(S.dtxt)}" placeholder="اسم الوجهة (مثال: سوق يبرود)"><button class="mini" data-act="repick" data-step="dropoff">${ic('target', 16)}</button></div></div>
      <p class="small center">المسافة التقريبية ${fmtKm(d)} · السعر تحدده المكاتب والسائقون وتختار الأنسب لك</p>
      <div class="vehicles">${veh('economy', 'اقتصادي', 'الأرخص')}${veh('comfort', 'مريح', 'سيارة أحدث')}</div>
      <div class="pax"><span>${ic('users', 18)} عدد الركاب</span><div class="stepper-n"><button data-act="pax" data-d="-1" aria-label="أقل">${ic('minus', 16)}</button><b>${S.pax}</b><button data-act="pax" data-d="1" aria-label="أكثر">${ic('plus', 16)}</button></div></div>
      <div class="opts">${['luggage', 'ac', 'child_seat', 'pets'].map(opt).join('')}</div>
      <input id="notes" class="notes" maxlength="300" placeholder="ملاحظات للسائق (اختياري)" value="${esc(S.notes)}">
      ${S.verified === false ? `<div class="kyc-banner">${ic('shield', 20)}<span>لطلب رحلة تحتاج توثيق هويتك مرة واحدة.</span></div>` : ''}
      <button class="btn full big" data-act="request">${S.verified === false ? 'وثّق هويتك واطلب' : 'اطلب الآن'}</button><button class="link" data-act="cancelcompose">رجوع</button>`;
  }
  function searchingHtml(r) {
    const secs = Math.floor((Date.now() - new Date(r.created_at)) / 1000);
    const q = [...S.quotes].sort((a, b) => a.price - b.price);
    const minEta = Math.min(...q.map(x => x.eta_minutes ?? 999));
    const list = q.map((x, i) => `<div class="quote"><div class="q-main"><b>${esc(x.provider_name)}</b><small>${esc(roleNames[x.provider_role] || '')}${x.vehicle_make ? ' · ' + esc([x.vehicle_make, x.vehicle_model, x.vehicle_color].filter(Boolean).join(' ')) : ''}</small>
      <div class="q-tags">${i === 0 && q.length > 1 ? '<span class="tag gold">الأرخص</span>' : ''}${x.eta_minutes != null && x.eta_minutes === minEta && q.length > 1 ? '<span class="tag">الأسرع</span>' : ''}${stars(x.rating_avg)}${x.trips ? `<small>${x.trips} رحلة</small>` : ''}</div></div>
      <div class="q-side"><b class="price">${money(x.price)}</b>${x.eta_minutes != null ? `<small>${ic('clock', 12)} ${x.eta_minutes} د</small>` : ''}<button class="btn sm" data-act="choose" data-q="${x.quote_id}" data-qi='${esc(JSON.stringify({ n: x.provider_name, v: [x.vehicle_make, x.vehicle_model, x.vehicle_year, x.vehicle_color].filter(Boolean).join(' '), r: x.rating_avg }))}'>اختيار</button></div></div>`).join('');
    return `<div class="handle"></div><div class="srch"><div class="pulse"><i></i><i></i>${ic('car', 26)}</div><div><h3>${q.length ? 'وصلتك عروض' : 'نرسل طلبك للمكاتب والسائقين'}</h3><p class="muted small">${q.length ? 'اختر العرض الأنسب لك' : 'عادةً تصل العروض خلال دقيقة'} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</p></div></div>
      <div class="chips">${optChips(r)}</div><div class="quotes">${list}</div>
      <button class="btn light full" data-act="cancel">إلغاء الطلب</button>`;
  }
  function trackHtml(r) {
    const c = S.contact || { full_name: 'السائق', phone: '' }, qi = qinfo(r.id) || {};
    let eta = '', fresh = true;
    if (S.live) {
      fresh = Date.now() - new Date(S.live.updated_at) < 60000;
      if (r.status === 'on_the_way' || r.status === 'accepted') { const d = hav(S.live.lat, S.live.lng, r.pickup_lat, r.pickup_lng); eta = `<div class="eta"><b>${etaMin(d)}</b><small>دقيقة تقريباً</small><small>${fmtKm(d)}</small></div>`; }
      else if (r.status === 'started') { const d = hav(S.live.lat, S.live.lng, r.dropoff_lat, r.dropoff_lng); eta = `<div class="eta"><b>${etaMin(d)}</b><small>دقيقة للوصول</small><small>${fmtKm(d)}</small></div>`; }
    }
    const head = { accepted: 'تم قبول طلبك', on_the_way: 'السيارة في الطريق إليك', arrived: 'وصلت السيارة، تفضّل', started: 'رحلة سعيدة' }[r.status];
    const canCancel = r.status !== 'started';
    return `<div class="handle"></div><div class="row"><h3>${head}</h3><b class="price">${money(r.price)}</b></div>${stepper(r.status)}
      ${!fresh ? `<div class="warn">${ic('wifioff', 16)} موقع السيارة لم يتحدّث منذ قليل</div>` : ''}
      <div class="driver"><div class="avatar-s">${esc((c.full_name || '؟').trim()[0] || '؟')}</div><div class="grow"><b>${esc(c.full_name)}</b><small>${esc(qi.v || '')}${qi.r ? ' · ' : ''}${qi.r ? stars(qi.r, 12) : ''}</small></div>${eta}</div>
      <div class="chips">${optChips(r)}${r.notes ? `<span class="chip">${ic('chat', 14)} ${esc(r.notes)}</span>` : ''}</div>
      <div class="actions3">${c.phone ? `<a class="btn light" href="tel:${esc(c.phone)}">${ic('phone', 20)} اتصال</a>` : ''}<button class="btn light rel" data-act="chat">${ic('chat', 20)} رسالة${S.unread ? `<em class="badge">${S.unread}</em>` : ''}</button>${canCancel ? `<button class="btn light danger" data-act="cancel">${ic('close', 18)} إلغاء</button>` : ''}</div>`;
  }

  /* ---------- الأحداث ---------- */
  function onInput(e) {
    const t = e.target;
    if (t.id === 'ptxt') S.ptxt = t.value; else if (t.id === 'dtxt') S.dtxt = t.value; else if (t.id === 'notes') S.notes = t.value;
  }
  async function onClick(e) {
    const b = e.target.closest('[data-act],[data-opt],[data-veh]'); if (!b) return;
    if (b.dataset.opt) { S.opts[b.dataset.opt] = !S.opts[b.dataset.opt]; return draw(true); }
    if (b.dataset.veh) { S.veh = b.dataset.veh; return draw(true); }
    const a = b.dataset.act;
    try {
      if (a === 'locate') locate(false);
      else if (a === 'dir') openDirectory(S.dir, t => { S.sel = t; if (t.state === 'live' && t.lat != null) map?.flyTo([t.lat, t.lng], 16); draw(true); })
      else if (a === 'tclose') { S.sel = null; draw(true); }
      else if (a === 'tlocate') { const t = S.dir.find(x => x.k === b.dataset.k); if (t?.lat != null) map?.flyTo([t.lat, t.lng], 17); }
      else if (a === 'start') { S.sel = null; S.mode = 'pick'; S.step = 'pickup'; S.pickup = null; S.dropoff = null; map?.syncCars([]); if (S.me) map?.map.setView(S.me, 16); draw(true); }
      else if (a === 'cancelpick' || a === 'cancelcompose') { S.mode = 'idle'; clearRideMarks(); draw(true); loadTaxis(true); }
      else if (a === 'backpick') { S.step = 'pickup'; draw(true); }
      else if (a === 'confirmpick') confirmPick();
      else if (a === 'repick') { S.mode = 'pick'; S.step = b.dataset.step; clearRideMarks(); map?.map.setView(S.step === 'pickup' ? S.pickup : S.dropoff, 17); draw(true); }
      else if (a === 'pax') { S.pax = Math.max(1, Math.min(8, S.pax + +b.dataset.d)); draw(true); }
      else if (a === 'request') await submit(b);
      else if (a === 'choose') await choose(b);
      else if (a === 'cancel') { if (await confirmBox('هل تريد إلغاء الطلب؟', 'نعم، ألغِ', 'لا، تابع')) { await rpc('cancel_ride', { p_ride_id: S.ride.id }); toast('تم إلغاء الطلب'); S.ride = null; S.mode = 'idle'; clearRideMarks(); await refresh(); draw(true); loadTaxis(true); } }
      else if (a === 'retry') { await rpc('retry_ride', { p_ride_id: S.ride.id }); await refresh(); }
      else if (a === 'chat') { S.unread = 0; draw(true); await openChat({ db, user, rideId: S.ride.id, name: S.contact?.full_name || 'السائق', phone: S.contact?.phone || '' }); }
    } catch (x) { toast(errMsg(x), 'err'); }
  }
  function confirmPick() {
    const c = map.center();
    if (S.step === 'pickup') {
      S.pickup = c; S.ptxt = S.me && hav(...c, ...S.me) < 150 ? 'موقعي الحالي' : 'نقطة على الخريطة'; map.put('a', c, 'pin', '#1a7f37'); S.step = 'dropoff'; draw(true);
    } else {
      if (hav(...S.pickup, ...c) < 80) return toast('الوجهة قريبة جداً من نقطة الانطلاق.', 'err');
      S.dropoff = c; if (!S.dtxt) S.dtxt = ''; map.put('a', S.pickup, 'pin', '#1a7f37'); map.put('b', c, 'pin', '#c0392b'); map.line('route', [S.pickup, c], { dashArray: '6 8', color: '#555' }); map.fit([S.pickup, c], [50, 60], [50, (sheet?.offsetHeight || 420) + 24]);
      S.mode = 'compose'; draw(true);
    }
  }
  async function submit(btn) {
    if (!S.dtxt.trim()) { toast('اكتب اسم الوجهة ليعرفها السائق.', 'err'); $('#dtxt')?.focus(); return; }
    btn.disabled = true; const label = btn.textContent;
    const args = { p_pickup: S.ptxt.trim() || 'نقطة على الخريطة', p_dropoff: S.dtxt.trim(), p_pickup_lat: S.pickup[0], p_pickup_lng: S.pickup[1], p_dropoff_lat: S.dropoff[0], p_dropoff_lng: S.dropoff[1], p_vehicle_type: S.veh, p_passengers: S.pax, p_notes: S.notes.trim() || null, p_options: Object.fromEntries(Object.entries(S.opts).filter(([, v]) => v)) };
    try {
      try { await rpc('request_ride', args); }
      catch (e) {
        if (e.message !== 'identity_required') throw e;
        const ok = await openKyc({ db, profile }); if (!ok) throw new Error('يلزم توثيق الهوية لطلب رحلة.');
        S.verified = true; await rpc('request_ride', args);
      }
      toast('تم إرسال طلبك', 'ok'); S.mode = 'idle'; S.opts = {}; S.notes = ''; S.pax = 1; clearRideMarks(); await refresh();
    } catch (e) { toast(errMsg(e), 'err'); btn.disabled = false; btn.textContent = label; }
  }
  async function choose(btn) {
    btn.disabled = true;
    const res = await rpc('choose_quote', { p_quote_id: +btn.dataset.q });
    if (res === 'ok') { try { localStorage.setItem('ween-q-' + S.ride.id, JSON.stringify(JSON.parse(btn.dataset.qi))); } catch { } toast('تم تأكيد الرحلة', 'ok'); await refresh(); }
    else { toast({ taken: 'هذا العرض لم يعد متاحاً، اختر عرضاً آخر.', busy: 'هذا السائق انشغل برحلة أخرى، اختر عرضاً آخر.', gone: 'الطلب لم يعد متاحاً.' }[res] || 'تعذر قبول العرض.', 'err'); await refresh(); }
  }

  /* ---------- رحلاتي ---------- */
  async function renderOrders(pane) {
    pane.innerHTML = '<div class="page"><h2 class="ph">رحلاتي</h2><div class="spin mid"></div></div>';
    const { data, error } = await db.from('rides').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) { pane.innerHTML = `<div class="page"><p class="center">${esc(errMsg(error))}</p></div>`; return; }
    pane.innerHTML = `<div class="page"><h2 class="ph">رحلاتي</h2>${data.length ? data.map(r => rideRow(r)).join('') : `<div class="empty-st">${ic('car', 44)}<h3>لا توجد رحلات بعد</h3><p class="muted">رحلاتك السابقة ستظهر هنا مع مسار كل رحلة.</p></div>`}</div>`;
    pane.onclick = async e => {
      const b = e.target.closest('[data-ride]'); if (!b) return; const r = data.find(x => x.id === +b.dataset.ride);
      if (r.status === 'completed') await openRoute({ db, ride: r });
      else if (ACTIVE.includes(r.status)) shell.show('home'); else toast(statusNames[r.status] || '');
    };
  }

  /* ---------- حسابي ---------- */
  async function renderAccount(pane) {
    pane.innerHTML = '<div class="page"><div class="spin mid"></div></div>';
    const [{ data: rs }, { data: idn }] = await Promise.all([db.from('rides').select('status,price,distance_m').eq('customer_id', user.id).limit(500), db.from('customer_identity').select('verified_at').eq('user_id', user.id).maybeSingle()]);
    S.verified = !!idn; const done = (rs || []).filter(r => r.status === 'completed');
    const spent = done.reduce((s, r) => s + (r.price || 0), 0), km = done.reduce((s, r) => s + (r.distance_m || 0), 0);
    const row = (i, t, act, extra = '') => `<button class="menu-row" data-a="${act}">${ic(i, 22)}<span class="grow">${t}</span>${extra}${ic('back', 18, 'chev')}</button>`;
    pane.innerHTML = `<div class="page acc"><div class="avatar">${esc((profile.full_name || '؟').trim()[0])}</div><h2 class="ctr">${esc(profile.full_name)}</h2><p class="ph-no">${esc(profile.phone || '')}</p>
      <div class="idcard ${S.verified ? 'ok' : ''}">${ic(S.verified ? 'shield' : 'id', 26)}<div><b>${S.verified ? 'هويتك موثّقة' : 'الهوية غير موثّقة'}</b><small>${S.verified ? 'يمكنك طلب الرحلات' : 'مطلوب مرة واحدة قبل أول رحلة'}</small></div>${S.verified ? '' : '<button class="btn sm" data-a="kyc">وثّق الآن</button>'}</div>
      <div class="stats"><div><b>${done.length}</b><small>رحلة مكتملة</small></div><div><b>${(km / 1000).toFixed(1)}</b><small>كم</small></div><div><b>${spent.toLocaleString('en-US')}</b><small>ل.س أُنفقت</small></div></div>
      <div class="menu">${row('moon', 'الوضع الليلي', 'theme')}<a class="menu-row" href="tel:${SUPPORT}">${ic('phone', 22)}<span class="grow">الدعم والمساعدة</span>${ic('back', 18, 'chev')}</a></div>
      <button class="btn-soft" data-a="logout">${ic('logout', 20)} تسجيل الخروج</button></div>`;
    pane.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'logout') logout(); else if (b.dataset.a === 'theme') toggleTheme();
      else if (b.dataset.a === 'kyc') { if (await openKyc({ db, profile })) renderAccount(pane); }
    };
  }

  return () => { timers.forEach(clearInterval); chans.forEach(c => db.removeChannel(c)); unwatch?.(); map?.destroy(); };
}
