// المحادثة: شاشة مستقلة (ردود سريعة، مشاركة الموقع، علامات القراءة، "يكتب…") + صندوق الرسائل
import { esc, toast, fmtTime, fmtDate, ago, errMsg, beep, roleNames } from './utils.js';
import { ic } from './icons.js';

export let chatOpen = false;
const ACTIVE = ['accepted', 'on_the_way', 'arrived', 'started'];
const QUICK = {
  customer: ['أنا بانتظارك', 'أين أنت الآن؟', 'أنا عند الباب', 'أنا في المكان المحدد', 'شكراً لك'],
  provider: ['أنا في الطريق إليك', 'وصلت، أنا بالخارج', 'أرسل لي موقعك من فضلك', 'سأتأخر قليلاً', 'ما هو العنوان بالضبط؟'],
};
const LOC = /^📍 (.{0,40}?): (https:\/\/www\.google\.com\/maps\?q=-?[\d.]+,-?[\d.]+)$/;

// إشعار الرسائل الجديدة داخل الرحلة (خارج نافذة المحادثة)
export function watchMessages(db, rideId, userId, onNew) {
  const ch = db.channel('msgs-' + rideId + '-' + Math.random().toString(36).slice(2, 6))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: 'ride_id=eq.' + rideId },
      p => { if (p.new.sender_id !== userId) onNew(p.new); }).subscribe();
  return () => db.removeChannel(ch);
}
// مراقبة كل رسائلي (للشارة الحمراء في تبويب الرسائل)
export function watchInbox(db, userId, onNew) {
  const ch = db.channel('inbox-' + userId + '-' + Math.random().toString(36).slice(2, 6))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages' }, p => { if (p.new.sender_id !== userId) onNew(p.new); }).subscribe();
  return () => db.removeChannel(ch);
}

export function openChat({ db, user, rideId, name = 'المحادثة', phone = '', canSend, role = 'customer', ride = null }) {
  return new Promise(resolve => {
    chatOpen = true;
    const ov = document.createElement('div'); ov.className = 'overlay chat'; document.body.appendChild(ov);
    ov.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back', 22)}</button>
      <div class="ttl"><b>${esc(name)}</b><small id="sub">محادثة الطلب رقم ${rideId}</small></div>
      ${phone ? `<a class="icon-btn" href="tel:${esc(phone)}" aria-label="اتصال">${ic('phone', 20)}</a>` : '<span style="width:40px"></span>'}</header>
      <div class="chat-strip" id="strip"></div>
      <div id="msgs" class="msgs"><div class="spin mid"></div></div>
      <div class="quick" id="quick"></div>
      <form id="cf" class="composer"></form>`;
    const box = ov.querySelector('#msgs'), strip = ov.querySelector('#strip'), quick = ov.querySelector('#quick'), form = ov.querySelector('#cf'), sub = ov.querySelector('#sub');
    const seen = new Map(); let lastDay = '', send = canSend, typingT = 0, typingHide;
    const tick = m => m.sender_id === user.id ? `<i class="tk ${m.read_at ? 'rd' : ''}">${ic('check', 12)}${m.read_at ? ic('check', 12) : ''}</i>` : '';
    const bubble = m => {
      const mine = m.sender_id === user.id, loc = LOC.exec(m.body);
      const day = new Date(m.created_at).toDateString(); let sep = '';
      if (day !== lastDay) { lastDay = day; sep = `<div class="dsep"><span>${fmtDate(m.created_at)}</span></div>`; }
      const body = loc ? `<a class="locmsg" href="${loc[2]}" target="_blank" rel="noopener">${ic('pin', 18)}<span><b>${esc(loc[1])}</b><small>اضغط لفتح الخريطة</small></span></a>` : esc(m.body);
      return `${sep}<div class="bub ${mine ? 'mine' : 'theirs'}" data-id="${m.id}">${body}<small>${fmtTime(m.created_at)} ${tick(m)}</small></div>`;
    };
    const add = m => {
      if (seen.has(m.id)) return; seen.set(m.id, m);
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
      box.querySelector('.empty')?.remove(); box.querySelector('.spin')?.remove(); box.insertAdjacentHTML('beforeend', bubble(m)); if (near) box.scrollTop = box.scrollHeight;
    };
    const markRead = () => db.rpc('mark_read', { p_ride_id: rideId }).then(() => { }, () => { });
    const drawComposer = () => {
      quick.innerHTML = send ? (QUICK[role] || QUICK.customer).map(t => `<button type="button" data-q="${esc(t)}">${esc(t)}</button>`).join('') : '';
      form.innerHTML = send ? `<button type="button" class="icon-btn lg" data-loc aria-label="مشاركة موقعي">${ic('pin', 20)}</button><input name="m" maxlength="500" placeholder="اكتب رسالة…" autocomplete="off" required><button class="send" aria-label="إرسال">${ic('send', 20)}</button>` : '<p class="small center" style="flex:1">انتهى الطلب، المحادثة للقراءة فقط.</p>';
    };
    const post = async body => {
      const { data, error } = await db.from('ride_messages').insert({ ride_id: rideId, sender_id: user.id, body }).select('id,sender_id,body,created_at,read_at').single();
      if (error) { toast(/row-level|policy/i.test(error.message) ? 'لا يمكن إرسال رسائل الآن.' : errMsg(error), 'err'); return false; }
      add(data); return true;
    };
    (async () => {
      let r = ride; if (!r) { const x = await db.from('rides').select('pickup,dropoff,kind,item,status').eq('id', rideId).maybeSingle(); r = x.data; }
      if (r) {
        if (send === undefined) send = ACTIVE.includes(r.status);
        strip.innerHTML = `<span>${ic(r.kind === 'delivery' ? 'box' : 'car', 14)} ${r.kind === 'delivery' ? esc(r.item || 'توصيل') : 'رحلة'}</span><span>${ic('pin', 14)} ${esc(r.pickup)}</span><span>${ic('flag', 14)} ${esc(r.dropoff)}</span>`;
      } else strip.remove();
      if (send === undefined) send = false; drawComposer();
      const { data, error } = await db.from('ride_messages').select('id,sender_id,body,created_at,read_at').eq('ride_id', rideId).order('created_at').limit(300);
      if (error) { box.innerHTML = `<p class="small center">${esc(errMsg(error))}</p>`; return; }
      box.innerHTML = data?.length ? '' : `<div class="empty chat-empty">${ic('chat', 40)}<p>ابدأ المحادثة برسالة أو اضغط أحد الردود السريعة</p></div>`;
      (data || []).forEach(add); box.scrollTop = box.scrollHeight; markRead();
    })();
    const ch = db.channel('chat-' + rideId + '-' + Math.random().toString(36).slice(2, 6))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: 'ride_id=eq.' + rideId }, p => { add(p.new); if (p.new.sender_id !== user.id) { beep(); markRead(); } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ride_messages', filter: 'ride_id=eq.' + rideId }, p => {
        const m = seen.get(p.new.id); if (!m) return; m.read_at = p.new.read_at; const el = box.querySelector(`[data-id="${m.id}"] .tk`); if (el && m.read_at) { el.classList.add('rd'); el.innerHTML = ic('check', 12) + ic('check', 12); } })
      .on('broadcast', { event: 'typing' }, p => { if (p.payload?.u === user.id) return; sub.textContent = 'يكتب الآن…'; clearTimeout(typingHide); typingHide = setTimeout(() => { sub.textContent = 'محادثة الطلب رقم ' + rideId; }, 3000); })
      .subscribe();
    form.onsubmit = async e => { e.preventDefault(); const i = form.elements.m; const body = i.value.trim(); if (!body) return; i.value = ''; if (!await post(body)) i.value = body; };
    form.addEventListener('input', () => { if (Date.now() - typingT > 2000) { typingT = Date.now(); try { ch.send({ type: 'broadcast', event: 'typing', payload: { u: user.id } }); } catch { } } });
    ov.addEventListener('click', async e => {
      if (e.target.closest('[data-x]')) { db.removeChannel(ch); ov.remove(); chatOpen = false; resolve(); return; }
      const q = e.target.closest('[data-q]'); if (q) { q.disabled = true; await post(q.dataset.q); q.disabled = false; return; }
      const l = e.target.closest('[data-loc]');
      if (l) {
        if (!navigator.geolocation) return toast('الموقع غير مدعوم في هذا المتصفح.', 'err');
        l.disabled = true; toast('جارٍ تحديد موقعك…');
        navigator.geolocation.getCurrentPosition(async p => { await post(`📍 موقعي: https://www.google.com/maps?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`); l.disabled = false; },
          () => { toast('تعذر تحديد موقعك. اسمح للموقع من إعدادات المتصفح.', 'err'); l.disabled = false; }, { enableHighAccuracy: true, timeout: 10000 });
      }
    });
  });
}

// تبويب الرسائل: كل المحادثات في واجهة مستقلة
export async function renderInbox(pane, { db, user, role = 'customer', onChange }) {
  pane.innerHTML = '<div class="page"><h2 class="ph">الرسائل</h2><div class="spin mid"></div></div>';
  const { data, error } = await db.rpc('chat_inbox');
  const list = error ? [] : (data || []);
  const unread = list.reduce((s, x) => s + (x.unread || 0), 0); onChange?.(unread);
  const row = x => `<button class="inbox-row ${x.unread ? 'unr' : ''}" data-r="${x.ride_id}"><div class="avatar-s ${x.other_role === 'motor' ? 'orange' : x.other_role === 'office' ? 'gold' : ''}">${esc((x.other_name || '؟').trim()[0] || '؟')}</div>
    <div class="grow"><div class="rr-top"><b>${esc(x.other_name || '')}</b><small>${ago(x.last_at)}</small></div>
    <small class="lm">${x.last_body ? (x.last_mine ? 'أنت: ' : '') + esc(x.last_body.startsWith('📍') ? '📍 موقع' : x.last_body) : 'لا رسائل بعد، ابدأ المحادثة'}</small>
    <div class="chips">${x.live ? '<span class="pill live">طلب جارٍ</span>' : '<span class="pill">منتهٍ</span>'}<span class="chip">${ic(x.kind === 'delivery' ? 'box' : 'car', 12)} ${x.kind === 'delivery' ? 'توصيل' : 'رحلة'}</span><span class="chip">${esc(roleNames[x.other_role] || '')}</span></div></div>${x.unread ? `<em class="badge">${x.unread}</em>` : ''}</button>`;
  pane.innerHTML = `<div class="page"><h2 class="ph">الرسائل</h2>${error ? `<p class="center">${esc(errMsg(error))}</p>` : list.length ? list.map(row).join('') : `<div class="empty-st">${ic('chat', 44)}<h3>لا توجد محادثات</h3><p class="muted">تفتح المحادثة تلقائياً عندما يقبل أحدهم طلبك أو تقبل طلب زبون.</p></div>`}</div>`;
  pane.onclick = async e => {
    const b = e.target.closest('[data-r]'); if (!b) return; const x = list.find(i => i.ride_id === +b.dataset.r); let phone = '';
    if (x.live) { try { const { data: c } = await db.rpc('ride_contact', { p_ride_id: x.ride_id }); phone = c?.[0]?.phone || ''; } catch { } }
    await openChat({ db, user, rideId: x.ride_id, name: x.other_name, phone, canSend: x.live, role });
    renderInbox(pane, { db, user, role, onChange });
  };
}
