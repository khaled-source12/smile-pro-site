import { encodeNetlifyForm, postNetlifyForm } from '../modules/netlify-forms.js';
import {
  createLeadConfirmationUrl,
  dispatchLeadConversion,
  prepareLeadConversion
} from '../modules/tracking-core.js';

// ══════════ STATE ══════════
const state = { rx: null, conditions: new Set(), priority: null };
const pricingData = JSON.parse(document.getElementById('pricing-data').textContent);
const aftercare = JSON.parse(document.getElementById('aftercare-data').textContent).en;
const TECHS = Object.fromEntries(
  Object.entries(pricingData.treatments)
    .filter(([, treatment]) => treatment.calculator)
    .map(([id, treatment]) => [id, {
      ...treatment.en,
      priceMin: treatment.price_min,
      priceMax: treatment.price_max
    }])
);

// ══════════ STEP NAVIGATION ══════════
function goStep(n) {
  if (n === 3 && !state.priority) {
    document.querySelector('[data-priority-option]')?.focus();
    return;
  }
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
  const scrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  document.getElementById('wizard').scrollIntoView({ behavior: scrollBehavior, block: 'start' });
  const focusTarget = activeStep.querySelector(n === 3 ? '#result-area' : '.wiz-q');
  if (focusTarget) {
    focusTarget.setAttribute('tabindex', '-1');
    window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }

  window.trackSiteEvent?.('estimator_step', { step: n });
}

// ══════════ OPTION SELECT (radio-style) ══════════
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

// ══════════ CHECKBOX TOGGLE ══════════
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

  if (c.has('keratoconus')) {
    rec = 'icl'; alt = 'prk';
  }
  else if (rx === 'extreme') {
    rec = 'icl'; alt = 'smile-pro';
  }
  else if (rx === 'high' && (c.has('dry-eyes') || c.has('active'))) {
    rec = 'smile-pro'; alt = 'icl';
  }
  else if (rx === 'high') {
    rec = 'smile-pro'; alt = 'femto-lasik';
  }
  else if (c.has('thin-cornea') && priority === 'lowest-cost') {
    rec = 'prk'; alt = 'smile-pro';
  }
  else if (c.has('thin-cornea')) {
    rec = 'smile-pro'; alt = 'prk';
  }
  else if (c.has('dry-eyes') || c.has('active') || priority === 'no-dryeye') {
    rec = 'smile-pro'; alt = 'femto-lasik';
  }
  else if (priority === 'lowest-cost') {
    rec = 'prk'; alt = 'femto-lasik';
  }
  else {
    rec = 'smile-pro'; alt = 'femto-lasik';
  }

  const R = TECHS[rec];
  const A = TECHS[alt];
  window.trackSiteEvent?.('estimator_result', { recommended_treatment: rec, alternative_treatment: alt });

  // Reason text
  let reason = '';
  if (rec === 'smile-pro') {
    if (c.has('dry-eyes')) reason = 'Because you reported dry or sensitive eyes, SMILE Pro may be considered because its flapless approach disrupts fewer corneal nerves than flap-based procedures. The examination still needs to assess the cause and severity of the dryness.';
    else if (c.has('active')) reason = `For an active lifestyle, SMILE Pro avoids creating a corneal flap. Return timing still depends on healing: light exercise ${aftercare.light_exercise}; swimming ${aftercare.swimming}; and contact sports ${aftercare.contact_sports}.`;
    else if (rx === 'high') reason = 'With a higher prescription, SMILE Pro\'s precision lenticule extraction treats the full range of myopia with superior corneal strength preservation.';
    else reason = 'Based on your profile, SMILE Pro offers the best combination of safety, speed, and minimal dry eye risk with the latest ZEISS technology.';
  } else if (rec === 'femto-lasik') {
    reason = 'For your profile and budget priority, Femto-LASIK delivers excellent results with fast recovery. It\'s the most popular laser eye surgery worldwide.';
  } else if (rec === 'prk') {
    reason = 'Because keeping the cost low is your priority, PRK is the most affordable option in the current price guide. It avoids a corneal flap, but recovery takes a few extra days and the examination must still confirm that it is suitable for your eyes.';
  } else if (rec === 'icl') {
    reason = c.has('keratoconus')
      ? 'Because you selected diagnosed or suspected keratoconus, ICL is the initial recommendation from this calculator because it does not remove corneal tissue. Corneal tomography and a complete specialist examination are still required to confirm the diagnosis and final treatment.'
      : 'For the very high prescription range you selected, ICL is the initial treatment recommendation because it can correct high myopia without removing corneal tissue. The examination must still confirm prescription stability and that there is enough space inside the eye; a laser option may still be possible.';
  }

  const priceStr = R.priceMin.toLocaleString('en-EG') + ' – ' + R.priceMax.toLocaleString('en-EG') + ' EGP';
  const monthlyMin = Math.round(R.priceMin / pricingData.installment_months);

  // Build comparison cards
  function feats(tech, isRec) {
    let h = '';
    tech.pros.forEach(p => { h += `<div class="cmp-feat pro"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${p}</div>`; });
    tech.cons.forEach(c => { h += `<div class="cmp-feat con"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>${c}</div>`; });
    return h;
  }

  document.getElementById('result-area').innerHTML = `
    <div class="result-badge"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Based on your answers</div>
    <div class="result-tech">${R.name}</div>
    <p class="result-why">${reason}</p>
    <div class="price-box">
      <div class="price-range">${priceStr}</div>
      <div class="price-note">Both eyes · all follow-ups included for 12 months</div>
      <div class="price-install">Instalments from ~${monthlyMin.toLocaleString('en-EG')} EGP/month via ValU or Premium Card</div>
    </div>
  `;

  document.getElementById('result-details').innerHTML = `
    <div class="compare-row">
      <div class="cmp-card rec">
        <div class="cmp-card-lbl">Initial treatment recommendation</div>
        <div class="cmp-card-name">${R.name}</div>
        ${feats(R, true)}
      </div>
      <div class="cmp-card">
        <div class="cmp-card-lbl">Possible alternative</div>
        <div class="cmp-card-name">${A.name}</div>
        ${feats(A, false)}
      </div>
    </div>
    <p class="result-why">This is a preliminary treatment recommendation based on your answers, not a diagnosis. Eligibility and final price require a complete eye examination and corneal imaging.</p>
  `;

  // Set hidden fields
  document.getElementById('h-tech').value = R.name;
  document.getElementById('h-rx').value = rx || 'unsure';
  document.getElementById('h-conditions').value = Array.from(conditions).join(', ') || 'none';
  document.getElementById('h-priority').value = priority || 'none';
  document.getElementById('h-price').value = priceStr;
  const procedureSelect = document.querySelector('#estimator-form select[name="procedure"]');
  if (procedureSelect) {
    procedureSelect.value = rec;
    procedureSelect.dispatchEvent(new Event('change'));
  }

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

window.goStep = goStep;
window.selectOpt = selectOpt;
window.toggleChk = toggleChk;

// ══════════ FORM HANDLING ══════════
document.getElementById('estimator-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (this.dataset.submitting === 'true') return;
  this.dataset.submitting = 'true';
  const phoneInput = document.getElementById('est-phone');
  const phone = await window.preparePhoneInput?.(phoneInput, true);
  if (phone?.available && !phone.valid) {
    delete this.dataset.submitting;
    window.trackSiteEvent?.('lead_form_error', {
      lead_id: this.elements.namedItem('lead-id')?.value || '',
      attempt_id: this.elements.namedItem('attempt-id')?.value || this.dataset.attemptId || '',
      form_name: this.getAttribute('name') || this.id || 'unknown',
      form_position: this.dataset.formPosition || 'unknown',
      service: this.dataset.service || 'unknown',
      field_name: 'phone',
      error_type: 'phone_invalid'
    });
    phoneInput?.focus();
    return;
  }

  window.trackSiteEvent?.('lead_form_submit_attempt', {
    lead_id: this.elements.namedItem('lead-id')?.value || '',
    attempt_id: this.elements.namedItem('attempt-id')?.value || this.dataset.attemptId || '',
    form_name: this.getAttribute('name') || this.id || 'unknown',
    form_position: this.dataset.formPosition || 'unknown',
    service: this.dataset.service || 'unknown'
  });

  const btn = this.querySelector('button[type="submit"]');
  btn.textContent = 'Booking...';
  btn.disabled = true;

  const destination = this.action || '/thank-you/';
  const submission = await postNetlifyForm(encodeNetlifyForm(this));
  if (!submission.confirmed) {
    const conversion = await prepareLeadConversion(this, phone?.e164 || '');
    if (conversion.stored) {
      this.action = createLeadConfirmationUrl(destination, conversion.lead);
    }
    this.submit();
    return;
  }
  const conversion = await prepareLeadConversion(this, phone?.e164 || '');
  if (conversion.stored) {
    window.location.assign(createLeadConfirmationUrl(destination, conversion.lead));
    return;
  }
  dispatchLeadConversion(conversion.lead, {
    onComplete: () => window.location.assign(destination)
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
