// مرسل الموقع للمكاتب والسائقين: watchPosition + إرسال مخفف + منع إطفاء الشاشة
import { toast } from './utils.js';

let st = { watching: false, id: null, last: 0, lastPt: null, wake: null, onState: null, inRide: false, err: null };

export const isSharing = () => st.watching;
export function onState(fn) { st.onState = fn; }
const emit = () => st.onState?.({ sharing: st.watching, err: st.err });

export async function startSharing(db) {
  if (st.watching) return true;
  if (!('geolocation' in navigator)) { st.err = 'unsupported'; emit(); throw new Error('هذا الجهاز لا يدعم تحديد الموقع.'); }
  return new Promise((resolve, reject) => {
    let first = true;
    st.id = navigator.geolocation.watchPosition(async pos => {
      st.err = null;
      if (first) { first = false; st.watching = true; emit(); resolve(true); requestWake(); }
      const now = Date.now(); if (now - st.last < 4000) return; st.last = now;
      const c = pos.coords;
      try {
        const { data } = await db.rpc('report_location', { p_lat: c.latitude, p_lng: c.longitude, p_heading: c.heading ?? null, p_speed: c.speed ?? null, p_accuracy: c.accuracy ?? null });
        st.inRide = !!data?.in_ride; st.lastPt = [c.latitude, c.longitude]; st.onState?.({ sharing: true, inRide: st.inRide, pt: st.lastPt });
      } catch {}
    }, err => {
      st.err = err.code === 1 ? 'denied' : 'unavailable';
      if (first) { first = false; stopWatch(); reject(new Error(err.code === 1 ? 'تم رفض إذن الموقع. فعّله من إعدادات المتصفح ثم أعد المحاولة.' : 'تعذر تحديد موقعك. تأكد من تشغيل GPS.')); }
      else { emit(); }
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  });
}
function stopWatch() {
  if (st.id != null) navigator.geolocation.clearWatch(st.id);
  st.id = null; st.watching = false; releaseWake(); emit();
}
export async function stopSharing(db) {
  const { error } = await db.rpc('stop_location');
  if (error) throw error; // الخادم يمنع الإيقاف أثناء الرحلة
  stopWatch();
}
export function haltLocal() { stopWatch(); }
async function requestWake() { try { st.wake = await navigator.wakeLock?.request('screen'); } catch {} }
function releaseWake() { try { st.wake?.release(); } catch {} st.wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.watching && !st.wake) requestWake(); });
export const lastPoint = () => st.lastPt;
