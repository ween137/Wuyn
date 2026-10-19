import { esc, toast, fmtTime, errMsg } from './utils.js';
import { ic } from './icons.js';

export let chatOpen = false;

// إشعار الرسائل الجديدة (خارج نافذة المحادثة)
export function watchMessages(db, rideId, userId, onNew) {
  const ch = db.channel('msgs-' + rideId + '-' + Math.random().toString(36).slice(2, 6))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: 'ride_id=eq.' + rideId },
      p => { if (p.new.sender_id !== userId) onNew(p.new); }).subscribe();
  return () => db.removeChannel(ch);
}

export function openChat({ db, user, rideId, name = 'المحادثة', phone = '', canSend = true }) {
  return new Promise(resolve => {
    chatOpen = true;
    const ov = document.createElement('div'); ov.className = 'overlay chat'; document.body.appendChild(ov);
    ov.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back', 22)}</button>
      <div class="ttl"><b>${esc(name)}</b><small>محادثة الرحلة</small></div>
      ${phone ? `<a class="icon-btn" href="tel:${esc(phone)}" aria-label="اتصال">${ic('phone', 20)}</a>` : '<span style="width:40px"></span>'}</header>
      <div id="msgs" class="msgs"></div>
      <form id="cf" class="composer">${canSend ? `<input name="m" maxlength="500" placeholder="اكتب رسالة…" autocomplete="off" required><button class="send" aria-label="إرسال">${ic('send', 20)}</button>` : '<p class="small center" style="flex:1">انتهت الرحلة، المحادثة للقراءة فقط.</p>'}</form>`;
    const box = ov.querySelector('#msgs'); const seen = new Set();
    const bubble = m => `<div class="bub ${m.sender_id === user.id ? 'mine' : 'theirs'}">${esc(m.body)}<small>${fmtTime(m.created_at)}</small></div>`;
    const add = m => {
      if (seen.has(m.id)) return; seen.add(m.id);
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
      box.querySelector('.empty')?.remove(); box.insertAdjacentHTML('beforeend', bubble(m)); if (near) box.scrollTop = box.scrollHeight;
    };
    (async () => {
      const { data, error } = await db.from('ride_messages').select('id,sender_id,body,created_at').eq('ride_id', rideId).order('created_at').limit(300);
      if (error) { box.innerHTML = `<p class="small center">${esc(errMsg(error))}</p>`; return; }
      box.innerHTML = (data?.length ? '' : '<p class="empty small center">ابدأ المحادثة برسالة</p>'); (data || []).forEach(add); box.scrollTop = box.scrollHeight;
    })();
    const ch = db.channel('chat-' + rideId + '-' + Math.random().toString(36).slice(2, 6))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: 'ride_id=eq.' + rideId }, p => add(p.new)).subscribe();
    ov.querySelector('#cf').onsubmit = async e => {
      e.preventDefault(); const i = e.target.elements.m; const body = i.value.trim(); if (!body) return; i.value = '';
      const { data, error } = await db.from('ride_messages').insert({ ride_id: rideId, sender_id: user.id, body }).select('id,sender_id,body,created_at').single();
      if (error) { i.value = body; return toast(/row-level|policy/i.test(error.message) ? 'لا يمكن إرسال رسائل الآن.' : errMsg(error), 'err'); }
      add(data);
    };
    ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) { db.removeChannel(ch); ov.remove(); chatOpen = false; resolve(); } });
  });
}
