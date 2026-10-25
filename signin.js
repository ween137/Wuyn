import { esc, latin, errMsg } from './utils.js';
import { ic } from './icons.js';

export function normalizePhone(raw) {
  let p = latin(raw).replace(/[\s()\-.]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (/^09\d{8}$/.test(p)) p = '+963' + p.slice(1);
  else if (/^9\d{8}$/.test(p)) p = '+963' + p;
  else if (/^963\d{9}$/.test(p)) p = '+' + p;
  return p;
}
const phoneToEmail = phone => phone.replace(/\D/g, '') + '@wein.invalid';

async function callFunction(name, body) {
  const cfg = window.WEIN_CONFIG || {};
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || 'تعذر تنفيذ الطلب.');
    return data;
  } catch (e) { if (e.name === 'AbortError') throw new Error('الاتصال بطيء. حاول مرة أخرى.'); throw e; }
  finally { clearTimeout(t); }
}

const field = (name, label, type, extra = '') => `<label class="fld"><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
const pass = (name, label, auto, min = '') => `<label class="fld"><span>${label}</span><div class="pw"><input name="${name}" type="password" ${min} maxlength="128" required autocomplete="${auto}"><button type="button" class="eye" data-eye aria-label="إظهار كلمة المرور">${ic('eye', 20)}</button></div></label>`;

const FORMS = {
  login: `<h2>أهلاً بعودتك</h2><p class="sub">سجّل دخولك برقم هاتفك</p>
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    ${pass('password', 'كلمة المرور', 'current-password')}
    <button class="btn full big" data-submit>دخول</button>`,
  register: `<h2>حساب زبون جديد</h2><p class="sub">دقيقة واحدة وتبدأ</p>
    ${field('full_name', 'الاسم الكامل', 'text', 'maxlength="100" required autocomplete="name"')}
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    ${pass('password', 'كلمة المرور (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}
    <button class="btn full big" data-submit>إنشاء الحساب</button>`,
  activate: `<h2>تفعيل مكتب أو سائق أو متور</h2><p class="sub">رمز التفعيل ترسله لك الإدارة بعد طلبك</p>
    ${field('full_name', 'الاسم', 'text', 'maxlength="100" required autocomplete="name"')}
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    ${field('activation_code', 'رمز التفعيل', 'text', 'maxlength="80" required autocomplete="off" inputmode="numeric" dir="ltr"')}
    ${pass('password', 'كلمة مرور جديدة (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}
    <button class="btn full big" data-submit>تفعيل ودخول</button>
    <button type="button" class="link" data-mode="request">ليس لديك رمز؟ اطلب رمز التفعيل</button>`,
  request: `<h2>اطلب رمز التفعيل</h2><p class="sub">اكتب بياناتك وسنرسل لك الرمز على رقمك</p>
    ${field('full_name', 'الاسم (أو اسم المكتب)', 'text', 'maxlength="100" required autocomplete="name"')}
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    <div class="fld"><span>أريد التسجيل كـ</span><div class="kinds"><label><input type="radio" name="wanted" value="driver" checked><b>سائق سيارة</b></label><label><input type="radio" name="wanted" value="motor"><b>متور توصيل</b></label><label><input type="radio" name="wanted" value="office"><b>مكتب تكسي</b></label></div></div>
    ${field('note', 'ملاحظة (اختياري): نوع السيارة أو المنطقة', 'text', 'maxlength="200"')}
    <button class="btn full big" data-submit>إرسال الطلب</button>
    <button type="button" class="link" data-mode="activate">لدي رمز التفعيل</button>`,
};

// يرسم شاشة الدخول. onDone() تُستدعى بعد نجاح تسجيل الدخول (الجلسة جاهزة).
export function mountAuth(app, { db, mode = 'login', message = '', onDone, onGuest }) {
  const tab = (m, l) => `<button type="button" class="seg ${mode === m || (m === 'activate' && mode === 'request') ? 'on' : ''}" data-mode="${m}">${l}</button>`;
  app.innerHTML = `<div class="auth-wrap">
    <div class="auth-hero"><div class="auth-logo">وين؟</div><p>تكسي يبرود في جيبك</p></div>
    <div class="auth-card">
      <div class="segs">${tab('login', 'دخول')}${tab('register', 'حساب جديد')}$${tab('activate', 'مكتب / سائق / متور')}</div>
      <div id="auth-msg" class="auth-msg ${message ? 'show' : ''}" role="alert">${esc(message)}</div>
      <form id="auth-form" novalidate>${FORMS[mode]}</form>
      ${onGuest ? `<div class="or"><span>أو</span></div><button type="button" class="btn light full" id="guest-btn">${ic('eye', 20)} تصفّح كضيف</button><p class="small center">الضيف يتصفح الخريطة فقط ولا يستطيع طلب رحلة.</p>` : ''}
    </div></div>`;
  const form = app.querySelector('#auth-form'), msg = app.querySelector('#auth-msg');
  const show = (t, ok) => { msg.textContent = t; msg.className = 'auth-msg show' + (ok ? ' ok' : ''); };

  app.querySelector('#guest-btn')?.addEventListener('click', () => onGuest());
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => mountAuth(app, { db, mode: b.dataset.mode, onDone, onGuest }));
  form.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => {
    const i = b.previousElementSibling, h = i.type === 'password'; i.type = h ? 'text' : 'password';
    b.innerHTML = ic(h ? 'eyeoff' : 'eye', 20);
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('[data-submit]'); const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'لحظة…'; msg.className = 'auth-msg';
    const f = form.elements;
    try {
      const phone = normalizePhone(f.phone.value);
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح. اكتبه هكذا: 09xxxxxxxx');
      if (mode === 'request') {
        const { data, error } = await db.rpc('request_activation', { p_phone: phone, p_name: f.full_name.value.trim(), p_wanted: f.wanted.value, p_note: f.note.value.trim() || null });
        if (error) throw error;
        if (data === 'exists') throw new Error('هذا الرقم مسجّل مسبقاً. سجّل الدخول من تبويب «دخول».');
        form.innerHTML = `<div class="sent">${ic('check', 40)}<h3>وصل طلبك</h3><p>ستتواصل معك الإدارة على الرقم <b dir="ltr">${esc(phone)}</b> وترسل لك رمز التفعيل. بعدها اضغط «لدي رمز التفعيل» وأدخله.</p><button type="button" class="btn full" data-mode="activate">لدي رمز التفعيل</button></div>`;
        form.querySelector('[data-mode]').onclick = () => mountAuth(app, { db, mode: 'activate', onDone, onGuest });
        return;
      }
      const password = f.password.value;
      if (mode === 'register') await callFunction('register-customer', { phone, password, full_name: f.full_name.value.trim() });
      if (mode === 'activate') await callFunction('activate-account', { phone, password, full_name: f.full_name.value.trim(), activation_code: latin(f.activation_code.value).trim() });
      const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'رقم الهاتف أو كلمة المرور غير صحيحة.' : errMsg(error));
      onDone?.();
    } catch (x) { show(errMsg(x)); btn.disabled = false; btn.textContent = label; }
  });
}
