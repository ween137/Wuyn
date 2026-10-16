import {esc,toast,statusNames} from './utils.js';
const BACK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const SEND='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>';
export async function openChat({app,db,user,rideId,onBack}){
  const {data:ride,error}=await db.from('rides').select('*').eq('id',Number(rideId)).maybeSingle();
  if(error||!ride)throw error||new Error('الرحلة غير موجودة');
  if(ride.customer_id!==user.id&&ride.accepted_by!==user.id)throw new Error('المحادثة متاحة لطرفي الرحلة فقط');
  let name='';
  try{const r=await db.rpc('ride_contact',{p_ride_id:Number(rideId)});name=r.data?.[0]?.full_name||''}catch{}
  const title=name?`دردشة مع ${esc(name)}`:'محادثة الرحلة';
  const initial=esc((name||'؟').trim().charAt(0)||'؟');
  app.innerHTML=`<div class="chat-page"><header class="chat-head"><button class="back" id="chat-back" aria-label="رجوع">${BACK}</button><div class="who">${title}</div><div class="av">${initial}</div></header><div class="chat-info">من: ${esc(ride.pickup)} — إلى: ${esc(ride.dropoff)} · ${esc(statusNames[ride.status]||ride.status)}</div><div id="chat-messages" class="chat-list"></div><form id="chat-form" class="chat-form"><input name="message" maxlength="2000" placeholder="اكتب رسالة…" autocomplete="off" required><button aria-label="إرسال">${SEND}</button></form></div>`;
  document.querySelector('#chat-back').onclick=onBack;
  const load=async()=>{
    const box=document.querySelector('#chat-messages');if(!box)return;
    const bottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;
    const {data,error}=await db.from('ride_messages').select('id,sender_id,body,created_at').eq('ride_id',Number(rideId)).order('created_at').limit(200);
    if(error){box.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
    box.innerHTML=(data||[]).map(m=>`<div class="message ${m.sender_id===user.id?'mine':'theirs'}">${esc(m.body)}<div class="small">${new Date(m.created_at).toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'})}</div></div>`).join('')||'<div class="center muted" style="margin:auto">ابدأ المحادثة برسالة</div>';
    if(bottom||!data?.length)box.scrollTop=box.scrollHeight;
  };
  document.querySelector('#chat-form').onsubmit=async e=>{
    e.preventDefault();
    const input=e.target.elements.message,body=input.value.trim();
    if(!body)return;
    const {error}=await db.from('ride_messages').insert({ride_id:Number(rideId),sender_id:user.id,body});
    if(error)return toast(error.message);
    input.value='';load();
  };
  await load();
  const channel=db.channel('ride-chat-'+rideId).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_messages',filter:'ride_id=eq.'+rideId},load).subscribe();
  return()=>db.removeChannel(channel);
}
