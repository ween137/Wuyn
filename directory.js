// دليل المكاتب والسائقين والمتورات: بطاقات، تقييم، فلاتر، ترتيب
import { esc, ago } from './utils.js';
import { ic } from './icons.js';

export const favs = () => { try { return new Set(JSON.parse(localStorage.getItem('ween-fav') || '[]')); } catch { return new Set(); } };
const saveFavs = s => { try { localStorage.setItem('ween-fav', JSON.stringify([...s])); } catch { } };
const ST = { live: ['متاح الآن', 'ok'], busy: ['في رحلة', 'live'], offline: ['غير متصل', ''] };
export const roleLabel = r => r === 'office' ? 'مكتب تكسي' : r === 'motor' ? 'متور توصيل' : 'سائق';
export const roleIcon = r => r === 'office' ? 'bag' : r === 'motor' ? 'motor' : 'car';
const avCls = r => r === 'office' ? 'gold' : r === 'motor' ? 'orange' : '';

// نجوم من 5: التقييم الافتراضي للجدد 4.0 ويتغير مع التقييمات الحقيقية
export function starRow(v) {
  const n = Math.max(0, Math.min(5, Number(v) || 0)), full = Math.floor(n + 0.25), half = n - full >= 0.5;
  return `<span class="srow" aria-label="${n} من 5">${[0, 1, 2, 3, 4].map(i => `<i class="${i < full ? 'f' : i === full && half ? 'h' : ''}">★</i>`).join('')}</span>`;
}
export const ratingChip = t => `<span class="rate">${starRow(t.rating)}<b>${Number(t.rating ?? 4).toFixed(1)}</b><small>${t.rating_n ? `(${t.rating_n})` : 'جديد'}</small></span>`;

export function taxiCard(t, { canLocate = true } = {}) {
  const [stl, stc] = ST[t.state] || ST.offline;
  return `<div class="tcard"><div class="row"><div class="avatar-s ${avCls(t.role)}">${ic(roleIcon(t.role), 22)}</div>
    <div class="grow"><b>${esc(t.name)}</b><small>${roleLabel(t.role)}${t.area ? ' · ' + esc(t.area) : ''}</small></div><span class="pill ${stc}">${stl}</span></div>
    <div class="chips">${ratingChip(t)}<span class="chip">${t.trips || 0} رحلة</span>${t.vehicle ? `<span class="chip">${ic(t.role === 'motor' ? 'motor' : 'car', 14)} ${esc(t.vehicle)}</span>` : ''}${t.since ? `<span class="chip">منذ ${t.since}</span>` : ''}</div>
    <div class="actions3">${t.phone ? `<a class="btn light" href="tel:${esc(t.phone)}">${ic('phone', 18)} اتصال</a>` : ''}${canLocate && t.state === 'live' ? `<button class="btn light" data-act="tlocate" data-k="${t.k}">${ic('target', 18)} على الخريطة</button>` : ''}<button class="btn light" data-act="tclose">إغلاق</button></div></div>`;
}

const F = [['all', 'الكل'], ['fav', 'المفضلة'], ['office', 'مكاتب'], ['driver', 'سيارات'], ['motor', 'متورات']];
const SORT = [['best', 'الأفضل'], ['rating', 'الأعلى تقييماً'], ['trips', 'الأكثر رحلات']];
const stRank = s => s === 'live' ? 0 : s === 'busy' ? 1 : 2;

// صفحة دليل كاملة داخل تبويب. onPick(t) عند الضغط على بطاقة.
export function dirPage(pane, list, { onPick, state = { f: 'all', s: 'best', q: '', live: false } } = {}) {
  let fv = favs(); const cnt = k => k === 'all' ? list.length : k === 'fav' ? list.filter(t => fv.has(t.k)).length : list.filter(t => t.role === k).length;
  const draw = () => {
    fv = favs();
    let rows = list.filter(t => (state.f === 'all' || (state.f === 'fav' ? fv.has(t.k) : t.role === state.f)) && (!state.live || t.state === 'live') && (!state.q || (t.name + ' ' + (t.area || '') + ' ' + (t.vehicle || '')).includes(state.q)));
    rows = [...rows].sort((a, b) => state.s === 'rating' ? (b.rating - a.rating) || (b.rating_n - a.rating_n) : state.s === 'trips' ? (b.trips - a.trips) : (fv.has(b.k) - fv.has(a.k)) || (stRank(a.state) - stRank(b.state)) || (b.rating - a.rating) || (b.trips - a.trips));
    const live = list.filter(t => t.state === 'live').length;
    pane.innerHTML = `<div class="page"><h2 class="ph">المكاتب والسائقون</h2>
      <div class="dsum"><div><b>${list.filter(t => t.role === 'office').length}</b><small>مكتب</small></div><div><b>${list.filter(t => t.role === 'driver').length}</b><small>سائق</small></div><div><b>${list.filter(t => t.role === 'motor').length}</b><small>متور</small></div><div class="on"><b>${live}</b><small>متاح الآن</small></div></div>
      <input class="notes" id="dq" placeholder="ابحث بالاسم أو المنطقة أو نوع السيارة" value="${esc(state.q)}">
      <div class="filt">${F.map(([k, l]) => `<button class="fchip ${state.f === k ? 'on' : ''}" data-f="${k}">${l} <em>${cnt(k)}</em></button>`).join('')}<button class="fchip ${state.live ? 'on' : ''}" data-live>${state.live ? '● ' : ''}المتاحون فقط</button></div>
      <div class="filt sort"><small>ترتيب:</small>${SORT.map(([k, l]) => `<button class="fchip ${state.s === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
      ${rows.map(card).join('') || `<p class="center muted">${state.f === 'fav' ? 'اضغط على القلب في أي بطاقة لإضافتها إلى المفضلة.' : 'لا توجد نتائج.'}</p>`}</div>`;
    const i = pane.querySelector('#dq'); i.oninput = () => { state.q = i.value.trim(); const p = i.selectionStart; draw(); const n = pane.querySelector('#dq'); n.focus(); n.setSelectionRange(p, p); };
  };
  const card = t => { const [stl, stc] = ST[t.state] || ST.offline; return `<div class="dcard" role="button" tabindex="0" data-k="${t.k}"><div class="avatar-s ${avCls(t.role)}">${ic(roleIcon(t.role), 22)}</div>
    <div class="grow"><div class="rr-top"><b>${esc(t.name)}</b><span class="pill ${stc}">${stl}</span></div><small>${roleLabel(t.role)}${t.area ? ' · ' + esc(t.area) : ''}${t.vehicle ? ' · ' + esc(t.vehicle) : ''}</small>
    <div class="chips">${ratingChip(t)}<span class="chip">${t.trips || 0} رحلة</span>${t.state === 'offline' && t.last_seen ? `<span class="chip">آخر ظهور ${ago(t.last_seen)}</span>` : ''}</div></div><button class="heart ${fv.has(t.k) ? 'on' : ''}" data-fav="${t.k}" aria-label="مفضلة">${ic('heart', 22)}</button></div>`; };
  pane.onclick = e => {
    const h = e.target.closest('[data-fav]'); if (h) { const s = favs(); s.has(h.dataset.fav) ? s.delete(h.dataset.fav) : s.add(h.dataset.fav); saveFavs(s); return draw(); }
    const f = e.target.closest('[data-f]'); if (f) { state.f = f.dataset.f; return draw(); }
    const s = e.target.closest('[data-s]'); if (s) { state.s = s.dataset.s; return draw(); }
    if (e.target.closest('[data-live]')) { state.live = !state.live; return draw(); }
    const b = e.target.closest('[data-k]'); if (b) onPick?.(list.find(t => t.k === b.dataset.k));
  };
  draw();
  return { refresh(l) { list = l; draw(); } };
}

// نافذة قائمة سريعة (تُستخدم من الخريطة)
export function openDirectory(list, onPick, startFilter = 'all') {
  const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
  ov.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back', 22)}</button><div class="ttl">المكاتب والسائقون والمتورات</div><span style="width:40px"></span></header><div id="dbody" style="width:100%;overflow:auto;flex:1"></div>`;
  dirPage(ov.querySelector('#dbody'), list, { onPick: t => { ov.remove(); onPick(t); }, state: { f: startFilter, s: 'best', q: '', live: false } });
  ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) ov.remove(); });
}
