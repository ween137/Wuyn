// أدوات الحساب المشتركة: إشعارات، تثبيت، مشاركة، أسئلة شائعة
import { esc, toast, notifyState, askNotify, notify } from './utils.js';
import { ic } from './icons.js';

const SITE = 'https://wuyn.netlify.app';
const FAQ = {
  customer: [
    ['كيف أطلب سيارة أو توصيل؟', 'من الرئيسية اختر «اطلب سيارة» أو «توصيل طلب»، حدّد النقطتين على الخريطة، فتصلك أسعار المكاتب والسائقين والمتورات وتختار الأنسب.'],
    ['لماذا أحتاج توثيق الهوية؟', 'مرة واحدة فقط لحماية السائقين والزبائن. تُقرأ صورة الهوية داخل هاتفك ولا تُرسل ولا تُحفظ، ونحفظ بصمة مشفرة للرقم فقط.'],
    ['لا أرى سيارات على الخريطة؟', 'تظهر فقط السيارات والمتورات التي فتح أصحابها التطبيق وشغّلوا الموقع. جرّب «الدليل» لرؤية الجميع واتصل بالمكاتب مباشرة.'],
    ['كيف أتواصل مع السائق؟', 'بعد قبول العرض اضغط «رسالة» أو «اتصال». تجد كل محادثاتك في تبويب «الرسائل».'],
    ['كيف أُلغي الطلب؟', 'من شاشة الطلب اضغط «إلغاء». الإلغاء ممكن قبل بدء الرحلة.'],
  ],
  provider: [
    ['كيف تصلني الطلبات؟', 'فعّل «التوفر» و«مشاركة الموقع» وأبقِ التطبيق مفتوحاً. تصلك الطلبات القريبة مع نغمة وإشعار.'],
    ['كيف أحدد سعري؟', 'اكتب سعرك لكل طلب أو اضبط سعراً افتراضياً من حسابي. الزبون يقارن العروض ويختار.'],
    ['لماذا لا أظهر على الخريطة؟', 'يجب أن يكون الموقع يعمل والشاشة مضاءة. البطاقة أعلى الطلبات تخبرك بالسبب بالضبط.'],
    ['كيف أرفع تقييمي؟', 'التزم بالوقت، وراسل الزبون، وكن مهذباً. التقييم يبدأ من 4.0 ويتغير مع كل رحلة.'],
  ],
};

export function extrasHtml() {
  const ns = notifyState(), inst = !!window.__bip, standalone = matchMedia('(display-mode: standalone)').matches;
  const row = (i, t, a, extra = '') => `<button class="menu-row" data-x="${a}">${ic(i, 22)}<span class="grow">${t}</span>${extra}${ic('back', 18, 'chev')}</button>`;
  return `<div class="menu">
    ${ns !== 'unsupported' ? row('bellring', 'الإشعارات', 'notify', `<small class="${ns === 'granted' ? 'g' : ''}">${ns === 'granted' ? 'مفعّلة' : ns === 'denied' ? 'محظورة' : 'غير مفعّلة'}</small>`) : ''}
    ${inst && !standalone ? row('download', 'تثبيت التطبيق على الشاشة', 'install') : ''}
    ${row('share', 'شارك التطبيق مع أصدقائك', 'share')}
    ${row('help', 'الأسئلة الشائعة', 'faq')}</div>`;
}
export async function handleExtra(a, role, rerender) {
  if (a === 'notify') {
    const s = notifyState();
    if (s === 'denied') return toast('الإشعارات محظورة. فعّلها من إعدادات الموقع في المتصفح (أيقونة القفل).', 'err');
    if (s === 'granted') return toast('الإشعارات مفعّلة. ستصلك عندما يكون التطبيق في الخلفية.', 'ok');
    const r = await askNotify(); if (r === 'granted') { toast('تم تفعيل الإشعارات', 'ok'); document.hidden || notify('وين؟', 'الإشعارات تعمل'); } rerender?.();
  } else if (a === 'install') { const e = window.__bip; if (!e) return; e.prompt(); await e.userChoice.catch(() => { }); window.__bip = null; rerender?.(); }
  else if (a === 'share') {
    const data = { title: 'وين؟ تكسي يبرود', text: 'اطلب تكسي أو توصيل في يبرود بسهولة', url: SITE };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(SITE); toast('تم نسخ رابط التطبيق', 'ok'); } } catch { }
  } else if (a === 'faq') openFaq(role);
}
function openFaq(role) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<header class="top"><button class="icon-btn" data-x>${ic('back', 22)}</button><div class="ttl">الأسئلة الشائعة</div><span style="width:40px"></span></header><div class="page" style="width:100%;overflow:auto;flex:1">${(FAQ[role] || FAQ.customer).map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}<p class="center small">للدعم: <a href="tel:0933712979" dir="ltr">0933712979</a></p></div>`;
  document.body.appendChild(ov); ov.querySelector('[data-x]').onclick = () => ov.remove();
}
