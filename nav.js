// زر الرجوع في الجوال: يغلق النوافذ والمحادثات والخطوات الواحدة تلو الأخرى كتطبيقات أندرويد
import { toast } from './utils.js';
const stack = []; const els = new Map(); let ignore = 0, armed = 0, tabBack = null, ready = false;
const mark = n => { try { history.pushState({ wein: n }, ''); } catch { } };

export function push(close) { const t = { close }; stack.push(t); mark('layer'); return t; }
export function release(t) { const i = t ? stack.indexOf(t) : -1; if (i < 0) return; stack.splice(i, 1); ignore++; try { history.back(); } catch { ignore--; } }
export function setTabBack(fn) { tabBack = fn; }

function closeEl(n) {
  const b = n.querySelector('[data-x],#n,#rk,#cl'); if (b) b.click(); else n.remove();
  if (n.isConnected) n.remove();
}
function onPop() {
  if (ignore > 0) { ignore--; return; }
  const t = stack.pop();
  if (t) { try { t.close(); } catch (e) { console.error(e); } return; }
  if (tabBack && tabBack()) { mark('root'); return; }
  if (Date.now() - armed < 2500) { armed = 0; try { history.back(); } catch { } return; }
  armed = Date.now(); toast('اضغط رجوع مرة أخرى للخروج'); mark('root');
}
export function initNav() {
  if (ready) return; ready = true;
  try { history.replaceState({ wein: 'base' }, ''); } catch { } mark('root');
  addEventListener('popstate', onPop);
  new MutationObserver(ms => {
    for (const m of ms) {
      m.addedNodes.forEach(n => { if (n.nodeType === 1 && (n.classList.contains('overlay') || n.classList.contains('modal')) && !els.has(n)) els.set(n, push(() => closeEl(n))); });
      m.removedNodes.forEach(n => { const t = els.get(n); if (t) { els.delete(n); release(t); } });
    }
  }).observe(document.body, { childList: true });
}
