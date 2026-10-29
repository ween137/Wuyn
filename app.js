import { getClient } from './supabase.js';
import { mountAuth } from './signin.js';
import { mountCustomer } from './customer.js';
import { mountProvider } from './provider.js';
import { mountAdmin } from './dashboard.js';
import { setTheme, esc, toast, errMsg } from './utils.js';
import { haltLocal } from './live.js';
import { ensureSupabase, loadFont } from './loader.js';
import { mountGuest } from './guest.js';
import { initNav } from './nav.js';

window.__booted = true; try { sessionStorage.removeItem('g-tried'); } catch { }
const app = document.querySelector('#app');
let db, cleanup = null, currentId = null, authMode = 'login', seq = 0;
setTheme();
loadFont();
initNav();
addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__bip = e; });

const splash = (t = '') => { app.innerHTML = `<div class="splash"><div class="auth-logo">وين؟</div>${t ? `<p>${esc(t)}</p>` : '<div class="spin"></div>'}</div>`; };
const unmount = () => { try { cleanup?.(); } catch { } cleanup = null; };

async function logout() {
  try { await db.rpc('stop_location'); } catch { }
  haltLocal();
  await db.auth.signOut();
}

const showAuth = (message = '') => mountAuth(app, { db, mode: authMode, message, onGuest: () => { unmount(); cleanup = mountGuest({ app, db, goLogin: m => { authMode = m; unmount(); showAuth(); } }); } });

async function route(session) {
  const my = ++seq;
  if (!session) { currentId = null; unmount(); showAuth(); return; }
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
  if (profile.role === 'admin') { cleanup = mountAdmin({ app, db, user, logout }); return; }
  const ctx = { app, db, user, profile, logout };
  cleanup = profile.role === 'customer' ? mountCustomer(ctx) : mountProvider(ctx);
}

async function boot() {
  splash('جارٍ التحميل…');
  const slow = setTimeout(() => { if (!db) splash('الاتصال بطيء. إن استمر التحميل جرّب VPN أو شبكة أخرى.'); }, 12000);
  try { await ensureSupabase(); db = getClient(); }
  catch (e) {
    clearTimeout(slow);
    app.innerHTML = `<div class="splash"><div class="auth-logo">وين؟</div><p>${esc(e.message)}</p><button class="btn" id="rl">إعادة المحاولة</button></div>`;
    app.querySelector('#rl').onclick = boot; return;
  }
  clearTimeout(slow);
  db.auth.onAuthStateChange((ev, session) => {
    if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(() => route(session).catch(e => { console.error(e); toast(errMsg(e), 'err'); showFail(e); }), 0);
  });
}
function showFail(e) { if (!document.querySelector('.splash')) return; app.innerHTML = `<div class="splash"><div class="auth-logo">وين؟</div><p>تعذّر تشغيل التطبيق: ${esc(errMsg(e))}</p><button class="btn" id="rl">إعادة التحميل</button></div>`; app.querySelector('#rl').onclick = () => location.reload(); }
addEventListener('unhandledrejection', ev => console.error(ev.reason));
boot();

// حالة الاتصال
const bar = document.createElement('div'); bar.id = 'offline'; bar.textContent = 'لا يوجد اتصال بالإنترنت'; document.body.appendChild(bar);
const net = () => bar.classList.toggle('show', !navigator.onLine); addEventListener('online', net); addEventListener('offline', net); net();

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(r => r.update()).catch(() => { }));
