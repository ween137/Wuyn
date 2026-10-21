import { carSvg, pinSvg } from './icons.js';
const DEFAULT = [33.9675, 36.6575]; // يبرود

export function createMap(el, { center = DEFAULT, zoom = 14 } = {}) {
  if (!window.L) throw new Error('تعذر تحميل الخريطة. تحقق من الاتصال.');
  const L = window.L;
  const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: true, tap: true, zoomSnap: 0.5 }).setView(center, zoom);
  map.attributionControl.setPrefix('');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', updateWhenIdle: true, keepBuffer: 3 }).addTo(map);
  const items = {};
  const animate = (m, to) => { const from = m.getLatLng(), t0 = performance.now(), D = 1200; cancelAnimationFrame(m._raf); const step = now => { const p = Math.min(1, (now - t0) / D); m.setLatLng([from.lat + (to[0] - from.lat) * p, from.lng + (to[1] - from.lng) * p]); if (p < 1) m._raf = requestAnimationFrame(step); }; m._raf = requestAnimationFrame(step); };
  const icon = (html, size, anchor, cls = '') => L.divIcon({ html, className: 'mk ' + cls, iconSize: size, iconAnchor: anchor });
  const api = {
    map,
    // علامة باسم ثابت: تُنشأ مرة وتتحرك عند التحديث
    put(key, latlng, kind = 'pin', color = '#000', extra = {}) {
      const ic = kind === 'car' ? icon(carSvg(color), [34, 34], [17, 17], 'car') : kind === 'me' ? icon('<div class="me-dot"></div>', [22, 22], [11, 11]) : icon(pinSvg(color), [30, 38], [15, 37]);
      if (items[key]) { items[key].setLatLng(latlng); } else { items[key] = L.marker(latlng, { icon: ic, keyboard: false, ...extra }).addTo(map); }
      return items[key];
    },
    remove(key) { if (items[key]) { map.removeLayer(items[key]); delete items[key]; } },
    // سيارات/مكاتب: تحديث تفاضلي مع حركة سلسة، والنقر يستدعي onTap(عنصر)
    syncCars(list, onTap) {
      const keep = new Set();
      for (const t of list) {
        const k = 'taxi:' + t.k; keep.add(k); const ll = [t.lat, t.lng], m = items[k];
        if (m) { m._t = t; animate(m, ll); }
        else { const mk = api.put(k, ll, 'car', t.role === 'office' ? '#b8892e' : '#111'); mk._t = t; if (onTap) mk.on('click', () => onTap(mk._t)); }
      }
      Object.keys(items).filter(k => k.startsWith('taxi:') && !keep.has(k)).forEach(api.remove);
    },
    flyTo(ll, z = 16) { map.setView(ll, z); },
    line(key, pts, opts = {}) {
      if (items[key]) map.removeLayer(items[key]);
      if (!pts || pts.length < 2) { delete items[key]; return; }
      items[key] = L.polyline(pts, { color: '#000', weight: 5, opacity: .85, lineJoin: 'round', ...opts }).addTo(map);
    },
    fit(pts, pad = [50, 50], padBR = null, maxZoom = 17) {
      const v = pts.filter(Boolean); if (!v.length) return;
      if (v.length === 1) return map.setView(v[0], Math.min(maxZoom, 16));
      map.fitBounds(L.latLngBounds(v), padBR ? { paddingTopLeft: pad, paddingBottomRight: padBR, maxZoom, animate: false } : { padding: pad, maxZoom, animate: false });
    },
    center: () => { const c = map.getCenter(); return [c.lat, c.lng]; },
    fix: () => setTimeout(() => map.invalidateSize(), 120),
    destroy() { try { map.remove(); } catch {} },
  };
  return api;
}
export { DEFAULT as YABROUD };
