import { esc } from './utils.js';
import { ic } from './icons.js';

const ST = { live: ['متاح الآن', 'ok'], busy: ['في رحلة', 'live'], offline: ['غير متصل', ''] };
export const roleLabel = r => r === 'office' ? 'مكتب تكسي' : r === 'motor' ? 'متور توصيل' : 'سائق';
export const roleIcon = r => r === 'office' ? 'bag' : r === 'motor' ? 'motor' : 'car';

export function taxiCard(t, { canLocate = true } = {}) {
  const [stl, stc] = ST[t.state] || ST.offline;
  return `<div class="tcard"><div class="row"><div class="avatar-s ${t.role === 'office' ? 'gold' : t.role === 'motor' ? 'orange' : ''}">${ic(roleIcon(t.role), 22)}</div>
    <div class="grow"><b>${esc(t.name)}</b><small>${roleLabel(t.role)}${t.area ? ' · ' + esc(t.area) : ''}</small></div><span class="pill ${stc}">${stl}</span></div>
    <div class="chips">${t.vehicle ? `<span class="chip">${ic('car', 14)} ${esc(t.vehicle)}</span>` : ''}${t.rating_avg ? `<span class="chip stars">${ic('star', 14)} ${t.rating_avg}</span>` : ''}<span class="chip">${t.trips || 0} رحلة</span></div>
    <div class="actions3">${t.phone ? `<a class="btn light" href="tel:${esc(t.phone)}">${ic('phone', 18)} اتصال</a>` : ''}${canLocate && t.state === 'live' ? `<button class="btn light" data-act="tlocate" data-k="${t.k}">${ic('target', 18)} على الخريطة</button>` : ''}<button class="btn light" data-act="tclose">إغلاق</button></div></div>`;
}

// قائمة كل المكاتب والسائقين والمتورات مع فلتر
export function openDirectory(list, onPick, startFilter = 'all') {
  const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
  let f = startFilter, q = '';
  const row = t => { const [stl, stc] = ST[t.state] || ST.offline; return `<button class="ride-row" data-k="${t.k}"><div class="rr-top"><b>${ic(roleIcon(t.role), 16)} ${esc(t.name)}</b><span class="pill ${stc}">${stl}</span></div><small>${roleLabel(t.role)}${t.area ? ' · ' + esc(t.area) : ''}${t.vehicle ? ' · ' + esc(t.vehicle) : ''}</small></button>`; };
  const F = [['all', 'الكل'], ['office', 'مكاتب'], ['driver', 'سيارات'], ['motor', 'متورات']];
  const draw = () => {
    const cnt = k => k === 'all' ? list.length : list.filter(t => t.role === k).length;
    const rows = list.filter(t => (f === 'all' || t.role === f) && (!q || (t.name + ' ' + (t.area || '')).includes(q)));
    const sec = (k, title) => { const a = rows.filter(t => t.role === k); return a.length ? `<h3 class="sec">${title} (${a.length})</h3>${a.map(row).join('')}` : ''; };
    ov.querySelector('#dbody').innerHTML = `<div class="filt">${F.map(([k, l]) => `<button class="fchip ${f === k ? 'on' : ''}" data-f="${k}">${l} <em>${cnt(k)}</em></button>`).join('')}</div>
      <input class="notes" id="dq" placeholder="ابحث بالاسم أو المنطقة" value="${esc(q)}">
      ${sec('office', 'المكاتب')}${sec('driver', 'السيارات')}${sec('motor', 'المتورات')}${rows.length ? '' : '<p class="center muted">لا توجد نتائج.</p>'}`;
    const i = ov.querySelector('#dq'); i.oninput = () => { q = i.value.trim(); const p = i.selectionStart; draw(); const n = ov.querySelector('#dq'); n.focus(); n.setSelectionRange(p, p); };
  };
  ov.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back', 22)}</button><div class="ttl">المكاتب والسائقون والمتورات</div><span style="width:40px"></span></header><div class="page" style="width:100%" id="dbody"></div>`;
  draw();
  ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) return ov.remove(); const c = e.target.closest('[data-f]'); if (c) { f = c.dataset.f; return draw(); } const b = e.target.closest('[data-k]'); if (b) { ov.remove(); onPick(list.find(t => t.k === b.dataset.k)); } });
}
