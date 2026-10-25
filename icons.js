// أيقونات SVG بسيطة (بديل الإيموجي). الاستخدام: ic('home') أو ic('car',24)
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  car: '<path d="M5 16l1.5-6A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
  pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  flag: '<path d="M5 22V3"/><path d="M5 4h13l-2 4 2 4H5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  id: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c0-2 6-2 6 0M14 10h5M14 14h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10 6a9 9 0 0 1 12 6 14 14 0 0 1-3 3.5M6 7.5A14 14 0 0 0 2 12s4 7 10 7a9 9 0 0 0 4-1"/>',
  logout: '<path d="M10 4H5v16h5"/><path d="M16 8l4 4-4 4M20 12H9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3.5-5.5 7-5.5s7 2 7 5.5"/><path d="M16 5a3.5 3.5 0 0 1 0 6.5M19 15c2 .8 3 2.4 3 5"/>',
  bag: '<rect x="5" y="8" width="14" height="13" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  snow: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/>',
  baby: '<circle cx="12" cy="9" r="5"/><path d="M9 21c0-3 6-3 6 0M10 9h.01M14 9h.01M10.5 11.5c.9.7 2.1.7 3 0"/>',
  paw: '<circle cx="6" cy="10" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="14" cy="6" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 12c-3 0-5 3-5 5 0 2 2 2.5 5 1.5 3 1 5 .5 5-1.5 0-2-2-5-5-5z"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  nav: '<path d="M3 11l18-8-8 18-2-8z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  wifioff: '<path d="M3 3l18 18M5 12a10 10 0 0 1 4-2.3M2 8a15 15 0 0 1 6-3M12 19h.01M8.5 15.5a5 5 0 0 1 4-1.3"/>',
  motor: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h5l3-7h-3"/><path d="M14 10l-2-4H9"/>',
  box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  taxi: '<path d="M5 16l1.5-6A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><path d="M3 16h18v3H3z"/><path d="M10 5h4v3h-4z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
};
export function ic(name, size = 20, cls = '') {
  const d = P[name] || P.info;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
// علامات الخريطة (HTML داخل divIcon)
export const pinSvg = (color = '#000') => `<svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 37S3 24 3 14a12 12 0 0 1 24 0c0 10-12 23-12 23z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="4.5" fill="#fff"/></svg>`;
export const carSvg = (color = '#000', glyph = 'car') => `<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="${color}" stroke="#fff" stroke-width="2"/><g transform="translate(5 5) scale(.95)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[glyph] || P.car}</g></svg>`;
