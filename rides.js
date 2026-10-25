// عناصر مشتركة بين شاشات الزبون والسائق
import { esc, statusNames, stName, sizeNames, money, fmtKm, fmtDate, fmtTime, toast, errMsg } from './utils.js';
import { ic } from './icons.js';
import { createMap } from './map.js';
import { ensureLeaflet } from './loader.js';

export const STEPS = [['accepted', 'قُبل الطلب'], ['on_the_way', 'في الطريق'], ['arrived', 'وصل'], ['started', 'الرحلة']];
export const STEPS_D = [['accepted', 'قُبل الطلب'], ['on_the_way', 'للاستلام'], ['arrived', 'عند الاستلام'], ['started', 'للتسليم']];
export function stepper(status, kind = 'taxi') {
  const ST = kind === 'delivery' ? STEPS_D : STEPS, i = ST.findIndex(s => s[0] === status);
  return `<div class="stepper">${ST.map((s, k) => `<div class="stp ${k < i ? 'done' : k === i ? 'now' : ''}"><i>${k < i ? ic('check', 12) : ''}</i><span>${s[1]}</span></div>`).join('')}</div>`;
}
export const OPT_LABELS = { luggage: ['bag', 'أمتعة'], ac: ['snow', 'تكييف'], child_seat: ['baby', 'مقعد أطفال'], pets: ['paw', 'حيوان أليف'] };
export function optChips(r) {
  const o = r.options || {};
  if (r.kind === 'delivery') return `<span class="chip">${ic('box', 14)} ${esc(r.item || 'طلب')}</span>` + (o.size ? `<span class="chip">حجم ${sizeNames[o.size] || ''}</span>` : '') + `<span class="chip">${ic(r.vehicle_type === 'car' ? 'car' : 'motor', 14)} ${r.vehicle_type === 'car' ? 'بسيارة' : 'بمتور'}</span>`;
  const c = Object.keys(OPT_LABELS).filter(k => o[k]).map(k => `<span class="chip">${ic(OPT_LABELS[k][0], 14)} ${OPT_LABELS[k][1]}</span>`);
  if (r.passengers > 1) c.unshift(`<span class="chip">${ic('users', 14)} ${r.passengers} ركاب</span>`);
  return c.join('');
}
export const stars = (n, size = 14) => n ? `<span class="stars">${ic('star', size)} ${Number(n).toFixed(1)}</span>` : '';

export function rideRow(r, { who = '' } = {}) {
  const cls = r.status === 'completed' ? 'ok' : (r.status === 'cancelled' || r.status === 'no_driver') ? 'bad' : 'live';
  return `<button class="ride-row" data-ride="${r.id}"><div class="rr-top"><span class="pill ${cls}">${esc(stName(r.status, r.kind))}</span>${r.kind === 'delivery' ? `<span class="pill">${ic('box', 12)} توصيل</span>` : ''}<small>${fmtDate(r.created_at)} · ${fmtTime(r.created_at)}</small></div>
    <div class="rr-route">${r.kind === 'delivery' ? `<span>${ic('box', 14)} ${esc(r.item || '')}</span>` : ''}<span>${ic('pin', 14)} ${esc(r.pickup)}</span><span>${ic('flag', 14)} ${esc(r.dropoff)}</span></div>
    <div class="rr-bot"><b>${r.price ? money(r.price) : ''}</b><small>${who ? esc(who) : ''}${r.distance_m ? ' · ' + fmtKm(r.distance_m) : ''}</small>${r.rating ? stars(r.rating) : ''}</div></button>`;
}

// عرض المسار الذي سلكته الرحلة
export async function openRoute({ db, ride }) {
  const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
  ov.innerHTML = `<header class="top"><button class="icon-btn" data-x>${ic('back', 22)}</button><div class="ttl">مسار الرحلة</div><span style="width:40px"></span></header>
    <div class="route-map" id="rmap"></div><div class="route-info" id="rinfo"><div class="spin"></div></div>`;
  let m; ov.querySelector('[data-x]').onclick = () => { m?.destroy(); ov.remove(); };
  try {
    await ensureLeaflet(); m = createMap(ov.querySelector('#rmap'), {});
    const { data, error } = await db.rpc('get_ride_track', { p_ride_id: ride.id }); if (error) throw error;
    m.put('a', data.pickup, 'pin', '#1a7f37'); m.put('b', data.dropoff, 'pin', '#c0392b');
    if (data.approach?.length > 1) m.line('ap', data.approach, { color: '#888', weight: 4, dashArray: '2 9' });
    const trip = data.trip?.length > 1 ? data.trip : null;
    m.line('trip', trip || [data.pickup, data.dropoff], trip ? {} : { dashArray: '6 8', color: '#555' });
    m.fit([...(data.trip || []), ...(data.approach || []), data.pickup, data.dropoff]); m.fix();
    const mins = data.started_at && data.completed_at ? Math.max(1, Math.round((new Date(data.completed_at) - new Date(data.started_at)) / 60000)) : null;
    ov.querySelector('#rinfo').innerHTML = `<div class="kv"><div><small>المسافة</small><b>${fmtKm(data.distance_m)}</b></div><div><small>المدة</small><b>${mins ? mins + ' د' : '—'}</b></div><div><small>السعر</small><b>${data.price ? money(data.price) : '—'}</b></div></div>
      ${trip ? '' : '<p class="small center">لم يُسجَّل مسار تفصيلي لهذه الرحلة، هذا خط مباشر بين النقطتين.</p>'}
      <p class="small center"><span class="lg dark"></span> الرحلة <span class="lg dash"></span> وصول السيارة إليك</p>`;
  } catch (e) { ov.querySelector('#rinfo').innerHTML = `<p class="center">${esc(errMsg(e))}</p>`; }
}

// نافذة التقييم
export function rateSheet({ db, ride }) {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'modal'; document.body.appendChild(ov);
    let n = 0;
    ov.innerHTML = `<div class="modal-card"><div class="done-ic">${ic('check', 34)}</div><h3>${ride.kind === 'delivery' ? 'تم التسليم' : 'وصلت بالسلامة'}</h3><p class="muted">${ride.price ? 'المبلغ: <b>' + money(ride.price) + '</b>' : ''}</p>
      <p>${ride.kind === 'delivery' ? 'كيف كانت الخدمة؟' : 'كيف كانت رحلتك؟'}</p><div class="rate">${[1, 2, 3, 4, 5].map(i => `<button data-s="${i}" aria-label="${i}">${ic('star', 34)}</button>`).join('')}</div>
      <input id="rc" maxlength="200" placeholder="ملاحظة (اختياري)"><button class="btn full big" id="rs" disabled>إرسال التقييم</button><button class="btn light full" id="rk">تخطّي</button></div>`;
    const stars = ov.querySelectorAll('[data-s]');
    stars.forEach(b => b.onclick = () => { n = +b.dataset.s; stars.forEach(x => x.classList.toggle('on', +x.dataset.s <= n)); ov.querySelector('#rs').disabled = false; });
    ov.querySelector('#rk').onclick = () => { ov.remove(); res(false); };
    ov.querySelector('#rs').onclick = async e => {
      e.target.disabled = true;
      const { error } = await db.rpc('rate_ride', { p_ride_id: ride.id, p_stars: n, p_comment: ov.querySelector('#rc').value.trim() || null });
      if (error) { toast(errMsg(error), 'err'); e.target.disabled = false; return; }
      toast('شكراً لتقييمك', 'ok'); ov.remove(); res(true);
    };
  });
}

// نافذة تأكيد بسيطة
export function confirmBox(text, yes = 'نعم', no = 'رجوع') {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'modal'; document.body.appendChild(ov);
    ov.innerHTML = `<div class="modal-card"><p class="big-p">${esc(text)}</p><button class="btn danger-solid full" id="y">${esc(yes)}</button><button class="btn light full" id="n">${esc(no)}</button></div>`;
    ov.querySelector('#y').onclick = () => { ov.remove(); res(true); }; ov.querySelector('#n').onclick = () => { ov.remove(); res(false); };
  });
}
