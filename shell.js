import { esc } from './utils.js';
import { ic } from './icons.js';

// هيكل مشترك: رأس + محتوى + شريط تنقل سفلي. كل تبويب له حاوية تبقى حية (الخريطة لا تُعاد بناؤها).
export function buildShell(app, { subtitle = '', tabs, start, onShow, right = '' }) {
  app.innerHTML = `<div class="shell"><header class="top"><div><div class="logo">وين؟</div><small>${esc(subtitle)}</small></div><div class="top-r">${right}</div></header>
    <div class="body">${tabs.map(t => `<section class="pane hidden" data-pane="${t[0]}"></section>`).join('')}</div>
    <nav class="bottom-nav">${tabs.map(t => `<button data-tab="${t[0]}"><span class="ni">${ic(t[2], 24)}<em class="dot hidden"></em></span><span>${t[1]}</span></button>`).join('')}</nav></div>`;
  const panes = {}; app.querySelectorAll('[data-pane]').forEach(p => panes[p.dataset.pane] = p);
  const btns = [...app.querySelectorAll('[data-tab]')];
  let cur = null;
  function show(id) {
    const first = cur === null || !panes[id].dataset.init; panes[id].dataset.init = '1';
    for (const k in panes) panes[k].classList.toggle('hidden', k !== id);
    btns.forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    const prev = cur; cur = id; onShow(id, panes[id], first, prev);
  }
  btns.forEach(b => b.onclick = () => show(b.dataset.tab));
  show(start || tabs[0][0]);
  return { panes, show, current: () => cur, dot(id, on) { btns.find(b => b.dataset.tab === id)?.querySelector('.dot').classList.toggle('hidden', !on); } };
}
