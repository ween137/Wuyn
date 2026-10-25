import { esc, latin, toast, errMsg } from './utils.js';
import { ic } from './icons.js';

const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const REASONS = {
  not_customer: 'هذه الخدمة للزبائن فقط.',
  rate_limited: 'محاولات كثيرة. انتظر ساعة ثم حاول مجدداً.',
  no_text: 'لم نستطع قراءة نص كافٍ. صوّر الهوية في إضاءة جيدة وقرّب الكاميرا.',
  bad_number: 'الرقم الوطني يجب أن يكون 11 رقماً. صحّحه ثم أعد المحاولة.',
  not_id_card: 'الصورة لا تبدو هوية سورية. صوّر وجه الهوية الذي عليه الرقم الوطني.',
  number_not_found: 'الرقم الذي كتبته غير موجود في صورة الهوية. تأكد منه أو أعد التصوير.',
  name_too_short: 'اكتب اسمك الكامل كما في الهوية.',
  name_mismatch: 'الاسم لا يطابق الاسم المكتوب على الهوية. اكتبه كما في الهوية.',
  duplicate: 'هذه الهوية مرتبطة بحساب آخر. إن كان هذا خطأ تواصل مع الدعم.',
};

let tessPromise;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return tessPromise ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = TESS; s.crossOrigin = 'anonymous';
    s.onload = () => res(window.Tesseract); s.onerror = () => { tessPromise = null; rej(new Error('تعذر تحميل أداة القراءة. تحقق من الإنترنت.')); };
    document.head.appendChild(s);
  });
}

// تجهيز الصورة: تصغير + تدوير + رمادي + تباين
export async function prepareImage(file, rotate = 0) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('تعذر فتح الصورة.');
  const max = 1800, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
  const swap = rotate % 180 !== 0, c = document.createElement('canvas');
  c.width = swap ? h : w; c.height = swap ? w : h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.translate(c.width / 2, c.height / 2); x.rotate(rotate * Math.PI / 180); x.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close?.();
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data; let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0; d[i] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
  const k = hi > lo ? 255 / (hi - lo) : 1;
  for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, (d[i] - lo) * k)) | 0; d[i] = d[i + 1] = d[i + 2] = g; }
  x.putImageData(img, 0, 0); return c;
}

export function findNationalId(text) {
  const t = latin(text).replace(/(?<=\d)[\s\-.]+(?=\d)/g, '');
  return (t.match(/\d{11}/g) || [])[0] || '';
}

// يفتح شاشة التوثيق. يعيد Promise<boolean> (true إذا تم التوثيق)
export function openKyc({ db, profile }) {
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'overlay'; document.body.appendChild(ov);
    let file = null, rot = 0, canvas = null, ocr = '', worker = null, closed = false;
    const done = ok => { if (closed) return; closed = true; worker?.terminate?.().catch?.(() => {}); ov.remove(); resolve(ok); };

    const head = t => `<header class="top"><button class="icon-btn" data-x aria-label="إغلاق">${ic('close', 22)}</button><div class="ttl">${t}</div><span style="width:40px"></span></header>`;

    function stepIntro() {
      ov.innerHTML = `${head('توثيق الهوية')}<main class="main kyc">
        <div class="kyc-ico">${ic('id', 44)}</div>
        <h2>وثّق هويتك للمتابعة</h2>
        <p class="muted">مرة واحدة فقط. صوّر وجه الهوية السورية الذي عليه الرقم الوطني.</p>
        <ul class="tips"><li>${ic('check', 16)} ضعها على سطح مستوٍ وفي إضاءة جيدة</li><li>${ic('check', 16)} اجعل كل الحواف ظاهرة والنص واضحاً</li><li>${ic('check', 16)} تجنب انعكاس الضوء</li></ul>
        <div class="privacy">${ic('lock', 18)}<span>تُقرأ الصورة داخل هاتفك ولا تُرسل ولا تُحفظ. نحفظ فقط بصمة مشفرة للرقم الوطني لمنع تكرار الحسابات.</span></div>
        <label class="btn full big filebtn">${ic('camera', 20)} تصوير الهوية<input type="file" accept="image/*" capture="environment" hidden data-file></label>
        <label class="btn light full filebtn">${ic('image', 20)} اختيار من الصور<input type="file" accept="image/*" hidden data-file></label>
      </main>`;
      ov.querySelectorAll('[data-file]').forEach(i => i.onchange = () => { file = i.files[0]; if (file) { rot = 0; stepPreview(); } });
    }

    async function stepPreview() {
      ov.innerHTML = `${head('تأكيد الصورة')}<main class="main kyc"><div class="prev" id="prev"><div class="spin"></div></div>
        <div class="row2"><button class="btn light" data-rot>${ic('rotate', 18)} تدوير</button><button class="btn light" data-again>${ic('camera', 18)} صورة أخرى</button></div>
        <button class="btn full big" data-read>${ic('shield', 20)} اقرأ الهوية</button>
        <div id="prog" class="prog hidden"><div class="bar"><i id="bar"></i></div><p id="progtxt" class="small center">جارٍ التحضير…</p></div></main>`;
      try {
        canvas = await prepareImage(file, rot);
        const p = ov.querySelector('#prev'); p.innerHTML = ''; canvas.style.cssText = 'width:100%;height:auto;border-radius:14px'; p.appendChild(canvas);
      } catch (e) { toast(errMsg(e), 'err'); return stepIntro(); }
      ov.querySelector('[data-rot]').onclick = () => { rot = (rot + 90) % 360; stepPreview(); };
      ov.querySelector('[data-again]').onclick = stepIntro;
      ov.querySelector('[data-read]').onclick = async e => {
        const b = e.currentTarget; b.disabled = true; ov.querySelector('#prog').classList.remove('hidden');
        try {
          const T = await loadTesseract();
          worker = await T.createWorker('ara+eng', 1, { logger: m => {
            const bar = ov.querySelector('#bar'), tx = ov.querySelector('#progtxt'); if (!bar) return;
            if (m.status === 'recognizing text') { bar.style.width = Math.round(20 + m.progress * 80) + '%'; tx.textContent = 'نقرأ النص… ' + Math.round(m.progress * 100) + '%'; }
            else { tx.textContent = 'نحمّل أداة القراءة (أول مرة فقط)…'; bar.style.width = '10%'; }
          } });
          const { data } = await worker.recognize(canvas); ocr = data.text || '';
          await worker.terminate(); worker = null; stepReview();
        } catch (x) { toast(errMsg(x), 'err'); b.disabled = false; ov.querySelector('#prog').classList.add('hidden'); }
      };
    }

    function stepReview(err = '') {
      const nid = findNationalId(ocr);
      ov.innerHTML = `${head('راجع البيانات')}<main class="main kyc">
        <p class="muted">راجع ما قرأناه وصحّحه عند الحاجة، ثم أكّد.</p>
        <div id="kerr" class="auth-msg ${err ? 'show' : ''}">${esc(err)}</div>
        <label class="fld"><span>الرقم الوطني (11 رقماً)</span><input id="nid" inputmode="numeric" maxlength="14" dir="ltr" value="${esc(nid)}"></label>
        <label class="fld"><span>الاسم الكامل كما في الهوية</span><input id="nm" maxlength="100" value="${esc(profile?.full_name || '')}"></label>
        <details class="raw"><summary>النص الذي قرأناه</summary><pre>${esc(ocr.trim() || '(فارغ)')}</pre></details>
        <button class="btn full big" data-ok>${ic('shield', 20)} تأكيد التوثيق</button>
        <button class="btn light full" data-again>إعادة التصوير</button></main>`;
      ov.querySelector('[data-again]').onclick = stepIntro;
      ov.querySelector('[data-ok]').onclick = async e => {
        const b = e.currentTarget, id = latin(ov.querySelector('#nid').value).replace(/\D/g, ''), nm = ov.querySelector('#nm').value.trim();
        if (id.length !== 11) return stepReview(REASONS.bad_number);
        b.disabled = true; b.textContent = 'جارٍ التحقق…';
        const { data, error } = await db.rpc('verify_identity', { p_ocr_text: ocr, p_national_id: id, p_full_name: nm || null });
        if (error) { b.disabled = false; b.textContent = 'تأكيد التوثيق'; return stepReview(errMsg(error)); }
        if (data?.ok) { toast('تم توثيق هويتك. يمكنك الآن طلب رحلة', 'ok'); return done(true); }
        const keepId = ov.querySelector('#nid')?.value; stepReview(REASONS[data?.reason] || 'تعذر التوثيق. حاول مرة أخرى.');
        const n = ov.querySelector('#nid'); if (n) n.value = keepId; const m = ov.querySelector('#nm'); if (m) m.value = nm;
      };
    }

    ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) done(false); });
    stepIntro();
  });
}
