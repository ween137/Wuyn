import {esc} from './utils.js';

// تحويل الرقم المحلي السوري (09xxxxxxxx) إلى الصيغة الدولية +9639xxxxxxxx
function normalizePhone(raw){
  let p=String(raw||'').replace(/[\s()\-]/g,'');
  if(p.startsWith('00'))p='+'+p.slice(2);
  else if(/^09\d{8}$/.test(p))p='+963'+p.slice(1);
  else if(/^9\d{8}$/.test(p))p='+963'+p;
  else if(/^963\d{9}$/.test(p))p='+'+p;
  return p;
}

export function renderAuth(app,mode='login',message=''){
  const note=message?`<div class="note">${esc(message)}</div>`:'';
  const tabs=`<div class="tabs"><button type="button" class="tab ${mode==='login'?'on':''}" data-action="auth-mode" data-value="login">دخول</button><button type="button" class="tab ${mode==='activate'?'on':''}" data-action="auth-mode" data-value="activate">تفعيل حساب</button></div>`;
  const form=mode==='activate'
    ?`<form id="activate-form" class="card"><h2>تفعيل حساب جديد</h2><label>الاسم الكامل<input name="full_name" maxlength="100" required autocomplete="name"></label><label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel"></label><label>رمز التفعيل<input name="activation_code" maxlength="80" required autocomplete="off"></label><label>كلمة المرور الجديدة (8 أحرف على الأقل)<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><button class="btn full">تفعيل الحساب</button></form>`
    :`<form id="login-form" class="card"><h2>تسجيل الدخول</h2><label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel"></label><label>كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label><button class="btn full">دخول</button></form>`;
  app.innerHTML=`<main class="auth"><div class="brand">وين؟</div><p class="muted center">حجز التكسي في يبرود</p>${note}${tabs}${form}</main>`;
}

export async function login(db,form){
  const phone=normalizePhone(form.elements.phone.value);
  const password=form.elements.password.value;
  const {error}=await db.auth.signInWithPassword({phone,password});
  if(error)throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة.');
}

export async function activate(db,form){
  const cfg=window.WEIN_CONFIG||{};
  const body={
    phone:normalizePhone(form.elements.phone.value),
    activation_code:form.elements.activation_code.value.trim(),
    full_name:form.elements.full_name.value.trim(),
    password:form.elements.password.value
  };
  const res=await fetch(`${cfg.SUPABASE_URL}/functions/v1/activate-account`,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:cfg.SUPABASE_ANON_KEY},
    body:JSON.stringify(body)
  });
  let data={};try{data=await res.json()}catch{}
  if(!res.ok)throw new Error(data.error||'تعذر تفعيل الحساب.');
  return data;
}
