// شاشات الدخول والتسجيل والتحقق (ملف مستقل بأيقوناته وتنسيقه)
import { esc, latin, errMsg } from './utils.js';
try { if (!document.getElementById('login-css')) { const l = document.createElement('link'); l.id = 'login-css'; l.rel = 'stylesheet'; l.href = '/login.css'; document.head.appendChild(l); } } catch { }
const ICONS = {
  arrowl: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  bag: '<rect x="5" y="8" width="14" height="13" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  car: '<path d="M4 15v-3l1.6-4.2A2 2 0 0 1 7.5 6.5h9a2 2 0 0 1 1.9 1.3L20 12v3"/><path d="M3 15h18v3.2a.8.8 0 0 1-.8.8H19v-1.2H5V19H3.8a.8.8 0 0 1-.8-.8z"/><path d="M5.5 11.2h13"/><circle cx="7.3" cy="14.2" r=".7"/><circle cx="16.7" cy="14.2" r=".7"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10 6a9 9 0 0 1 12 6 14 14 0 0 1-3 3.5M6 7.5A14 14 0 0 0 2 12s4 7 10 7a9 9 0 0 0 4-1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  motor: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17H13l2.6-6.2h2.4"/><path d="M15.6 10.8 14.6 8H12"/><path d="M6.2 12.2h3.2l2 4.8"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M12 3.5c-4.7 0-8.5 3.3-8.5 7.4 0 2.2 1.1 4.2 2.9 5.5L5.8 20.5l3.7-1.9c.8.2 1.6.3 2.5.3 4.7 0 8.5-3.3 8.5-7.4S16.7 3.5 12 3.5z"/><path d="M8.5 11h7M8.5 14h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5 12 13l8.5-5.5"/>',
};
const ic = (name, size = 20, cls = '') => `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export function normalizePhone(raw) {
  let p = latin(raw).replace(/[\s()\-.]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (/^09\d{8}$/.test(p)) p = '+963' + p.slice(1);
  else if (/^9\d{8}$/.test(p)) p = '+963' + p;
  else if (/^963\d{9}$/.test(p)) p = '+' + p;
  return p;
}
const phoneToEmail = phone => phone.replace(/\D/g, '') + '@wein.invalid';

async function callFunction(name, body, token) {
  const cfg = window.WEIN_CONFIG || {};
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
    });
    let data = {}; try { data = await res.json(); } catch { }
    if (!res.ok) { const e = new Error(data.error || 'تعذر تنفيذ الطلب.'); e.status = res.status; throw e; }
    return data;
  } catch (e) { if (e.name === 'AbortError') throw new Error('الاتصال بطيء. حاول مرة أخرى.'); throw e; }
  finally { clearTimeout(t); }
}

/* ---------- عناصر النموذج بأيقونات ---------- */
const field = (name, label, type, extra = '', icon = '') => `<label class="fld"><span>${label}</span><div class="inp">${icon ? ic(icon, 20, 'lead') : ''}<input name="${name}" type="${type}" ${extra}></div></label>`;
const pass = (name, label, auto, min = '') => `<label class="fld"><span>${label}</span><div class="inp">${ic('lock', 20, 'lead')}<input name="${name}" type="password" ${min} maxlength="128" required autocomplete="${auto}"><button type="button" class="eye" data-eye aria-label="إظهار كلمة المرور">${ic('eye', 20)}</button></div></label>`;
const PHONE_X = 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"';
const brand = (sub = 'تكسي يبرود في جيبك') => `<div class="auth-hero"><div class="bgrid"></div><div class="appmark">${ic('car', 40)}</div><div class="auth-logo">وين؟</div><p>${sub}</p><div class="road"><i class="carrun">${ic('car', 18)}</i></div></div>`;

const FORMS = {
  login: `<h2>أهلاً بعودتك 👋</h2><p class="sub">سجّل دخولك برقم هاتفك أو بريدك الإلكتروني</p>
    ${field('phone', 'رقم الهاتف أو البريد', 'text', 'placeholder="09xxxxxxxx أو name@mail.com" required autocomplete="username" dir="ltr" autocapitalize="off"', 'phone')}
    ${pass('password', 'كلمة المرور', 'current-password')}
    <button class="btn full big" data-submit>دخول ${ic('arrowl', 20)}</button>
    <button type="button" class="link" data-mode="forgot">نسيت كلمة المرور؟</button>`,
  register: `<h2>حساب جديد ✨</h2><p class="sub">دقيقة واحدة وتبدأ رحلتك</p>
    ${field('full_name', 'الاسم الكامل', 'text', 'maxlength="100" required autocomplete="name"', 'user')}
    ${field('phone', 'رقم الهاتف', 'tel', PHONE_X, 'phone')}
    ${field('email', 'البريد الإلكتروني (اختياري)', 'email', 'maxlength="254" autocomplete="email" dir="ltr" placeholder="name@mail.com" autocapitalize="off"', 'mail')}
    ${pass('password', 'كلمة المرور (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}
    <p class="small center tgnote">${ic('send', 14)} سنتحقق من رقمك برمز يصلك على تلغرام</p>
    <button class="btn full big" data-submit>متابعة ${ic('arrowl', 20)}</button>`,
  forgot: `<h2>استعادة كلمة المرور</h2><p class="sub">سنرسل رمزاً إلى تلغرام على رقم حسابك</p>
    ${field('phone', 'رقم الهاتف', 'tel', PHONE_X, 'phone')}
    <button class="btn full big" data-submit>إرسال الرمز عبر تلغرام ${ic('send', 18)}</button>`,
  activate: `<h2>تفعيل مكتب أو سائق أو متور</h2><p class="sub">رمز التفعيل ترسله لك الإدارة بعد طلبك</p>
    ${field('full_name', 'الاسم', 'text', 'maxlength="100" required autocomplete="name"', 'user')}
    ${field('phone', 'رقم الهاتف', 'tel', PHONE_X, 'phone')}
    ${field('activation_code', 'رمز التفعيل', 'text', 'maxlength="80" required autocomplete="off" inputmode="numeric" dir="ltr"', 'key')}
    ${pass('password', 'كلمة مرور جديدة (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}
    <button class="btn full big" data-submit>تفعيل ودخول ${ic('arrowl', 20)}</button>
    <button type="button" class="link" data-mode="request">ليس لديك رمز؟ اطلب رمز التفعيل</button>`,
  request: `<h2>اطلب رمز التفعيل</h2><p class="sub">اكتب بياناتك وسنرسل لك الرمز على رقمك</p>
    ${field('full_name', 'الاسم (أو اسم المكتب)', 'text', 'maxlength="100" required autocomplete="name"', 'user')}
    ${field('phone', 'رقم الهاتف', 'tel', PHONE_X, 'phone')}
    <div class="fld"><span>أريد التسجيل كـ</span><div class="kinds"><label><input type="radio" name="wanted" value="driver" checked><b>${ic('car', 18)} سائق سيارة</b></label><label><input type="radio" name="wanted" value="motor"><b>${ic('motor', 18)} متور توصيل</b></label><label><input type="radio" name="wanted" value="office"><b>${ic('bag', 18)} مكتب تكسي</b></label></div></div>
    ${field('note', 'ملاحظة (اختياري): نوع السيارة أو المنطقة', 'text', 'maxlength="200"', 'chat')}
    <button class="btn full big" data-submit>إرسال الطلب ${ic('send', 18)}</button>
    <button type="button" class="link" data-mode="activate">لدي رمز التفعيل</button>`,
};

// يرسم شاشة الدخول. onDone() تُستدعى بعد نجاح تسجيل الدخول (الجلسة جاهزة).
export function mountAuth(app, { db, mode = 'login', message = '', onDone, onGuest }) {
  const main = mode === 'login' || mode === 'register';
  const tab = (m, l, i) => `<button type="button" class="seg ${mode === m ? 'on' : ''}" data-mode="${m}">${ic(i, 18)} ${l}</button>`;
  app.innerHTML = `<div class="auth-wrap">${brand()}
    <div class="auth-card">
      ${main ? `<div class="segs">${tab('login', 'دخول', 'user')}${tab('register', 'حساب جديد', 'plus')}</div>` : `<button type="button" class="backrow" data-mode="login">${ic('back', 18, 'flip')} رجوع</button>`}
      <div id="auth-msg" class="auth-msg ${message ? 'show' : ''}" role="alert">${esc(message)}</div>
      <form id="auth-form" novalidate>${FORMS[mode]}</form>
      ${main ? '<div id="gslot"></div>' : ''}
      ${main ? `<button type="button" class="procard" data-mode="activate"><span class="pi">${ic('motor', 24)}</span><span class="grow"><b>مكتب تكسي أو سائق أو متور؟</b><small>فعّل حسابك برمز التفعيل</small></span>${ic('back', 18, 'chev')}</button>` : ''}
      ${onGuest && main ? `<button type="button" class="guestlink" id="guest-btn">${ic('eye', 18)} تصفّح كضيف بدون حساب</button>` : ''}
    </div></div>`;
  const form = app.querySelector('#auth-form'), msg = app.querySelector('#auth-msg');
  const show = (t, ok) => { msg.textContent = t; msg.className = 'auth-msg show' + (ok ? ' ok' : ''); };

  app.querySelector('#guest-btn')?.addEventListener('click', () => onGuest());
  const gs = app.querySelector('#gslot');
  if (gs) googleEnabled().then(on => {
    if (!on || !gs.isConnected) return;
    gs.innerHTML = `<div class="or"><span>أو</span></div><button type="button" class="btn light full gbtn" id="gbtn">${GOOGLE_SVG} المتابعة عبر Google</button>`;
    gs.querySelector('#gbtn').onclick = async () => { const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } }); if (error) show(errMsg(error)); };
  });
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => mountAuth(app, { db, mode: b.dataset.mode, onDone, onGuest }));
  form.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => {
    const i = b.parentElement.querySelector('input'), h = i.type === 'password'; i.type = h ? 'text' : 'password';
    b.innerHTML = ic(h ? 'eyeoff' : 'eye', 20);
  });
  if (mode === 'login') { // الأيقونة تتغير بين الهاتف والبريد أثناء الكتابة
    const i = form.elements.phone, lead = i.parentElement.querySelector('.lead'); let em = false;
    i.addEventListener('input', () => { const n = i.value.includes('@'); if (n !== em) { em = n; lead.outerHTML = ic(n ? 'mail' : 'phone', 20, 'lead'); } });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('[data-submit]'); const label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'لحظة…'; msg.className = 'auth-msg';
    const f = form.elements;
    try {
      const raw = f.phone.value.trim();
      if (mode === 'login' && raw.includes('@')) {
        const s = await callFunction('email-login', { email: raw, password: f.password.value });
        const { error } = await db.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token }); if (error) throw error;
        onDone?.(); return;
      }
      const phone = normalizePhone(raw);
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح. اكتبه هكذا: 09xxxxxxxx');
      if (mode === 'register' || mode === 'forgot') {
        const email = mode === 'register' ? (f.email.value || '').trim().toLowerCase() : '';
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('البريد الإلكتروني غير صحيح.');
        const goto = m => mountAuth(app, { db, mode: m, onDone, onGuest });
        const base = { phone, onBack: () => goto(mode), onLogin: () => goto('login'), onForgot: () => goto('forgot') };
        if (mode === 'forgot') return mountVerify(app, { ...base, purpose: 'reset', onVerified: () => mountNewPass(app, { db, phone, onDone }) });
        const name = f.full_name.value.trim(), pw = f.password.value;
        return mountVerify(app, { ...base, purpose: 'register', onVerified: async () => {
          await callFunction('register-customer', { phone, password: pw, full_name: name, email: email || undefined });
          const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password: pw }); if (error) throw error; onDone?.(); } });
      }
      if (mode === 'request') {
        const { data, error } = await db.rpc('request_activation', { p_phone: phone, p_name: f.full_name.value.trim(), p_wanted: f.wanted.value, p_note: f.note.value.trim() || null });
        if (error) throw error;
        if (data === 'exists') throw new Error('هذا الرقم مسجّل مسبقاً. سجّل الدخول من تبويب «دخول».');
        form.innerHTML = `<div class="sent">${ic('check', 40)}<h3>وصل طلبك</h3><p>ستتواصل معك الإدارة على الرقم <b dir="ltr">${esc(phone)}</b> وترسل لك رمز التفعيل. بعدها اضغط «لدي رمز التفعيل» وأدخله.</p><button type="button" class="btn full" data-mode="activate">لدي رمز التفعيل</button></div>`;
        form.querySelector('[data-mode]').onclick = () => mountAuth(app, { db, mode: 'activate', onDone, onGuest });
        return;
      }
      const password = f.password.value;
      if (mode === 'activate') await callFunction('activate-account', { phone, password, full_name: f.full_name.value.trim(), activation_code: latin(f.activation_code.value).trim() });
      const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'رقم الهاتف أو كلمة المرور غير صحيحة.' : errMsg(error));
      onDone?.();
    } catch (x) { show(errMsg(x)); btn.disabled = false; btn.innerHTML = label; }
  });
}

const GOOGLE_SVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
let gOn;
// زر Google يظهر فقط بعد أن يفعّله صاحب المشروع في Supabase
async function googleEnabled() {
  if (gOn !== undefined) return gOn;
  try { const c = window.WEIN_CONFIG || {}; const r = await fetch(`${c.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: c.SUPABASE_ANON_KEY } }); gOn = !!(await r.json())?.external?.google; } catch { gOn = false; }
  return gOn;
}

/* ---------- شاشة التحقق عبر تلغرام ---------- */
export function mountVerify(app, { phone, purpose = 'register', onVerified, onBack, onLogin, onForgot }) {
  let sent = false, link = 'https://t.me/Wuynbot', cool = 0, poll = null, cdT = null;
  app.innerHTML = `<div class="auth-wrap">${brand('التحقق من رقمك')}
    <div class="auth-card vcard"><button type="button" class="backrow" id="vback">${ic('back', 18, 'flip')} تغيير الرقم</button>
    <div class="tgring"><div class="tgbox">${ic('send', 34)}</div></div>
    <h2 class="ctr">التحقق عبر تلغرام</h2>
    <p class="sub ctr" id="vsub">جارٍ تجهيز الرمز…</p>
    <div id="auth-msg" class="auth-msg" role="alert"></div>
    <div id="vsteps" class="vsteps"></div>
    <a class="btn full big tgbtn" id="tgopen" target="_blank" rel="noopener" href="${link}">${ic('send', 20)} فتح تلغرام</a>
    <form id="vf" novalidate><input class="otp" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" dir="ltr" aria-label="رمز التحقق">
      <button class="btn full big" data-submit>تأكيد الرمز</button></form>
    <div id="vact" class="vact"></div>
    <button type="button" class="link" id="resend">إعادة إرسال الرمز</button></div></div>`;
  const $ = s => app.querySelector(s), msg = $('#auth-msg'), sub = $('#vsub'), form = $('#vf'), rs = $('#resend'), op = $('#tgopen'), steps = $('#vsteps'), act = $('#vact');
  const show = t => { msg.textContent = t; msg.className = 'auth-msg show'; };
  const alive = () => app.contains(form);
  const onVis = () => { if (!document.hidden) check(); };
  const stop = () => { clearInterval(poll); clearInterval(cdT); document.removeEventListener('visibilitychange', onVis); };
  const mode = m => { app.querySelector('.vcard').dataset.m = m; }; // wait | sent | error
  const check = async () => { if (!alive()) return stop(); if (sent) return; try { const r = await callFunction('tg-verify', { action: 'status', phone, purpose }); if (r.sent) gotCode(); } catch { } };
  const gotCode = () => {
    sent = true; clearInterval(poll); mode('sent'); sub.innerHTML = 'وصلك الرمز على تلغرام ✅<br>اكتب الرمز المكوّن من 6 أرقام (صالح 5 دقائق)';
    try { navigator.vibrate?.(80); } catch { } form.elements.code.focus();
  };
  const startCool = () => { cool = 30; rs.disabled = true; rs.textContent = 'إعادة الإرسال بعد 30 ث'; clearInterval(cdT); cdT = setInterval(() => { cool--; rs.textContent = cool > 0 ? `إعادة الإرسال بعد ${cool} ث` : 'إعادة إرسال الرمز'; rs.disabled = cool > 0; if (cool <= 0) clearInterval(cdT); }, 1000); };
  const fail = e => {
    mode('error'); sub.textContent = '';
    if (e.status === 409 && purpose === 'register') {
      show('هذا الرقم لديه حساب مسبقاً.');
      act.innerHTML = `<button type="button" class="btn full" id="alog">${ic('user', 18)} تسجيل الدخول</button><button type="button" class="btn light full" id="afor">${ic('key', 18)} نسيت كلمة المرور</button>`;
      $('#alog').onclick = () => { stop(); onLogin?.(); }; $('#afor').onclick = () => { stop(); onForgot?.(); };
    } else if (e.status === 404 && purpose === 'reset') {
      show('لا يوجد حساب بهذا الرقم.'); act.innerHTML = `<button type="button" class="btn full" id="aback">${ic('back', 18, 'flip')} تغيير الرقم</button>`; $('#aback').onclick = () => { stop(); onBack?.(); };
    } else { show(errMsg(e)); act.innerHTML = ''; }
  };
  async function begin() {
    sent = false; msg.className = 'auth-msg'; act.innerHTML = ''; mode('wait'); sub.textContent = 'جارٍ تجهيز الرمز…'; startCool();
    try {
      const r = await callFunction('tg-verify', { action: 'start', phone, purpose });
      link = r.open || link; op.href = link;
      let opened = null; try { opened = window.open(link, '_blank'); } catch { }
      if (r.sent) { gotCode(); sub.innerHTML = `أرسلنا الرمز إلى تلغرام على الرقم <b dir="ltr">${esc(phone)}</b> ✅<br>افتح تلغرام وانسخ الرمز ثم اكتبه هنا.`; }
      else {
        sub.innerHTML = opened ? 'نقلناك إلى تلغرام. نفّذ الخطوات ثم ارجع إلى هنا:' : 'اضغط الزر الأزرق لفتح تلغرام، ثم نفّذ الخطوات:';
        steps.innerHTML = `<ol><li>اضغط <b>Start</b> في البوت</li><li>اضغط زر <b>«📱 شارك رقمي للتحقق»</b></li><li>سيصلك الرمز فوراً، ارجع واكتبه هنا</li></ol>`;
        if (!opened) op.classList.add('pulse');
        clearInterval(poll); poll = setInterval(check, 2500);
      }
    } catch (e) { fail(e); }
  }
  document.addEventListener('visibilitychange', onVis);
  $('#vback').onclick = () => { stop(); onBack?.(); };
  rs.onclick = () => begin();
  form.addEventListener('submit', async e => {
    e.preventDefault(); const btn = form.querySelector('[data-submit]'), code = (form.elements.code.value || '').replace(/\D/g, '');
    if (code.length !== 6) return show('اكتب الرمز المكوّن من 6 أرقام.');
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'لحظة…'; msg.className = 'auth-msg';
    try { await callFunction('tg-verify', { action: 'check', phone, purpose, code }); stop(); await onVerified?.(); }
    catch (x) { show(errMsg(x)); btn.disabled = false; btn.textContent = label; }
  });
  begin();
}

function mountNewPass(app, { db, phone, onDone }) {
  app.innerHTML = `<div class="auth-wrap">${brand('كلمة مرور جديدة')}<div class="auth-card"><h2>اختر كلمة مرور جديدة</h2><p class="sub">تم التحقق من رقمك ✅</p>
    <div id="auth-msg" class="auth-msg" role="alert"></div><form id="npf" novalidate>${pass('password', 'كلمة المرور الجديدة (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}<button class="btn full big" data-submit>حفظ ودخول ${ic('arrowl', 20)}</button></form></div></div>`;
  const form = app.querySelector('#npf'), msg = app.querySelector('#auth-msg');
  form.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = b.parentElement.querySelector('input'), h = i.type === 'password'; i.type = h ? 'text' : 'password'; b.innerHTML = ic(h ? 'eyeoff' : 'eye', 20); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!form.reportValidity()) return; const btn = form.querySelector('[data-submit]'); btn.disabled = true; msg.className = 'auth-msg';
    try { const pw = form.elements.password.value; await callFunction('reset-password', { phone, password: pw }); const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password: pw }); if (error) throw error; onDone?.(); }
    catch (x) { msg.textContent = errMsg(x); msg.className = 'auth-msg show'; btn.disabled = false; }
  });
}

// حساب Google جديد: اسم + رقم هاتف موثّق بتلغرام
export function mountComplete(app, { db, user, logout, onDone }) {
  const nm = user.user_metadata?.full_name || user.user_metadata?.name || '';
  app.innerHTML = `<div class="auth-wrap">${brand('مرحباً بك')}<div class="auth-card"><h2>أكمل حسابك</h2><p class="sub">مرة واحدة فقط: اكتب رقم هاتفك ونتحقق منه عبر تلغرام</p>
    <div id="auth-msg" class="auth-msg" role="alert"></div><form id="cf2" novalidate>${field('full_name', 'الاسم الكامل', 'text', `maxlength="100" required autocomplete="name" value="${esc(nm)}"`, 'user')}
    ${field('phone', 'رقم الهاتف', 'tel', PHONE_X, 'phone')}
    <p class="small center tgnote">${ic('send', 14)} سيصلك رمز التحقق على تلغرام</p><button class="btn full big" data-submit>متابعة ${ic('arrowl', 20)}</button></form>
    <button type="button" class="link" id="lo2">تسجيل الخروج</button></div></div>`;
  const form = app.querySelector('#cf2'), msg = app.querySelector('#auth-msg');
  app.querySelector('#lo2').onclick = () => logout?.();
  form.addEventListener('submit', e => {
    e.preventDefault(); if (!form.reportValidity()) return;
    const phone = normalizePhone(form.elements.phone.value), name = form.elements.full_name.value.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { msg.textContent = 'رقم الهاتف غير صحيح. اكتبه هكذا: 09xxxxxxxx'; msg.className = 'auth-msg show'; return; }
    const back = () => mountComplete(app, { db, user, logout, onDone });
    mountVerify(app, { phone, purpose: 'register', onBack: back, onLogin: back, onForgot: back, onVerified: async () => {
      const { data } = await db.auth.getSession();
      await callFunction('complete-profile', { phone, full_name: name }, data?.session?.access_token);
      onDone?.();
    } });
  });
}
