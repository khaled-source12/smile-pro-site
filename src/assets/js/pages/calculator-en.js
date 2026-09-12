// ══════════ STATE ══════════
const state = { rx: null, conditions: new Set(), priority: null };

// ══════════ STEP NAVIGATION ══════════
function goStep(n) {
  // Compute result when entering step 3
  if (n === 3) computeResult();

  document.querySelectorAll('.wiz-step').forEach(s => s.classList.remove('active'));
  const activeStep = document.getElementById('step' + n);
  activeStep.classList.add('active');

  // Progress bar
  for (let i = 1; i <= 3; i++) {
    const wp = document.getElementById('wp' + i);
    wp.classList.remove('active', 'done');
    if (i < n) wp.classList.add('done');
    else if (i === n) wp.classList.add('active');
  }

  // Scroll wizard into view
  document.getElementById('wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const focusTarget = activeStep.querySelector(n === 3 ? '#result-area' : '.wiz-q');
  if (focusTarget) {
    focusTarget.setAttribute('tabindex', '-1');
    window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'estimator_step', { step: n });
  }
}

// ══════════ OPTION SELECT (radio-style) ══════════
function selectOpt(el, key, value) {
  const parent = el.closest('.opt-grid');
  parent.querySelectorAll('.opt-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  state[key] = value;
  // Enable next button on step 1
  if (key === 'rx') document.getElementById('next1').disabled = false;
}

// ══════════ CHECKBOX TOGGLE ══════════
function toggleChk(el, value) {
  const selected = el.classList.toggle('selected');
  el.setAttribute('aria-pressed', String(selected));
  if (state.conditions.has(value)) state.conditions.delete(value);
  else state.conditions.add(value);
}

// ══════════ RECOMMENDATION ENGINE ══════════
const TECHS = {
  'smile-pro': {
    name: 'SMILE Pro',
    sub: 'ZEISS VisuMax 800',
    priceMin: 45000, priceMax: 68000,
    pros: ['Flapless — 2mm micro-incision', 'Lowest dry eye risk', '8-second laser per eye', 'Back to sports next day'],
    cons: []
  },
  'femto-lasik': {
    name: 'Femto-LASIK',
    sub: 'Blade-free flap',
    priceMin: 30000, priceMax: 48000,
    pros: ['Precise femtosecond flap', 'Fast visual recovery'],
    cons: ['Flap never fully heals', 'Higher dry eye risk']
  },
  'prk': {
    name: 'PRK / Surface Ablation',
    sub: 'No flap, no incision',
    priceMin: 15000, priceMax: 25000,
    pros: ['No flap at all', 'Safe for thin corneas', 'Most affordable'],
    cons: ['Slower recovery (3–5 days)', 'More post-op discomfort']
  },
  'icl': {
    name: 'ICL (Implantable Lens)',
    sub: 'Phakic intraocular lens',
    priceMin: 70000, priceMax: 110000,
    pros: ['Works for extreme prescriptions', 'Reversible', 'No corneal tissue removed'],
    cons: ['Surgical implant', 'Highest cost']
  }
};

function computeResult() {
  const { rx, conditions, priority } = state;
  const c = conditions;
  let rec, alt;

  // Possible or diagnosed keratoconus cannot be triaged safely online.
  if (c.has('keratoconus')) {
    document.getElementById('result-area').innerHTML = `
      <div class="result-badge">Specialist assessment required</div>
      <div class="result-tech">No online procedure recommendation</div>
      <p class="result-why">Possible or diagnosed keratoconus cannot be assessed safely with this calculator. Corneal tomography and a specialist examination are required before discussing any laser or lens option.</p>
      <div class="price-box">
        <div class="price-range">Assessment first</div>
        <div class="price-note">A treatment or price estimate would be misleading before the required examination.</div>
      </div>
    `;
    document.getElementById('h-tech').value = 'Specialist assessment required';
    document.getElementById('h-rx').value = rx || 'unsure';
    document.getElementById('h-conditions').value = Array.from(conditions).join(', ') || 'none';
    document.getElementById('h-priority').value = priority || 'none';
    document.getElementById('h-price').value = 'Not estimated';
    const assessmentText = encodeURIComponent(
      `Hello, I used the cost estimator and selected possible or diagnosed keratoconus.\n\n` +
      `Prescription: ${rx || 'unsure'}\n` +
      `Conditions: ${Array.from(conditions).join(', ')}\n\n` +
      `I'd like to book a corneal tomography and specialist assessment.`
    );
    document.getElementById('wa-results-link').href = `https://wa.me/${document.body.dataset.whatsapp}?text=${assessmentText}`;
    return;
  }
  // Extreme myopia
  if (rx === 'high' && (c.has('dry-eyes') || c.has('active'))) {
    rec = 'smile-pro'; alt = 'icl';
  }
  else if (rx === 'high') {
    rec = 'smile-pro'; alt = 'femto-lasik';
  }
  // Thin cornea
  else if (c.has('thin-cornea') && priority === 'lowest-cost') {
    rec = 'prk'; alt = 'smile-pro';
  }
  else if (c.has('thin-cornea')) {
    rec = 'smile-pro'; alt = 'prk';
  }
  // Dry eyes or active
  else if (c.has('dry-eyes') || c.has('active') || priority === 'no-dryeye') {
    rec = 'smile-pro'; alt = 'femto-lasik';
  }
  // Lowest cost priority
  else if (priority === 'lowest-cost') {
    rec = 'femto-lasik'; alt = 'smile-pro';
  }
  // Default: fast recovery / standard profile
  else {
    rec = 'smile-pro'; alt = 'femto-lasik';
  }

  const R = TECHS[rec];
  const A = TECHS[alt];

  // Reason text
  let reason = '';
  if (rec === 'smile-pro') {
    if (c.has('dry-eyes')) reason = 'Because you have dry or sensitive eyes, SMILE Pro\'s flapless approach preserves the corneal nerves that control tear production — clinically proven to cause less dryness than any flap-based procedure.';
    else if (c.has('active')) reason = 'For your active lifestyle, SMILE Pro\'s 2mm micro-incision means no flap that could shift on impact. You\'re cleared for sports the next day.';
    else if (rx === 'high') reason = 'With a higher prescription, SMILE Pro\'s precision lenticule extraction treats the full range of myopia with superior corneal strength preservation.';
    else reason = 'Based on your profile, SMILE Pro offers the best combination of safety, speed, and minimal dry eye risk with the latest ZEISS technology.';
  } else if (rec === 'femto-lasik') {
    reason = 'For your profile and budget priority, Femto-LASIK delivers excellent results with fast recovery. It\'s the most popular laser eye surgery worldwide.';
  } else if (rec === 'prk') {
    reason = 'With thin corneas, PRK is the safest laser option — no flap, no incision. Recovery takes a few extra days but it\'s proven and effective.';
  } else if (rec === 'icl') {
    reason = 'Based on your eye profile, an implantable lens may be the safest route. Dr. El Naggar will confirm this with your Pentacam scan — laser options may still be possible.';
  }

  const priceStr = R.priceMin.toLocaleString('en-EG') + ' – ' + R.priceMax.toLocaleString('en-EG') + ' EGP';
  const monthlyMin = Math.round(R.priceMin / 18);

  // Build comparison cards
  function feats(tech, isRec) {
    let h = '';
    tech.pros.forEach(p => { h += `<div class="cmp-feat pro"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${p}</div>`; });
    tech.cons.forEach(c => { h += `<div class="cmp-feat con"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>${c}</div>`; });
    return h;
  }

  document.getElementById('result-area').innerHTML = `
    <div class="result-badge"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Based on your answers</div>
    <div class="result-tech">${R.name}</div>
    <p class="result-why">${reason}</p>
    <div class="price-box">
      <div class="price-range">${priceStr}</div>
      <div class="price-note">Both eyes · all follow-ups included for 12 months</div>
      <div class="price-install">Instalments from ~${monthlyMin.toLocaleString('en-EG')} EGP/month via ValU or Premium Card</div>
    </div>
    <div class="compare-row">
      <div class="cmp-card rec">
        <div class="cmp-card-lbl">Option to discuss</div>
        <div class="cmp-card-name">${R.name}</div>
        ${feats(R, true)}
      </div>
      <div class="cmp-card">
        <div class="cmp-card-lbl">Possible alternative</div>
        <div class="cmp-card-name">${A.name}</div>
        ${feats(A, false)}
      </div>
    </div>
    <p class="result-why">This estimate is informational, not a diagnosis or treatment recommendation. Eligibility and final price require a complete eye examination and corneal tomography.</p>
  `;

  // Set hidden fields
  document.getElementById('h-tech').value = R.name;
  document.getElementById('h-rx').value = rx || 'unsure';
  document.getElementById('h-conditions').value = Array.from(conditions).join(', ') || 'none';
  document.getElementById('h-priority').value = priority || 'none';
  document.getElementById('h-price').value = priceStr;

  // WhatsApp link with results
  const waText = encodeURIComponent(
    `Hello, I just used the cost estimator on your website.\n\n` +
    `My result: ${R.name}\n` +
    `Estimated cost: ${priceStr}\n` +
    `Prescription: ${rx || 'unsure'}\n` +
    `Conditions: ${Array.from(conditions).join(', ') || 'none'}\n\n` +
    `I'd like to book a Pentacam assessment.`
  );
  document.getElementById('wa-results-link').href = `https://wa.me/${document.body.dataset.whatsapp}?text=${waText}`;
}

// ══════════ FORM HANDLING ══════════
const phoneRegex = /^(\+20|0)(10|11|12|15)[0-9]{8}$/;

document.getElementById('estimator-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const phone = document.getElementById('est-phone').value.replace(/\s+/g, '');
  const errEl = document.getElementById('phone-error');

  if (!phoneRegex.test(phone)) {
    errEl.style.display = 'block';
    document.getElementById('est-phone').setAttribute('aria-invalid', 'true');
    return;
  }
  errEl.style.display = 'none';
  document.getElementById('est-phone').setAttribute('aria-invalid', 'false');

  const btn = this.querySelector('button[type="submit"]');
  btn.textContent = 'Booking...';
  btn.disabled = true;

  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(this)).toString()
  })
  .then((response) => {
    if (response.ok) {
      window.markLeadConversion?.();
      window.location.href = this.getAttribute('action') || '/thank-you.html';
    } else {
      window.markLeadConversion?.();
      this.submit();
    }
  })
  .catch(() => {
    window.markLeadConversion?.();
    this.submit();
  });
});

// ══════════ STICKY BAR — show after scrolling past wizard ══════════
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
