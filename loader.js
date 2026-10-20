// تحميل المكتبات الخارجية بمرونة: عدة مصادر + مهلة، دون تعطيل ظهور التطبيق
const tryLoad = (url, ms) => new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = url; s.async = true;
  const t = setTimeout(() => { s.remove(); rej(new Error('timeout')); }, ms);
  s.onload = () => { clearTimeout(t); res(); };
  s.onerror = () => { clearTimeout(t); s.remove(); rej(new Error('fail')); };
  document.head.appendChild(s);
});
async function load(urls, check, ms = 15000) {
  if (check()) return;
  for (const u of urls) { try { await tryLoad(u, ms); if (check()) return; } catch { } }
  throw new Error('تعذر تحميل مكوّنات التطبيق. تحقق من الإنترنت أو جرّب VPN ثم أعد المحاولة.');
}
const css = href => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); };

let sb, lf;
export const ensureSupabase = () => sb ||= load([
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2.57.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'], () => !!window.supabase).catch(e => { sb = null; throw e; });
export const ensureLeaflet = () => lf ||= (() => {
  css('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'); css('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css');
  return load([
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'], () => !!window.L);
})().catch(e => { lf = null; throw e; });
export function loadFont() { css('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); }
