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
  activate: `<h2>تفعيل مكتب أو سائق</h2><p class="sub">رمز التفعيل تحصل عليه من الإدارة</p>
    ${field('full_name', 'الاسم', 'text', 'maxlength="100" required autocomplete="name"')}
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    ${field('activation_code', 'رمز التفعيل', 'text', 'maxlength="80" required autocomplete="off" inputmode="numeric" dir="ltr"')}
    ${pass('password', 'كلمة مرور جديدة (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}
    <button class="btn full big" data-submit>تفعيل ودخول</button>`,
};

// يرسم شاشة الدخول. onDone() تُستدعى بعد نجاح تسجيل الدخول (الجلسة جاهزة).
export function mountAuth(app, { db, mode = 'login', message = '', onDone }) {
  const tab = (m, l) => `<button type="button" class="seg ${mode === m ? 'on' : ''}" data-mode="${m}">${l}</button>`;
  app.innerHTML = `<div class="auth-wrap">
    <div class="auth-hero"><div class="auth-logo">وين؟</div><p>تكسي يبرود في جيبك</p></div>
    <div class="auth-card">
      <div class="segs">${tab('login', 'دخول')}${tab('register', 'حساب جديد')}${tab('activate', 'مكتب / سائق')}</div>
      <div id="auth-msg" class="auth-msg ${message ? 'show' : ''}" role="alert">${esc(message)}</div>
      <form id="auth-form" novalidate>${FORMS[mode]}</form>
    </div></div>`;
  const form = app.querySelector('#auth-form'), msg = app.querySelector('#auth-msg');
  const show = (t, ok) => { msg.textContent = t; msg.className = 'auth-msg show' + (ok ? ' ok' : ''); };

  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => mountAuth(app, { db, mode: b.dataset.mode, onDone }));
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
      const phone = normalizePhone(f.phone.value), password = f.password.value;
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح. اكتبه هكذا: 09xxxxxxxx');
      if (mode === 'register') await callFunction('register-customer', { phone, password, full_name: f.full_name.value.trim() });
      if (mode === 'activate') await callFunction('activate-account', { phone, password, full_name: f.full_name.value.trim(), activation_code: latin(f.activation_code.value).trim() });
      const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'رقم الهاتف أو كلمة المرور غير صحيحة.' : errMsg(error));
      onDone?.();
    } catch (x) { show(errMsg(x)); btn.disabled = false; btn.textContent = label; }
  });
}
