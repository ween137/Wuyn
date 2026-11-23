// بصمة الجهاز الدائمة (device_id) + قراءة الموقع الحيّ + كشف محاكاة الموقع (جهد أفضل من جهة العميل).
// المعرّف عشوائي ويُحفظ في localStorage وIndexedDB وcookie معاً ويُسترجع من أي منها إذا مُسح الآخران.
const KEY = 'wuyn-did', IDB = 'wuyn-dev', ST = 'k', DAY = 86400;
const valid = v => typeof v === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(v);
const rnd = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return 'd' + btoa(String.fromCharCode(...a)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c])); };
let cached = null, lastFix = null;

const idb = (mode, fn) => new Promise(res => {
  try {
    const o = indexedDB.open(IDB, 1);
    o.onupgradeneeded = () => o.result.createObjectStore(ST);
    o.onerror = () => res(null);
    o.onsuccess = () => {
      try { const tx = o.result.transaction(ST, mode), r = fn(tx.objectStore(ST)); tx.oncomplete = () => { res(r?.result ?? null); o.result.close(); }; tx.onerror = () => res(null); } catch { res(null); }
    };
  } catch { res(null); }
});
const getCookie = () => { try { const m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=([^;]+)')); return m ? m[1] : null; } catch { return null; } };

export async function deviceId() {
  if (cached) return cached;
  let id = null;
  try { id = localStorage.getItem(KEY); } catch { }
  if (!valid(id)) id = getCookie();
  if (!valid(id)) id = await idb('readonly', s => s.get(KEY));
  if (!valid(id)) id = rnd();
  cached = id;
  try { localStorage.setItem(KEY, id); } catch { }
  try { document.cookie = KEY + '=' + id + '; max-age=' + 400 * DAY + '; path=/; SameSite=Lax; Secure'; } catch { }
  idb('readwrite', s => s.put(id, KEY));
  return id;
}

// يُرجع {lat,lng,accuracy,mock} أو null إن تعذّر
export function livePos(timeout = 10000) {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => {
      const c = p.coords, now = Date.now(); let mock = false;
      if (navigator.webdriver === true || p.mocked === true || c.mocked === true) mock = true;
      if (c.accuracy === 0) mock = true;
      if (lastFix) { const dt = (now - lastFix.t) / 1000; if (dt > 0 && dt < 600 && hav(lastFix.lat, lastFix.lng, c.latitude, c.longitude) / dt > 83) mock = true; }
      lastFix = { lat: c.latitude, lng: c.longitude, t: now };
      res({ lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, mock });
    }, () => res(null), { enableHighAccuracy: true, timeout, maximumAge: 15000 });
  });
}
function hav(a, b, c, d) { const R = 6371000, r = x => x * Math.PI / 180, dl = r(c - a), dg = r(d - b); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

// يربط الجهاز بالحساب ويُرجع حالة الحارس: ok | identity_required | banned
export async function registerDevice(db) {
  try { const { data } = await db.rpc('register_device', { p_device_id: await deviceId() }); return data?.state || 'ok'; } catch { return 'ok'; }
}
