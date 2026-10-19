export const roleNames = { customer: 'زبون', driver: 'سائق', office: 'مكتب تكسي', admin: 'مدير النظام' };
export const statusNames = {
  searching: 'نبحث عن سيارة', accepted: 'تم قبول الطلب', on_the_way: 'السيارة في الطريق إليك',
  arrived: 'وصلت السيارة', started: 'الرحلة جارية', completed: 'اكتملت الرحلة',
  cancelled: 'ملغاة', no_driver: 'لم يرد أحد',
};
export const vehicleNames = { economy: 'اقتصادي', comfort: 'مريح' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(s, kind = '') {
  const t = document.querySelector('#toast'); if (!t) return;
  t.textContent = s; t.className = 'show ' + kind;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.className = ''; }, 3800);
}
export function setTheme() {
  let dark = false; try { dark = localStorage.getItem('ween-theme') === 'dark'; } catch {}
  document.body.classList.toggle('dark', dark);
}
export function toggleTheme() {
  const dark = !document.body.classList.contains('dark');
  document.body.classList.toggle('dark', dark);
  try { localStorage.setItem('ween-theme', dark ? 'dark' : 'light'); } catch {}
}
// أرقام عربية/فارسية -> لاتينية
export const latin = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
export const money = n => (n == null ? '—' : Number(n).toLocaleString('en-US') + ' ل.س');
export const fmtTime = d => new Date(d).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = d => new Date(d).toLocaleDateString('ar', { day: 'numeric', month: 'short' });
export const fmtKm = m => m == null ? '—' : (m < 1000 ? Math.round(m) + ' م' : (m / 1000).toFixed(1) + ' كم');
export const ago = d => { const s = Math.max(0, (Date.now() - new Date(d)) / 1000); return s < 60 ? 'الآن' : s < 3600 ? 'منذ ' + Math.floor(s / 60) + ' د' : 'منذ ' + Math.floor(s / 3600) + ' س'; };
export const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
export function hav(a, b, c, d) { const R = 6371000, r = x => x * Math.PI / 180, dl = r(c - a), dg = r(d - b); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

// رسائل الأخطاء بالعربية
export function errMsg(e) {
  const m = String(e?.message || e || '');
  if (m === 'identity_required') return 'identity_required';
  if (m === 'rate_limited') return 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.';
  if (m === 'location_required') return 'فعّل الموقع أولاً ليتمكن الزبون من تتبعك.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'لا يوجد اتصال بالإنترنت.';
  if (/[؀-ۿ]/.test(m)) return m;
  if (/JWT|expired/i.test(m)) return 'انتهت الجلسة. سجّل الدخول مجدداً.';
  return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
}
// عمليات بأمان: تعطّل الزر أثناء التنفيذ
export async function busy(btn, fn) {
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.classList.add('loading'); }
  try { return await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('loading'); } }
}
