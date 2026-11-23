// نظام الإحالة: رمز دعوة لكل زبون. المكافأة تُمنح للداعي فقط بعد أول رحلة صحيحة للمدعو
// (≥ 1 كم + PIN صحيح + جهاز مختلف) — التحقق كله في الخادم (finalize_ride).
import { esc, toast, errMsg, money, latin } from './utils.js';
import { ic } from './icons.js';

const SITE = location.origin;
const REASON = { bad_code: 'رمز الدعوة غير صحيح.', self: 'لا يمكنك استخدام رمزك الخاص.', not_new: 'رمز الدعوة للمستخدمين الجدد قبل أول رحلة فقط.', same_device: 'لا يمكن استخدام دعوة من نفس الجهاز.', device_required: 'تعذّر التحقق من الجهاز.' };

export async function openReferral({ db, deviceId }) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<header class="top"><button class="icon-btn" data-x>${ic('back', 22)}</button><div class="ttl">ادعُ صديقاً</div><span style="width:40px"></span></header><div class="page ref-page" style="width:100%;overflow:auto;flex:1"><div class="spin mid"></div></div>`;
  document.body.appendChild(ov); ov.querySelector('[data-x]').onclick = () => ov.remove();
  const body = ov.querySelector('.page');
  try {
    const { data, error } = await db.rpc('my_referral'); if (error) throw error;
    const text = `جرّب تطبيق وين؟ للتنقل في يبرود. استخدم رمز دعوتي ${data.code} داخل التطبيق: ${SITE}`;
    body.innerHTML = `<div class="ref-card"><small>رمز دعوتك</small><b dir="ltr">${esc(data.code)}</b>
      <div class="row2"><button class="btn" data-a="share">${ic('share', 18)} مشاركة</button><button class="btn light" data-a="copy">نسخ الرمز</button></div></div>
      <div class="stats"><div><b>${data.rewarded}</b><small>دعوات مكتملة</small></div><div><b>${data.pending}</b><small>بانتظار أول رحلة</small></div><div><b>${money(data.credit)}</b><small>رصيدك</small></div></div>
      <p class="muted small center">تحصل على رصيد بعد إكمال صديقك أول رحلة صالحة من جهازه (أكثر من 1 كم).</p>
      <h3 class="ph2">لديك رمز دعوة؟</h3>
      <div class="row2"><input id="rc" class="notes" maxlength="12" dir="ltr" placeholder="ABC123" autocapitalize="characters"><button class="btn" data-a="use">تفعيل</button></div>`;
    body.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(data.code); toast('تم نسخ الرمز', 'ok'); } catch { toast(data.code); } }
      else if (b.dataset.a === 'share') { try { if (navigator.share) await navigator.share({ title: 'وين؟', text }); else { await navigator.clipboard.writeText(text); toast('تم نسخ الرسالة', 'ok'); } } catch { } }
      else if (b.dataset.a === 'use') {
        const code = latin(body.querySelector('#rc').value).trim(); if (!code) return;
        b.disabled = true;
        try { const { data: r, error: er } = await db.rpc('use_referral', { p_code: code, p_device_id: await deviceId() }); if (er) throw er; if (r?.ok) toast('تم تفعيل الدعوة. أكمل أول رحلة لتفعيل المكافأة.', 'ok'); else toast(REASON[r?.reason] || 'تعذّر تفعيل الرمز.', 'err'); }
        catch (x) { toast(errMsg(x), 'err'); } finally { b.disabled = false; }
      }
    };
  } catch (e) { body.innerHTML = `<p class="center">${esc(errMsg(e))}</p>`; }
}
