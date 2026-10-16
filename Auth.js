import {esc,toast} from './utils.js';

// تحويل الرقم المحلي السوري (09xxxxxxxx) إلى الصيغة الدولية +9639xxxxxxxx
function normalizePhone(raw){
  let p=String(raw||'').replace(/[\s()\-]/g,'');
  if(p.startsWith('00'))p='+'+p.slice(2);
  else if(/^09\d{8}$/.test(p))p='+963'+p.slice(1);
  else if(/^9\d{8}$/.test(p))p='+963'+p;
  else if(/^963\d{9}$/.test(p))p='+'+p;
  return p;
}

async function callFunction(name,body){
  const cfg=window.WEIN_CONFIG||{};
  const res=await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:cfg.SUPABASE_ANON_KEY},
    body:JSON.stringify(body)
  });
  let data={};try{data=await res.json()}catch{}
  if(!res.ok)throw new Error(data.error||'تعذر تنفيذ الطلب.');
  return data;
}

export function renderAuth(app,mode='login',message=''){
  const note=message?`<div class="note">${esc(message)}</div>`:'';
  const tab=(m,label)=>`<button type="button" class="tab ${mode===m?'on':''}" data-action="auth-mode" data-value="${m}">${label}</button>`;
  const tabs=`<div class="tabs">${tab('login','دخول')}${tab('register','حساب جديد')}${tab('activate','مكتب / سائق')}</div>`;
  let form;
  if(mode==='register'){
    form=`<form id="register-form" class="card"><h2>إنشاء حساب زبون</h2><label>الاسم الكامل<input name="full_name" maxlength="100" required autocomplete="name"></label><label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel"></label><label>كلمة المرور (8 أحرف على الأقل)<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><button class="btn full">إنشاء الحساب</button></form>`;
  }else if(mode==='activate'){
    form=`<form id="activate-form" class="card"><h2>تفعيل حساب مكتب أو سائق</h2><p class="small">لهذا الخيار رمز تفعيل تحصل عليه من الإدارة.</p><label>الاسم الكامل<input name="full_name" maxlength="100" required autocomplete="name"></label><label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel"></label><label>رمز التفعيل<input name="activation_code" maxlength="80" required autocomplete="off"></label><label>كلمة المرور الجديدة (8 أحرف على الأقل)<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><button class="btn full">تفعيل الحساب</button></form>`;
  }else{
    form=`<form id="login-form" class="card"><h2>تسجيل الدخول</h2><label>رقم الهاتف<input name="phone" type="tel" inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel"></label><label>كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label><button class="btn full">دخول</button></form>`;
  }
  app.innerHTML=`<main class="auth"><div class="brand">وين؟</div><p class="muted center">حجز التكسي في يبرود</p>${note}${tabs}${form}</main>`;

  // معالجة التسجيل هنا حتى لا نحتاج تعديل app.js
  const reg=app.querySelector('#register-form');
  if(reg)reg.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=reg.querySelector('button.btn');btn.disabled=true;
    try{
      await callFunction('register-customer',{
        phone:normalizePhone(reg.elements.phone.value),
        password:reg.elements.password.value,
        full_name:reg.elements.full_name.value.trim()
      });
      renderAuth(app,'login','تم إنشاء حسابك. سجّل الدخول برقم الهاتف وكلمة المرور.');
    }catch(x){toast(x.message||'حدث خطأ');btn.disabled=false}
  });
}

export async function login(db,form){
  const phone=normalizePhone(form.elements.phone.value);
  const password=form.elements.password.value;
  const {error}=await db.auth.signInWithPassword({phone,password});
  if(error)throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة.');
}

export async function activate(db,form){
  return callFunction('activate-account',{
    phone:normalizePhone(form.elements.phone.value),
    activation_code:form.elements.activation_code.value.trim(),
    full_name:form.elements.full_name.value.trim(),
    password:form.elements.password.value
  });
}
  
