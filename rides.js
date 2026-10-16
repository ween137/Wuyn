import {esc,statusNames,toast} from './utils.js';
import {createRideMap} from './map.js';

// أسعار تقديرية للعرض فقط (لا تُحفظ ولا تُحاسَب)
const FARES={economy:5000,comfort:7500};
const SUPPORT_PHONE='0933712979';
const ACTIVE=['searching','accepted','on_the_way','arrived','started'];
let mapCtl=null;
export function destroyMap(){mapCtl?.destroy();mapCtl=null}

/* ---------- أيقونات ---------- */
const svg=(d,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I={
  home:'<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  chev:'<path d="M15 6l-6 6 6 6"/>',
  car:'<path d="M3 16v-3l2-5h14l2 5v3M3 16h18M6 16v2M18 16v2"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
  history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin:'<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4M12 17h.01"/>'
};

/* ---------- الهيكل المشترك ---------- */
const TABS={
  customer:[['home','الرئيسية','home'],['orders','الطلبات','list'],['account','الحساب','user']],
  provider:[['stats','الإحصائيات','chart'],['orders','الطلبات','list'],['account','حسابي','user']]
};
const nav=(kind,tab)=>`<nav class="bottom-nav">${TABS[kind].map(([k,label,ic])=>`<button class="nav-item ${k===tab?'on':''}" data-action="nav" data-value="${k}">${svg(I[ic])}<span>${label}</span></button>`).join('')}</nav>`;
const header=(sub)=>`<header class="top"><div><div class="logo">وين؟</div><small>${esc(sub)}</small></div></header>`;
const shell=(kind,tab,sub,body)=>`${header(sub)}<main class="main">${body}</main>${nav(kind,tab)}`;
const maskPhone=p=>p?p.slice(0,Math.max(0,p.length-6))+' ••• '+p.slice(-3):'';
const when=s=>{try{return new Date(s).toLocaleString('ar',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch{return ''}};

function accountScreen({app,profile,kind}){
  const initial=esc((profile.full_name||'؟').trim().charAt(0)||'؟');
  const roleLabel=profile.role==='office'?'مكتب تكسي':profile.role==='driver'?'سائق مستقل':'زبون';
  const row=(ic,label,extra)=>`<${extra.tag||'div'} class="menu-row" ${extra.attrs||''}>${svg(I[ic])}<span class="grow">${label}</span>${extra.soon?'<span class="pill">قريباً</span>':svg(I.chev,'chev')}</${extra.tag||'div'}>`;
  const items=kind==='customer'
    ?row('history','طلباتي السابقة',{tag:'button',attrs:'data-action="nav" data-value="orders"'})+row('pin','العناوين المحفوظة',{soon:true})+row('card','طرق الدفع',{soon:true})
    :row('chart','الإحصائيات',{tag:'button',attrs:'data-action="nav" data-value="stats"'})+row('history','رحلاتي',{tag:'button',attrs:'data-action="nav" data-value="orders"'});
  const wallet=kind==='customer'?`<div class="wallet"><small>رصيدي ونقاطي</small><b>0 ل.س</b><small style="margin-top:6px;font-weight:500">قريباً</small></div>`:'';
  app.innerHTML=`<header class="hero-black"><div class="logo">وين؟</div></header><section class="sheet"><div class="avatar">${initial}</div><h2>${esc(profile.full_name||'حسابي')}</h2><p class="phone">${esc(maskPhone(profile.phone))}</p><p class="center"><span class="pill">${roleLabel}</span></p>${wallet}<div class="menu">${items}${row('globe','اللغة العربية',{})}${row('help','المساعدة',{tag:'a',attrs:`href="tel:${SUPPORT_PHONE}"`})}</div><button class="btn-soft" data-action="logout">تسجيل الخروج</button></section>${nav(kind,'account')}`;
}

/* ---------- الزبون ---------- */
export async function renderCustomer({app,db,user,profile,tab='home',render}){
  destroyMap();
  if(!['home','orders','account'].includes(tab))tab='home';
  if(tab==='account')return accountScreen({app,profile,kind:'customer'});

  if(tab==='orders'){
    const {data,error}=await db.from('rides').select('*').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(50);
    const list=error?`<div class="note">${esc(error.message)}</div>`:(data||[]).length?data.map(r=>`<div class="card"><div class="row"><span class="pill ${ACTIVE.includes(r.status)?'black':''}">${esc(statusNames[r.status]||r.status)}</span><span class="small">${esc(when(r.created_at))}</span></div><p><b>من:</b> ${esc(r.pickup)}</p><p><b>إلى:</b> ${esc(r.dropoff)}</p><div class="row" style="gap:8px"><button class="btn light full" data-action="chat" data-id="${r.id}">المحادثة</button>${['searching','accepted'].includes(r.status)?`<button class="btn danger full" data-action="cancel" data-id="${r.id}">إلغاء</button>`:''}</div></div>`).join(''):'<div class="card center muted">لا توجد رحلات بعد</div>';
    app.innerHTML=shell('customer','orders','طلباتي',`<div class="hero">طلباتي</div>${list}`);
    return;
  }

  const {data,error}=await db.from('rides').select('*').eq('customer_id',user.id).order('created_at',{ascending:false}).limit(1);
  if(error){app.innerHTML=shell('customer','home','تكسي يبرود',`<div class="note">${esc(error.message)}</div>`);return}
  const active=data?.[0]&&ACTIVE.includes(data[0].status)?data[0]:null;

  if(active){
    let contact=null;
    if(active.status!=='searching'){try{const r=await db.rpc('ride_contact',{p_ride_id:active.id});contact=r.data?.[0]||null}catch{}}
    const driver=contact?`<div class="row" style="margin:10px 0"><div><b>${esc(contact.full_name||'السائق')}</b><div class="small">الطرف المقبول للرحلة</div></div>${contact.phone?`<a class="btn light" href="tel:${esc(contact.phone)}">اتصال</a>`:''}</div>`:'';
    app.innerHTML=shell('customer','home','رحلتك الحالية',`<div class="hero">رحلتك الحالية</div><div class="card"><span class="pill black">${esc(statusNames[active.status]||active.status)}</span>${driver}<p><b>من:</b> ${esc(active.pickup)}</p><p><b>إلى:</b> ${esc(active.dropoff)}</p><p class="small">طلب #${active.id}</p><button class="btn full" data-action="chat" data-id="${active.id}">المحادثة</button>${['searching','accepted'].includes(active.status)?`<button class="btn danger full" style="margin-top:8px" data-action="cancel" data-id="${active.id}">إلغاء الطلب</button>`:''}</div>${active.status==='searching'?'<p class="small center">نبحث عن أقرب سيارة متاحة…</p>':''}`);
    return;
  }

  const veh=(k,title,sel)=>`<button type="button" class="veh ${sel?'selected':''}" data-action="vehicle" data-value="${k}">${svg(I.car)}<b>${title}</b><span>≈ ${FARES[k].toLocaleString('ar')} ل.س</span></button>`;
  app.innerHTML=shell('customer','home','تكسي يبرود',`<div class="hero">أهلاً ${esc(profile.full_name||'بك')} 👋</div><div class="search-card"><label>مكان الانطلاق<input id="pickup-text" maxlength="200" placeholder="مثال: ساحة يبرود"></label><label>الوجهة<input id="dropoff-text" maxlength="200" placeholder="مثال: سوق يبرود القديم"></label><button class="btn light full" data-action="locate">استخدام موقعي الحالي</button></div><div id="map" class="map"></div><p class="small center">اضغط على الخريطة لتحديد الانطلاق ثم الوجهة، ويمكنك سحب العلامات.</p><section class="sheet-card"><div class="handle"></div><h3>اختر نوع السيارة</h3><div class="vehicles">${veh('economy','سيدان اقتصادية',true)}${veh('comfort','سيارة مريحة',false)}</div><button class="btn big full" data-action="request">اطلب رحلة</button><p class="small center" style="margin:8px 0 0">الأسعار تقديرية وتُتفق مع السائق.</p></section>`);

  let points={pickup:null,dropoff:null};
  mapCtl=createRideMap({onPoint:p=>points=p});
  app.querySelectorAll('[data-action="vehicle"]').forEach(b=>b.addEventListener('click',()=>{app.querySelectorAll('[data-action="vehicle"]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')}));
  app.querySelector('[data-action="locate"]')?.addEventListener('click',()=>navigator.geolocation?.getCurrentPosition(pos=>{points.pickup=[pos.coords.latitude,pos.coords.longitude];mapCtl.setPickup(points.pickup);app.querySelector('#pickup-text').value='موقعي الحالي'},()=>toast('اسمح بتحديد الموقع أو اختره من الخريطة'),{enableHighAccuracy:true,timeout:10000}));
  app.querySelector('[data-action="request"]')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;
    const pickup=app.querySelector('#pickup-text').value.trim(),dropoff=app.querySelector('#dropoff-text').value.trim();
    if(!pickup||!dropoff||!points.pickup||!points.dropoff)return toast('اكتب العنوانين وحدد نقطتي الخريطة');
    btn.disabled=true;
    const {error:err}=await db.rpc('create_ride_broadcast',{p_pickup:pickup,p_dropoff:dropoff,p_pickup_lat:points.pickup[0],p_pickup_lng:points.pickup[1],p_dropoff_lat:points.dropoff[0],p_dropoff_lng:points.dropoff[1],p_vehicle_type:app.querySelector('.veh.selected')?.dataset.value||'economy'});
    if(err){btn.disabled=false;return toast(err.message)}
    toast('تم إرسال الطلب للجهات المتاحة');render();
  });
}

/* ---------- المكتب والسائق ---------- */
export async function renderProvider({app,db,user,profile,tab='stats',render}){
  destroyMap();
  if(!['stats','orders','account'].includes(tab))tab='stats';
  const sub=profile.role==='office'?'مكتب تكسي':'سائق مستقل';
  if(tab==='account')return accountScreen({app,profile,kind:'provider'});

  if(tab==='stats'){
    const {data,error}=await db.from('rides').select('status,created_at').eq('accepted_by',user.id).order('created_at',{ascending:false}).limit(500);
    const rows=data||[];
    const startToday=new Date();startToday.setHours(0,0,0,0);
    const weekAgo=Date.now()-7*864e5;
    const done=rows.filter(r=>r.status==='completed');
    const n={done:done.length,today:done.filter(r=>new Date(r.created_at)>=startToday).length,week:done.filter(r=>new Date(r.created_at).getTime()>=weekAgo).length,cancelled:rows.filter(r=>r.status==='cancelled').length,active:rows.filter(r=>ACTIVE.includes(r.status)).length};
    const num=v=>Number(v).toLocaleString('ar');
    app.innerHTML=shell('provider','stats',sub,`<div class="hero">الإحصائيات</div>${error?`<div class="note">${esc(error.message)}</div>`:''}<div class="avail"><div><span class="dot ${profile.available?'on':''}"></span><b>${profile.available?'متاح لاستقبال الطلبات':'غير متاح حالياً'}</b></div><button class="btn" data-action="availability">${profile.available?'إيقاف':'تفعيل'}</button></div><div class="stats"><div class="stat dark"><b>${num(n.done)}</b><span>رحلات مكتملة</span></div><div class="stat"><b>${num(n.today)}</b><span>رحلات اليوم</span></div><div class="stat"><b>${num(n.week)}</b><span>آخر 7 أيام</span></div><div class="stat"><b>${num(n.active)}</b><span>رحلات جارية</span></div><div class="stat"><b>${num(n.cancelled)}</b><span>ملغاة</span></div></div><p class="small center">الأرقام محسوبة من رحلاتك المقبولة.</p>`);
    return;
  }

  const {data:offers,error}=await db.from('ride_offers').select('ride_id').eq('recipient_id',user.id).eq('state','sent').limit(60);
  let rides=[];
  if(!error&&offers?.length){const q=await db.from('rides').select('*').in('id',offers.map(x=>x.ride_id)).eq('status','searching').order('created_at');rides=q.data||[]}
  const {data:mine}=await db.from('rides').select('*').eq('accepted_by',user.id).order('created_at',{ascending:false}).limit(30);
  const next={accepted:['on_the_way','أنا في الطريق'],on_the_way:['arrived','وصلت'],arrived:['started','بدء الرحلة'],started:['completed','إنهاء الرحلة']};
  const fresh=error?`<div class="note">${esc(error.message)}</div>`:rides.length?rides.map(r=>`<div class="card"><span class="pill black">طلب جديد</span><p><b>من:</b> ${esc(r.pickup)}</p><p><b>إلى:</b> ${esc(r.dropoff)}</p><button class="btn full" data-action="accept" data-id="${r.id}">قبول الرحلة</button></div>`).join(''):'<div class="card center muted">لا توجد طلبات جديدة</div>';
  const mineHtml=(mine||[]).length?mine.map(r=>`<div class="card"><div class="row"><span class="pill ${ACTIVE.includes(r.status)?'black':''}">${esc(statusNames[r.status]||r.status)}</span><span class="small">${esc(when(r.created_at))}</span></div><p>${esc(r.pickup)} ← ${esc(r.dropoff)}</p><button class="btn light full" data-action="chat" data-id="${r.id}">المحادثة</button>${next[r.status]?`<button class="btn full" style="margin-top:8px" data-action="status" data-id="${r.id}" data-value="${next[r.status][0]}">${next[r.status][1]}</button>`:''}</div>`).join(''):'<div class="card center muted">لا توجد رحلات بعد</div>';
  app.innerHTML=shell('provider','orders',sub,`<div class="hero">الطلبات</div><h3>الطلبات الجديدة</h3>${fresh}<h3>رحلاتي</h3>${mineHtml}`);
}

export async function changeRideStatus(db,id,status){const {error}=await db.rpc('update_ride_status',{p_ride_id:Number(id),p_status:status});if(error)throw error}
