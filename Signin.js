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

async function callFunction(name, body, token) {
  const cfg = window.WEIN_CONFIG || {};
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
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
  login: `<h2>أهلاً بعودتك</h2><p class="sub">سجّل دخولك برقم هاتفك أو بريدك الإلكتروني</p>
    ${field('phone', 'رقم الهاتف أو البريد الإلكتروني', 'text', 'placeholder="09xxxxxxxx أو name@mail.com" required autocomplete="username" dir="ltr" autocapitalize="off"')}
    ${pass('password', 'كلمة المرور', 'current-password')}
    <button class="btn full big" data-submit>دخول</button>
    <button type="button" class="link" data-mode="forgot">نسيت كلمة المرور؟</button>`,
  forgot: `<h2>استعادة كلمة المرور</h2><p class="sub">سنرسل رمزاً إلى تلغرام على رقم حسابك</p>
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    <button class="btn full big" data-submit>إرسال الرمز عبر تلغرام</button>
    <button type="button" class="link" data-mode="login">رجوع لتسجيل الدخول</button>`,
  register: `<h2>حساب زبون جديد</h2><p class="sub">دقيقة واحدة وتبدأ</p>
    ${field('full_name', 'الاسم الكامل', 'text', 'maxlength="100" required autocomplete="name"')}
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    ${field('email', 'البريد الإلكتروني (اختياري)', 'email', 'maxlength="254" autocomplete="email" dir="ltr" placeholder="name@mail.com" autocapitalize="off"')}
    ${pass('password', 'كلمة المرور (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}
    <p class="small center tgnote">${ic('send', 14)} سنتحقق من رقمك برمز يصلك على تلغرام</p>
    <button class="btn full big" data-submit>متابعة</button>`,
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
      <div class="segs">${tab('login', 'دخول')}${tab('register', 'حساب جديد')}${tab('activate', 'مكتب / سائق / متور')}</div>
      <div id="auth-msg" class="auth-msg ${message ? 'show' : ''}" role="alert">${esc(message)}</div>
      <form id="auth-form" novalidate>${FORMS[mode]}</form>
      ${mode === 'login' || mode === 'register' ? '<div id="gslot"></div>' : ''}
      ${onGuest ? `<div class="or"><span>أو</span></div><button type="button" class="btn light full" id="guest-btn">${ic('eye', 20)} تصفّح كضيف</button><p class="small center">الضيف يتصفح الخريطة فقط ولا يستطيع طلب رحلة.</p>` : ''}
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
        const win = openBlank();
        const back = () => mountAuth(app, { db, mode, onDone, onGuest });
        if (mode === 'forgot') return mountVerify(app, { phone, purpose: 'reset', win, onBack: back, onVerified: () => mountNewPass(app, { db, phone, onDone, onBack: back }) });
        const name = f.full_name.value.trim(), pw = f.password.value;
        return mountVerify(app, { phone, purpose: 'register', win, onBack: back, onVerified: async () => {
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
    } catch (x) { show(errMsg(x)); btn.disabled = false; btn.textContent = label; }
  });
}

const GOOGLE_SVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
let gOn;
// زر Google يظهر فقط إذا فعّله صاحب المشروع في Supabase
async function googleEnabled() {
  if (gOn !== undefined) return gOn;
  try { const c = window.WEIN_CONFIG || {}; const r = await fetch(`${c.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: c.SUPABASE_ANON_KEY } }); gOn = !!(await r.json())?.external?.google; } catch { gOn = false; }
  return gOn;
}
// نافذة تلغرام تُفتح مباشرة بعد ضغطة المستخدم (لئلا يحجبها المتصفح) ثم نوجّهها للرابط
const openBlank = () => { try { return window.open('about:blank', '_blank'); } catch { return null; } };

export function mountVerify(app, { phone, purpose = 'register', win = null, onVerified, onBack }) {
  let w = win, sent = false, link = '', cool = 0, poll = null, cdT = null;
  app.innerHTML = `<div class="auth-wrap"><div class="auth-hero"><div class="auth-logo">وين؟</div><p>تكسي يبرود في جيبك</p></div>
    <div class="auth-card"><div class="tgbox">${ic('send', 34)}</div><h2>تحقق من رقمك عبر تلغرام</h2>
    <p class="sub" id="vsub">جارٍ تجهيز الرمز…</p><div id="auth-msg" class="auth-msg" role="alert"></div>
    <form id="vf" novalidate><input class="otp" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••" dir="ltr" aria-label="رمز التحقق">
      <button class="btn full big" data-submit>تأكيد</button></form>
    <a class="btn light full" id="tgopen" target="_blank" rel="noopener" href="https://t.me/Wuynbot">${ic('send', 18)} فتح تلغرام</a>
    <button type="button" class="link" id="resend">إعادة إرسال الرمز</button><button type="button" class="link" id="vback">تغيير الرقم</button></div></div>`;
  const $ = s => app.querySelector(s), msg = $('#auth-msg'), sub = $('#vsub'), form = $('#vf'), rs = $('#resend'), op = $('#tgopen');
  const show = t => { msg.textContent = t; msg.className = 'auth-msg show'; };
  const alive = () => app.contains(form);
  const onVis = () => { if (!document.hidden) check(); };
  const stop = () => { clearInterval(poll); clearInterval(cdT); document.removeEventListener('visibilitychange', onVis); };
  const check = async () => { if (!alive()) return stop(); if (sent) return; try { const r = await callFunction('tg-verify', { action: 'status', phone, purpose }); if (r.sent) gotCode(); } catch { } };
  const gotCode = () => { sent = true; clearInterval(poll); sub.innerHTML = 'وصلك الرمز على تلغرام ✅<br>اكتب الرمز المكوّن من 6 أرقام (صالح 5 دقائق)'; try { navigator.vibrate?.(80); } catch { } form.elements.code.focus(); };
  const startCool = () => { cool = 30; rs.disabled = true; rs.textContent = 'إعادة الإرسال بعد 30 ث'; clearInterval(cdT); cdT = setInterval(() => { cool--; rs.textContent = cool > 0 ? `إعادة الإرسال بعد ${cool} ث` : 'إعادة إرسال الرمز'; rs.disabled = cool > 0; if (cool <= 0) clearInterval(cdT); }, 1000); };
  async function begin(first) {
    if (!first) w = openBlank();
    sent = false; msg.className = 'auth-msg'; sub.textContent = 'جارٍ تجهيز الرمز…'; startCool();
    try {
      const r = await callFunction('tg-verify', { action: 'start', phone, purpose });
      link = r.open || link; if (link) op.href = link;
      if (w && link) { try { w.location.href = link; } catch { } } else if (w) { try { w.close(); } catch { } }
      if (r.sent) { gotCode(); sub.innerHTML = `أرسلنا الرمز إلى تلغرام على الرقم <b dir="ltr">${esc(phone)}</b> ✅<br>افتح تلغرام وانسخ الرمز ثم اكتبه هنا.`; }
      else { sub.innerHTML = `افتح البوت <b>@${esc(r.bot || 'Wuynbot')}</b> واضغط <b>Start</b> ثم زر <b>«شارك رقمي»</b>.<br>سيصلك الرمز هناك فوراً، ثم ارجع واكتبه هنا.`; clearInterval(poll); poll = setInterval(check, 2500); }
    } catch (e) { try { w?.close(); } catch { } sub.textContent = ''; show(errMsg(e)); }
  }
  document.addEventListener('visibilitychange', onVis);
  $('#vback').onclick = () => { stop(); onBack?.(); };
  rs.onclick = () => begin(false);
  form.addEventListener('submit', async e => {
    e.preventDefault(); const btn = form.querySelector('[data-submit]'), code = (form.elements.code.value || '').replace(/\D/g, '');
    if (code.length !== 6) return show('اكتب الرمز المكوّن من 6 أرقام.');
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'لحظة…'; msg.className = 'auth-msg';
    try { await callFunction('tg-verify', { action: 'check', phone, purpose, code }); stop(); await onVerified?.(); }
    catch (x) { show(errMsg(x)); btn.disabled = false; btn.textContent = label; }
  });
  begin(true);
}

function mountNewPass(app, { db, phone, onDone }) {
  app.innerHTML = `<div class="auth-wrap"><div class="auth-hero"><div class="auth-logo">وين؟</div></div><div class="auth-card"><h2>كلمة مرور جديدة</h2><p class="sub">تم التحقق من رقمك. اختر كلمة مرور جديدة.</p>
    <div id="auth-msg" class="auth-msg" role="alert"></div><form id="npf" novalidate>${pass('password', 'كلمة المرور الجديدة (8 أحرف على الأقل)', 'new-password', 'minlength="8"')}<button class="btn full big" data-submit>حفظ ودخول</button></form></div></div>`;
  const form = app.querySelector('#npf'), msg = app.querySelector('#auth-msg');
  form.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = b.previousElementSibling, h = i.type === 'password'; i.type = h ? 'text' : 'password'; b.innerHTML = ic(h ? 'eyeoff' : 'eye', 20); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!form.reportValidity()) return; const btn = form.querySelector('[data-submit]'); btn.disabled = true; msg.className = 'auth-msg';
    try { const pw = form.elements.password.value; await callFunction('reset-password', { phone, password: pw }); const { error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password: pw }); if (error) throw error; onDone?.(); }
    catch (x) { msg.textContent = errMsg(x); msg.className = 'auth-msg show'; btn.disabled = false; }
  });
}

// حساب Google جديد: اسم + رقم هاتف موثّق بتلغرام
export function mountComplete(app, { db, user, logout, onDone }) {
  const nm = user.user_metadata?.full_name || user.user_metadata?.name || '';
  app.innerHTML = `<div class="auth-wrap"><div class="auth-hero"><div class="auth-logo">وين؟</div><p>مرحباً بك</p></div><div class="auth-card"><h2>أكمل حسابك</h2><p class="sub">مرة واحدة فقط: اكتب رقم هاتفك ونتحقق منه عبر تلغرام</p>
    <div id="auth-msg" class="auth-msg" role="alert"></div><form id="cf2" novalidate>${field('full_name', 'الاسم الكامل', 'text', `maxlength="100" required autocomplete="name" value="${esc(nm)}"`)}
    ${field('phone', 'رقم الهاتف', 'tel', 'inputmode="tel" placeholder="09xxxxxxxx" required autocomplete="tel" dir="ltr"')}
    <p class="small center tgnote">${ic('send', 14)} سيصلك رمز التحقق على تلغرام</p><button class="btn full big" data-submit>متابعة</button></form>
    <button type="button" class="link" id="lo2">تسجيل الخروج</button></div></div>`;
  const form = app.querySelector('#cf2'), msg = app.querySelector('#auth-msg');
  app.querySelector('#lo2').onclick = () => logout?.();
  form.addEventListener('submit', e => {
    e.preventDefault(); if (!form.reportValidity()) return;
    const phone = normalizePhone(form.elements.phone.value), name = form.elements.full_name.value.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { msg.textContent = 'رقم الهاتف غير صحيح. اكتبه هكذا: 09xxxxxxxx'; msg.className = 'auth-msg show'; return; }
    const win = openBlank(), back = () => mountComplete(app, { db, user, logout, onDone });
    mountVerify(app, { phone, purpose: 'register', win, onBack: back, onVerified: async () => {
      const { data } = await db.auth.getSession();
      await callFunction('complete-profile', { phone, full_name: name }, data?.session?.access_token);
      onDone?.();
    } });
  });
  }
        
