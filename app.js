import { getClient } from './supabase.js';
import { mountAuth } from './auth.js';
import { mountCustomer } from './customer.js';
import { mountProvider } from './provider.js';
import { renderAdmin } from './admin.js';
import { setTheme, esc, toast, errMsg } from './utils.js';
import { haltLocal } from './live.js';

const app = document.querySelector('#app');
let db, cleanup = null, currentId = null, authMode = 'login', adminTab = 'users', seq = 0;
setTheme();
// الخط: تحميل غير معطِّل للعرض
{ const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'; document.head.appendChild(l); }

const splash = (t = '') => { app.innerHTML = `<div class="splash"><div class="auth-logo">وين؟</div>${t ? `<p>${esc(t)}</p>` : '<div class="spin"></div>'}</div>`; };
const unmount = () => { try { cleanup?.(); } catch { } cleanup = null; };

async function logout() {
  try { await db.rpc('stop_location'); } catch { }
  haltLocal();
  await db.auth.signOut();
}

async function route(session) {
  const my = ++seq;
  if (!session) { currentId = null; unmount(); mountAuth(app, { db, mode: authMode }); return; }
  if (currentId === session.user.id && cleanup) return; // تجديد الرمز لا يعيد بناء الشاشة
  currentId = session.user.id; unmount(); splash();
  let profile = null, err = null;
  for (let i = 0; i < 3 && !profile; i++) {
    const { data, error } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (my !== seq) return; err = error; profile = data; if (!profile) await new Promise(r => setTimeout(r, 700));
  }
  if (my !== seq) return;
  const user = session.user;
  if (!profile) { app.innerHTML = `<div class="auth-wrap"><div class="auth-card"><h2>تعذر تحميل حسابك</h2><p class="sub">${esc(err ? errMsg(err) : 'ملف الحساب غير موجود.')}</p><button class="btn full" id="rt">إعادة المحاولة</button><button class="btn light full" id="lo">تسجيل الخروج</button></div></div>`; app.querySelector('#rt').onclick = () => { currentId = null; route(session); }; app.querySelector('#lo').onclick = logout; return; }
  if (profile.status !== 'active') { app.innerHTML = `<div class="auth-wrap"><div class="auth-card"><h2>الحساب غير فعّال</h2><p class="sub">حالة الحساب: ${esc(profile.status)}. تواصل مع الإدارة.</p><button class="btn full" id="rt">تحديث</button><button class="btn light full" id="lo">تسجيل الخروج</button></div></div>`; app.querySelector('#rt').onclick = () => { currentId = null; route(session); }; app.querySelector('#lo').onclick = logout; cleanup = () => { }; return; }
  if (profile.role === 'admin') { cleanup = () => { }; return renderAdmin({ app, db, user, tab: adminTab }); }
  const ctx = { app, db, user, profile, logout };
  cleanup = profile.role === 'customer' ? mountCustomer(ctx) : mountProvider(ctx);
}

try {
  db = getClient();
  db.auth.onAuthStateChange((ev, session) => {
    if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(() => route(session).catch(e => { console.error(e); toast(errMsg(e), 'err'); }), 0);
  });
} catch (e) { mountAuth(app, { db: null, message: e.message }); }

// أزرار لوحة الإدارة (واجهة الإدارة القديمة)
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]'); if (!b || !db) return; const a = b.dataset.action;
  try {
    const { data: { session } } = await db.auth.getSession(); const user = session?.user;
    if (a === 'logout') await logout();
    else if (a === 'admin-tab') { adminTab = b.dataset.value; await renderAdmin({ app, db, user, tab: adminTab }); }
    else if (a === 'user-status') { const { error } = await db.from('profiles').update({ status: b.dataset.value }).eq('id', b.dataset.id); if (error) throw error; await renderAdmin({ app, db, user, tab: adminTab }); }
  } catch (x) { toast(errMsg(x), 'err'); }
});

// حالة الاتصال
const bar = document.createElement('div'); bar.id = 'offline'; bar.textContent = 'لا يوجد اتصال بالإنترنت'; document.body.appendChild(bar);
const net = () => bar.classList.toggle('show', !navigator.onLine); addEventListener('online', net); addEventListener('offline', net); net();

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(r => r.update()).catch(() => { }));
