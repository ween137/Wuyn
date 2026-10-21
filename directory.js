import { esc } from './utils.js';
import { ic } from './icons.js';

const ST = { live: ['متاح الآن', 'ok'], busy: ['في رحلة', 'live'], offline: ['غير متصل', ''] };
export const roleLabel = r => r === 'office' ? 'مكتب تكسي' : 'سائق';

export function taxiCard(t, { canLocate = true } = {}) {
  const [stl, stc] = ST[t.state] || ST.offline;
  return `<div class="tcard"><div class="row"><div class="avatar-s ${t.role === 'office' ? 'gold' : ''}">${ic(t.role === 'office' ? 'bag' : 'car', 22)}</div>
    <div class="grow"><b>${esc(t.name)}</b><small>${roleLabel(t.role)}${t.area ? ' · ' + esc(t.area) : ''}</small></div><span class="pill ${stc}">${stl}</span></div>
    <div class="chips">${t.vehicle ? `<span class="chip">${ic('car', 14)} ${esc(t.vehicle)}</span>` : ''}${t.rating_avg ? `<span class="chip stars">${ic('star', 14)} ${t.rating_avg}</span>` : ''}<span class="chip">${t.trips || 0} رحلة</span></div>
    <div class="actions3">${t.phone ? `<a class="btn light" href="tel:${esc(t.phone)}">${ic('phone', 18)} اتصال</a>` : ''}${canLocate && t.state === 'live' ? `<button class="btn light" data-act="tlocate" data-k="${t.k}">${ic('target', 18)} على الخريطة</button>` : ''}<button class="btn light" data-act="tclose">إغلاق</button></div></div>`;
}

// قائمة كل المكاتب والسائقين
export function openDirectory(list, onPick) {
  const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
  const row = t => { const [stl, stc] = ST[t.state] || ST.offline; return `<button class="ride-row" data-k="${t.k}"><div class="rr-top"><b>${esc(t.name)}</b><span class="pill ${stc}">${stl}</span></div><small>${roleLabel(t.role)}${t.area ? ' · ' + esc(t.area) : ''}${t.vehicle ? ' · ' + esc(t.vehicle) : ''}</small></button>`; };
  const off = list.filter(t => t.role === 'office'), drv = list.filter(t => t.role !== 'office');
  ov.innerHTML = `<header class="top"><button class="icon-btn" data-x aria-label="رجوع">${ic('back', 22)}</button><div class="ttl">المكاتب والسائقون</div><span style="width:40px"></span></header>
    <div class="page" style="width:100%">${off.length ? `<h3 class="sec">المكاتب (${off.length})</h3>${off.map(row).join('')}` : ''}${drv.length ? `<h3 class="sec">السائقون (${drv.length})</h3>${drv.map(row).join('')}` : ''}${list.length ? '' : '<p class="center muted">لا يوجد أحد مسجّل بعد.</p>'}</div>`;
  ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) return ov.remove(); const b = e.target.closest('[data-k]'); if (b) { ov.remove(); onPick(list.find(t => t.k === b.dataset.k)); } });
}
