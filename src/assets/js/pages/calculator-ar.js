// ══════════ STATE ══════════
const state = { rx: null, conditions: new Set(), priority: null };

function goStep(n) {
  if (n === 3) computeResult();
  document.querySelectorAll('.wiz-step').forEach(s => s.classList.remove('active'));
  const activeStep = document.getElementById('step' + n);
  activeStep.classList.add('active');
  for (let i = 1; i <= 3; i++) {
    const wp = document.getElementById('wp' + i);
    wp.classList.remove('active', 'done');
    if (i < n) wp.classList.add('done');
    else if (i === n) wp.classList.add('active');
  }
  document.getElementById('wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const focusTarget = activeStep.querySelector(n === 3 ? '#result-area' : '.wiz-q');
  if (focusTarget) {
    focusTarget.setAttribute('tabindex', '-1');
    window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'estimator_step', { step: n, language: 'ar' });
  }
}

function selectOpt(el, key, value) {
  const parent = el.closest('.opt-grid');
  parent.querySelectorAll('.opt-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  state[key] = value;
  if (key === 'rx') document.getElementById('next1').disabled = false;
}

function toggleChk(el, value) {
  const selected = el.classList.toggle('selected');
  el.setAttribute('aria-pressed', String(selected));
  if (state.conditions.has(value)) state.conditions.delete(value);
  else state.conditions.add(value);
}

// ══════════ RECOMMENDATION ENGINE ══════════
const TECHS = {
  'smile-pro': {
    name: 'سمايل برو',
    nameEn: 'SMILE Pro',
    sub: 'ZEISS VisuMax 800',
    priceMin: 45000, priceMax: 68000,
    pros: ['بدون فلاب — فتحة ٢ مللي بس', 'أقل نسبة جفاف عين', 'الليزر ٨ ثواني للعين', 'ترجع للرياضة تاني يوم'],
    cons: []
  },
  'femto-lasik': {
    name: 'فيمتو ليزك',
    nameEn: 'Femto-LASIK',
    sub: 'فلاب بدون مشرط',
    priceMin: 30000, priceMax: 48000,
    pros: ['فلاب دقيق بالفيمتو سكند', 'تعافي نظري سريع'],
    cons: ['الفلاب مش بيلتئم بالكامل', 'نسبة جفاف عين أعلى']
  },
  'prk': {
    name: 'PRK / إزالة سطحية',
    nameEn: 'PRK',
    sub: 'من غير فلاب، من غير فتحة',
    priceMin: 15000, priceMax: 25000,
    pros: ['من غير فلاب خالص', 'آمن للقرنية الرفيعة', 'الأقل تكلفة'],
    cons: ['تعافي أبطأ (٣–٥ أيام)', 'ألم أكتر بعد العملية']
  },
  'icl': {
    name: 'عدسة ICL داخلية',
    nameEn: 'ICL',
    sub: 'عدسة داخل العين',
    priceMin: 70000, priceMax: 110000,
    pros: ['بتشتغل مع القياسات العالية جداً', 'قابلة للإزالة', 'من غير إزالة أي نسيج من القرنية'],
    cons: ['عملية زرع جراحية', 'أعلى تكلفة']
  }
};

function computeResult() {
  const { rx, conditions, priority } = state;
  const c = conditions;
  let rec, alt;

  if (c.has('keratoconus')) {
    document.getElementById('result-area').innerHTML = `
      <div class="result-badge">لازم تقييم طبيب متخصص</div>
      <div class="result-tech">مفيش ترشيح لعملية أونلاين</div>
      <p class="result-why">وجود قرنية مخروطية أو حتى الاشتباه فيها ما ينفعش يتقيّم بأمان من خلال الحاسبة. لازم تصوير طبوغرافي للقرنية وفحص متخصص قبل مناقشة أي خيار ليزر أو عدسات.</p>
      <div class="price-box">
        <div class="price-range">الفحص أولاً</div>
        <div class="price-note">تحديد عملية أو سعر قبل الفحص المطلوب هيكون غير دقيق.</div>
      </div>
    `;
    document.getElementById('h-tech').value = 'Specialist assessment required';
    document.getElementById('h-rx').value = rx || 'unsure';
    document.getElementById('h-conditions').value = Array.from(conditions).join(', ') || 'none';
    document.getElementById('h-priority').value = priority || 'none';
    document.getElementById('h-price').value = 'Not estimated';
    const assessmentText = encodeURIComponent(
      `أهلاً، استخدمت حاسبة التكلفة واخترت وجود أو اشتباه في قرنية مخروطية.\n\n` +
      `القياس: ${rx || 'مش متأكد'}\n` +
      `الحالة: ${Array.from(conditions).join('، ')}\n\n` +
      `عايز أحجز تصوير للقرنية وفحص مع الطبيب.`
    );
    document.getElementById('wa-results-link').href = `https://wa.me/${document.body.dataset.whatsapp}?text=${assessmentText}`;
    return;
  }
  if (rx === 'high' && (c.has('dry-eyes') || c.has('active'))) { rec = 'smile-pro'; alt = 'icl'; }
  else if (rx === 'high') { rec = 'smile-pro'; alt = 'femto-lasik'; }
  else if (c.has('thin-cornea') && priority === 'lowest-cost') { rec = 'prk'; alt = 'smile-pro'; }
  else if (c.has('thin-cornea')) { rec = 'smile-pro'; alt = 'prk'; }
  else if (c.has('dry-eyes') || c.has('active') || priority === 'no-dryeye') { rec = 'smile-pro'; alt = 'femto-lasik'; }
  else if (priority === 'lowest-cost') { rec = 'femto-lasik'; alt = 'smile-pro'; }
  else { rec = 'smile-pro'; alt = 'femto-lasik'; }

  const R = TECHS[rec];
  const A = TECHS[alt];

  let reason = '';
  if (rec === 'smile-pro') {
    if (c.has('dry-eyes')) reason = 'لأن عندك جفاف أو حساسية في العين، سمايل برو بتحافظ على أعصاب القرنية اللي بتتحكم في الدموع — مثبت طبياً إنها بتسبب جفاف أقل من أي عملية فيها فلاب.';
    else if (c.has('active')) reason = 'لأنك بتمارس رياضة، فتحة سمايل برو الصغيرة (٢ مللي) معناها مفيش فلاب ممكن يتحرك لو خبطت عينك. تقدر ترجع للرياضة تاني يوم.';
    else if (rx === 'high') reason = 'مع قياس نظر عالي، سمايل برو بتعالج مدى واسع من قصر النظر مع الحفاظ على قوة القرنية بشكل أفضل.';
    else reason = 'بناءً على إجاباتك، سمايل برو بتقدم أفضل مزيج من الأمان والسرعة وأقل جفاف عين بأحدث تقنية ZEISS.';
  } else if (rec === 'femto-lasik') {
    reason = 'بناءً على حالتك وأولوية الميزانية، فيمتو ليزك بتديك نتائج ممتازة مع تعافي سريع. هي أكتر عملية ليزك في العالم.';
  } else if (rec === 'prk') {
    reason = 'مع القرنية الرفيعة، PRK هي الخيار الأأمن — من غير فلاب ومن غير فتحة. التعافي بياخد كام يوم زيادة بس العملية مجرّبة وفعالة.';
  } else if (rec === 'icl') {
    reason = 'بناءً على حالة عينك، العدسة الداخلية ممكن تكون الطريق الأأمن. دكتور النجار هيأكد ده بفحص البنتاكام — خيارات الليزر ممكن تكون متاحة برضو.';
  }

  const priceStr = R.priceMin.toLocaleString('ar-EG') + ' – ' + R.priceMax.toLocaleString('ar-EG') + ' جنيه';
  const monthlyMin = Math.round(R.priceMin / 18);

  function feats(tech) {
    let h = '';
    tech.pros.forEach(p => { h += `<div class="cmp-feat pro"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${p}</div>`; });
    tech.cons.forEach(c => { h += `<div class="cmp-feat con"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>${c}</div>`; });
    return h;
  }

  document.getElementById('result-area').innerHTML = `
    <div class="result-badge"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>بناءً على إجاباتك</div>
    <div class="result-tech">${R.name}</div>
    <p class="result-why">${reason}</p>
    <div class="price-box">
      <div class="price-range">${priceStr}</div>
      <div class="price-note">العينين · المتابعة شاملة لمدة ١٢ شهر</div>
      <div class="price-install">تقسيط من ~${monthlyMin.toLocaleString('ar-EG')} جنيه/شهر عن طريق ڤاليو أو بريميوم كارد</div>
    </div>
    <div class="compare-row">
      <div class="cmp-card rec">
        <div class="cmp-card-lbl">خيار لمناقشته مع الطبيب</div>
        <div class="cmp-card-name">${R.name}</div>
        ${feats(R)}
      </div>
      <div class="cmp-card">
        <div class="cmp-card-lbl">بديل محتمل</div>
        <div class="cmp-card-name">${A.name}</div>
        ${feats(A)}
      </div>
    </div>
    <p class="result-why">التقدير ده للمعلومات فقط، ومش تشخيص أو ترشيح علاج. الملاءمة والسعر النهائي محتاجين فحص عين كامل وتصوير للقرنية.</p>
  `;

  document.getElementById('h-tech').value = R.nameEn || R.name;
  document.getElementById('h-rx').value = rx || 'unsure';
  document.getElementById('h-conditions').value = Array.from(conditions).join(', ') || 'none';
  document.getElementById('h-priority').value = priority || 'none';
  document.getElementById('h-price').value = priceStr;

  const waText = encodeURIComponent(
    `أهلاً، أنا لسه استخدمت حاسبة التكلفة على الموقع.\n\n` +
    `النتيجة: ${R.name}\n` +
    `التكلفة التقريبية: ${priceStr}\n` +
    `القياس: ${rx || 'مش متأكد'}\n` +
    `الحالة: ${Array.from(conditions).join('، ') || 'مفيش'}\n\n` +
    `عايز أحجز فحص بنتاكام.`
  );
  document.getElementById('wa-results-link').href = `https://wa.me/${document.body.dataset.whatsapp}?text=${waText}`;
}

// ══════════ FORM SUBMISSION ══════════
const phoneRegex = /^(\+20|0)(10|11|12|15)[0-9]{8}$/;

document.addEventListener('DOMContentLoaded', function () {
  const estimatorForm = document.getElementById('estimator-form');
  if (!estimatorForm) return;

  estimatorForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const phoneInput = document.getElementById('est-phone');
    const phone = phoneInput ? phoneInput.value.replace(/\s+/g, '') : '';
    const errEl = document.getElementById('phone-error');

    if (!phoneRegex.test(phone)) {
      if (errEl) errEl.style.display = 'block';
      if (phoneInput) phoneInput.setAttribute('aria-invalid', 'true');
      return;
    }
    if (errEl) errEl.style.display = 'none';
    if (phoneInput) phoneInput.setAttribute('aria-invalid', 'false');

    const btn = document.getElementById('est-submit-btn');
    if (btn) {
      btn.textContent = 'جاري الإرسال...';
      btn.disabled = true;
    }

    const formData = new FormData(estimatorForm);
    const encodedData = new URLSearchParams(formData).toString();

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodedData
    })
    .then((res) => {
      if (res.ok) {
        window.markLeadConversion?.();
        window.location.href = estimatorForm.getAttribute('action') || '/ar/thank-you.html';
      } else {
        window.markLeadConversion?.();
        estimatorForm.submit();
      }
    })
    .catch(() => {
      window.markLeadConversion?.();
      estimatorForm.submit();
    });
  });
});

// ══════════ STICKY BAR ══════════
const wizardEl = document.getElementById('wizard');
const stickyBarEl = document.getElementById('sticky-bar');
if (wizardEl && stickyBarEl && 'IntersectionObserver' in window) {
  const stickyObs = new IntersectionObserver((entries) => {
    const entry = entries[0];
    const hasPassedWizard = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
    stickyBarEl.classList.toggle('vis', hasPassedWizard);
  }, { threshold: 0 });
  stickyObs.observe(wizardEl);
} else if (stickyBarEl) {
  stickyBarEl.classList.add('vis');
}
