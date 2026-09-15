// ══════════ STATE ══════════
const state = { rx: null, conditions: new Set(), priority: null };
const pricingData = JSON.parse(document.getElementById('pricing-data').textContent);
const aftercare = JSON.parse(document.getElementById('aftercare-data').textContent).ar;
const TECHS = Object.fromEntries(
  Object.entries(pricingData.treatments)
    .filter(([, treatment]) => treatment.calculator)
    .map(([id, treatment]) => [id, {
      ...treatment.ar,
      nameEn: treatment.ar.name_en,
      priceMin: treatment.price_min,
      priceMax: treatment.price_max
    }])
);

function goStep(n) {
  if (n === 3 && !state.priority) {
    document.querySelector('[data-priority-option]')?.focus();
    return;
  }
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
  const scrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  document.getElementById('wizard').scrollIntoView({ behavior: scrollBehavior, block: 'start' });
  const focusTarget = activeStep.querySelector(n === 3 ? '#result-area' : '.wiz-q');
  if (focusTarget) {
    focusTarget.setAttribute('tabindex', '-1');
    window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
  window.trackSiteEvent?.('estimator_step', { step: n });
}

function selectOpt(el, key, value) {
  const wizard = document.getElementById('wizard');
  if (wizard && !wizard.dataset.trackingStarted) {
    wizard.dataset.trackingStarted = 'true';
    window.trackSiteEvent?.('estimator_start');
  }
  const parent = el.closest('.opt-grid');
  parent.querySelectorAll('.opt-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  state[key] = value;
  if (key === 'rx') {
    document.getElementById('next1').disabled = false;
    goStep(2);
  }
  if (key === 'priority') {
    document.getElementById('next2').disabled = false;
    goStep(3);
  }
}

function toggleChk(el, value) {
  const selected = el.classList.toggle('selected');
  el.setAttribute('aria-pressed', String(selected));
  if (state.conditions.has(value)) state.conditions.delete(value);
  else state.conditions.add(value);
}

function computeResult() {
  const { rx, conditions, priority } = state;
  const c = conditions;
  let rec, alt;

  if (c.has('keratoconus')) { rec = 'icl'; alt = 'prk'; }
  else if (rx === 'extreme') { rec = 'icl'; alt = 'smile-pro'; }
  else if (rx === 'high' && (c.has('dry-eyes') || c.has('active'))) { rec = 'smile-pro'; alt = 'icl'; }
  else if (rx === 'high') { rec = 'smile-pro'; alt = 'femto-lasik'; }
  else if (c.has('thin-cornea') && priority === 'lowest-cost') { rec = 'prk'; alt = 'smile-pro'; }
  else if (c.has('thin-cornea')) { rec = 'smile-pro'; alt = 'prk'; }
  else if (c.has('dry-eyes') || c.has('active') || priority === 'no-dryeye') { rec = 'smile-pro'; alt = 'femto-lasik'; }
  else if (priority === 'lowest-cost') { rec = 'prk'; alt = 'femto-lasik'; }
  else { rec = 'smile-pro'; alt = 'femto-lasik'; }

  const R = TECHS[rec];
  const A = TECHS[alt];
  window.trackSiteEvent?.('estimator_result', { recommended_treatment: rec, alternative_treatment: alt });

  let reason = '';
  if (rec === 'smile-pro') {
    if (c.has('dry-eyes')) reason = 'لأنك ذكرت وجود جفاف أو حساسية، ممكن نفكر في سمايل برو لأنها لا تنشئ فلاب وتؤثر على أعصاب قرنية أقل من العمليات التي تستخدم فلاب. الفحص لازم يحدد سبب الجفاف ودرجته أولًا.';
    else if (c.has('active')) reason = `لأنك بتمارس رياضة، سمايل برو لا تنشئ فلاب في القرنية. توقيت الرجوع بيعتمد على الالتئام: الرياضة الخفيفة ${aftercare.light_exercise}، والسباحة ${aftercare.swimming}، والرياضات الالتحامية ${aftercare.contact_sports}.`;
    else if (rx === 'high') reason = 'مع قياس نظر عالي، سمايل برو بتعالج مدى واسع من قصر النظر مع الحفاظ على قوة القرنية بشكل أفضل.';
    else reason = 'بناءً على إجاباتك، سمايل برو بتقدم أفضل مزيج من الأمان والسرعة وأقل جفاف عين بأحدث تقنية ZEISS.';
  } else if (rec === 'femto-lasik') {
    reason = 'بناءً على حالتك وأولوية الميزانية، فيمتو ليزك بتديك نتائج ممتازة مع تعافي سريع. هي أكتر عملية ليزك في العالم.';
  } else if (rec === 'prk') {
    reason = 'لأن أقل تكلفة هي أولويتك، PRK هي الاختيار الأقل سعراً في دليل الأسعار الحالي. العملية من غير فلاب، لكن التعافي بياخد كام يوم زيادة، والفحص لازم يتأكد إنها مناسبة لعينيك.';
  } else if (rec === 'icl') {
    reason = c.has('keratoconus')
      ? 'لأنك اخترت وجود أو اشتباه في قرنية مخروطية، عدسة ICL هي الترشيح الأولي من الحاسبة لأنها لا تزيل نسيجًا من القرنية. لازم تصوير القرنية وفحص متخصص كامل لتأكيد التشخيص والعلاج النهائي.'
      : 'مع نطاق القياس العالي جداً اللي اخترته، عدسة ICL هي الترشيح العلاجي الأولي لأنها بتصحح قصر النظر العالي من غير إزالة نسيج من القرنية. الفحص لازم يتأكد من ثبات القياس ووجود مساحة كافية داخل العين، وممكن يفضل خيار ليزر متاح.';
  }

  const priceStr = R.priceMin.toLocaleString('ar-EG') + ' – ' + R.priceMax.toLocaleString('ar-EG') + ' جنيه';
  const monthlyMin = Math.round(R.priceMin / pricingData.installment_months);

  function feats(tech) {
    let h = '';
    tech.pros.forEach(p => { h += `<div class="cmp-feat pro"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${p}</div>`; });
    tech.cons.forEach(c => { h += `<div class="cmp-feat con"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>${c}</div>`; });
    return h;
  }

  document.getElementById('result-area').innerHTML = `
    <div class="result-badge"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>بناءً على إجاباتك</div>
    <div class="result-tech">${R.name}</div>
    <p class="result-why">${reason}</p>
    <div class="price-box">
      <div class="price-range">${priceStr}</div>
      <div class="price-note">العينين · المتابعة شاملة لمدة ١٢ شهر</div>
      <div class="price-install">تقسيط من ~${monthlyMin.toLocaleString('ar-EG')} جنيه/شهر عن طريق ڤاليو أو بريميوم كارد</div>
    </div>
  `;

  document.getElementById('result-details').innerHTML = `
    <div class="compare-row">
      <div class="cmp-card rec">
        <div class="cmp-card-lbl">الترشيح العلاجي الأولي</div>
        <div class="cmp-card-name">${R.name}</div>
        ${feats(R)}
      </div>
      <div class="cmp-card">
        <div class="cmp-card-lbl">بديل محتمل</div>
        <div class="cmp-card-name">${A.name}</div>
        ${feats(A)}
      </div>
    </div>
    <p class="result-why">ده ترشيح علاجي أولي بناءً على إجاباتك، ومش تشخيص. الملاءمة والسعر النهائي محتاجين فحص عين كامل وتصوير للقرنية.</p>
  `;

  document.getElementById('h-tech').value = R.nameEn || R.name;
  document.getElementById('h-rx').value = rx || 'unsure';
  document.getElementById('h-conditions').value = Array.from(conditions).join(', ') || 'none';
  document.getElementById('h-priority').value = priority || 'none';
  document.getElementById('h-price').value = priceStr;
  const procedureSelect = document.querySelector('#estimator-form select[name="procedure"]');
  if (procedureSelect) {
    procedureSelect.value = rec;
    procedureSelect.dispatchEvent(new Event('change'));
  }

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

window.goStep = goStep;
window.selectOpt = selectOpt;
window.toggleChk = toggleChk;

// ══════════ FORM SUBMISSION ══════════
document.addEventListener('DOMContentLoaded', function () {
  const estimatorForm = document.getElementById('estimator-form');
  if (!estimatorForm) return;

  estimatorForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const phoneInput = document.getElementById('est-phone');
    const phone = await window.preparePhoneInput?.(phoneInput, true);
    if (phone?.available && !phone.valid) {
      phoneInput?.focus();
      return;
    }

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
        window.markLeadConversion?.(estimatorForm);
        window.location.href = estimatorForm.getAttribute('action') || '/ar/thank-you/';
      } else {
        window.markLeadConversion?.(estimatorForm);
        estimatorForm.submit();
      }
    })
    .catch(() => {
      window.markLeadConversion?.(estimatorForm);
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
