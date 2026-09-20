import {
  createLeadConfirmationUrl,
  dispatchConfirmedLead,
  prepareLeadConversion
} from './modules/tracking-core.js';
import { encodeNetlifyForm, postNetlifyForm } from './modules/netlify-forms.js';

const digitMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const phoneInstances = new WeakMap();
const phoneInitializationPromises = new WeakMap();
const isArabic = document.documentElement.lang.startsWith('ar');
let corePromise;
let utilsPromise;
let stylesPromise;

const arabicUiTranslations = {
  selectedCountryAriaLabel: 'تغيير الدولة لرقم الهاتف، المحددة ${countryName} (${dialCode})',
  noCountrySelected: 'اختر دولة لرقم الهاتف',
  countryListAriaLabel: 'قائمة الدول',
  searchPlaceholder: 'ابحث باسم الدولة أو الكود',
  clearSearchAriaLabel: 'مسح البحث',
  searchEmptyState: 'لم يتم العثور على نتائج',
  searchSummaryAria: (count) => count === 0 ? 'لم يتم العثور على نتائج' : `عدد النتائج: ${count}`
};

const toAsciiDigits = (value) => String(value || '').replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit]);
const formTrackingParameters = (form) => ({
  lead_id: form?.elements.namedItem('lead-id')?.value || '',
  attempt_id: form?.elements.namedItem('attempt-id')?.value || form?.dataset.attemptId || '',
  form_name: form?.getAttribute('name') || form?.id || 'unknown',
  form_position: form?.dataset.formPosition || 'unknown',
  service: form?.dataset.service || 'unknown'
});
const findError = (input) => {
  const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  return ids.map((id) => document.getElementById(id)).find((element) => element?.classList.contains('field-error')) || null;
};

function loadStylesheet() {
  if (stylesPromise) return stylesPromise;
  const href = document.body.dataset.phoneCss;
  if (!href) return Promise.resolve();
  stylesPromise = new Promise((resolve, reject) => {
    const existing = [...document.styleSheets].some((sheet) => sheet.href?.endsWith(href));
    if (existing) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error('Phone styles failed to load'));
    document.head.append(link);
  });
  return stylesPromise;
}

function ensureCore() {
  if (!corePromise) {
    corePromise = Promise.all([loadStylesheet(), import('intl-tel-input')])
      .then(([, module]) => module.default)
      .catch(() => null);
  }
  return corePromise;
}

async function ensureUtils() {
  if (!utilsPromise) {
    utilsPromise = ensureCore().then(async (intlTelInput) => {
      if (!intlTelInput) return false;
      await intlTelInput.attachUtils(() => import('intl-tel-input/utils'));
      return true;
    }).catch(() => false);
  }
  return utilsPromise;
}

function resetError(input) {
  input.setCustomValidity('');
  input.setAttribute('aria-invalid', 'false');
  const error = findError(input);
  if (error) error.hidden = true;
}

function validationMessage(input, instance) {
  if (!input.value.trim()) return isArabic ? 'من فضلك اكتب رقم الهاتف' : 'Enter your phone number';
  const code = instance?.getValidationError();
  if (code === 'INVALID_COUNTRY_CODE') return isArabic ? 'اختَر دولة أو كود اتصال صحيحًا' : 'Choose a valid country or calling code';
  if (code === 'TOO_SHORT') return isArabic ? 'رقم الهاتف أقصر من المطلوب لهذه الدولة' : 'This number is too short for the selected country';
  if (code === 'TOO_LONG') return isArabic ? 'رقم الهاتف أطول من المطلوب لهذه الدولة' : 'This number is too long for the selected country';
  return isArabic ? 'من فضلك اكتب رقم هاتف صحيحًا للدولة المختارة' : 'Enter a valid number for the selected country';
}

function initializePhone(input) {
  if (phoneInstances.has(input)) return Promise.resolve(phoneInstances.get(input));
  if (phoneInitializationPromises.has(input)) return phoneInitializationPromises.get(input);

  const initialization = ensureCore().then((intlTelInput) => {
    if (!intlTelInput) return null;
    const instance = intlTelInput(input, {
      initialCountry: (input.dataset.defaultCountry || 'EG').toLowerCase(),
      countryOrder: ['eg', 'sa', 'ae', 'kw', 'qa', 'bh', 'om', 'jo', 'us', 'gb'],
      countryNameLocale: isArabic ? 'ar' : 'en',
      uiTranslations: isArabic ? arabicUiTranslations : {},
      countrySelectorMode: 'AUTO',
      dropdownParent: document.body,
      separateDialCode: true,
      showFlags: true,
      formatAsYouType: true,
      placeholderNumberPolicy: 'AGGRESSIVE',
      placeholderNumberType: 'MOBILE',
      strictMode: true
    });
    phoneInstances.set(input, instance);
    input.closest('[data-phone-shell]')?.classList.add('is-enhanced');
    input.addEventListener('blur', () => {
      if (input.value.trim()) ensureUtils().then((loaded) => loaded && validatePhoneInput(input));
    });
    input.addEventListener('countrychange', () => {
      resetError(input);
      if (input.value.trim()) ensureUtils().then((loaded) => loaded && validatePhoneInput(input));
    });
    return instance;
  }).finally(() => phoneInitializationPromises.delete(input));

  phoneInitializationPromises.set(input, initialization);
  return initialization;
}

function validatePhoneInput(input, normalizeForSubmission = false) {
  if (!input) return false;
  const instance = phoneInstances.get(input);
  if (!instance) return null;
  const valid = Boolean(instance.isValidNumber());
  input.setAttribute('aria-invalid', String(!valid));
  const message = valid ? '' : validationMessage(input, instance);
  input.setCustomValidity(message);
  const error = findError(input);
  if (error) {
    error.textContent = message;
    error.hidden = valid;
  }
  if (!valid) {
    delete input.dataset.e164;
    return false;
  }
  const e164 = toAsciiDigits(instance.getNumber());
  input.dataset.e164 = e164;
  if (normalizeForSubmission) input.value = e164;
  if (!input.dataset.validPhoneTracked) {
    input.dataset.validPhoneTracked = 'true';
    const form = input.closest('form');
    window.trackSiteEvent?.('lead_phone_valid', {
      ...formTrackingParameters(form)
    });
  }
  return true;
}

async function preparePhoneInput(input, normalizeForSubmission = false) {
  if (!input) return { available: false, valid: false, e164: '' };
  const instance = await initializePhone(input);
  if (!instance) {
    resetError(input);
    return { available: false, valid: Boolean(input.value.trim()), e164: '' };
  }
  const utilitiesAvailable = await ensureUtils();
  if (!utilitiesAvailable) {
    resetError(input);
    return { available: false, valid: Boolean(input.value.trim()), e164: '' };
  }
  const valid = validatePhoneInput(input, normalizeForSubmission) === true;
  return { available: true, valid, e164: valid ? input.dataset.e164 || '' : '' };
}

window.validatePhoneInput = validatePhoneInput;
window.preparePhoneInput = preparePhoneInput;
document.querySelectorAll('[data-phone-input]').forEach((input) => {
  const startCore = () => initializePhone(input);
  input.addEventListener('focus', startCore, { once: true });
  input.addEventListener('pointerdown', startCore, { once: true });
  input.addEventListener('input', () => {
    const asciiValue = toAsciiDigits(input.value);
    if (asciiValue !== input.value) input.value = asciiValue;
    initializePhone(input).then(() => ensureUtils()).then((loaded) => {
      if (loaded && input.getAttribute('aria-invalid') === 'true') validatePhoneInput(input);
    });
  });
});

document.querySelectorAll('form[data-netlify="true"] select[name="procedure"]').forEach((select) => {
  const form = select.closest('form');
  const sync = () => { if (form) form.dataset.service = select.value || 'not-sure'; };
  sync();
  select.addEventListener('change', sync);
});

document.querySelectorAll('form[data-netlify="true"]:not([data-managed-form="custom"])').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';
    const phoneInput = form.querySelector('[data-phone-input]');
    const phone = await preparePhoneInput(phoneInput, true);
    if (phone.available && !phone.valid) {
      delete form.dataset.submitting;
      window.trackSiteEvent?.('lead_form_error', {
        ...formTrackingParameters(form),
        field_name: 'phone',
        error_type: 'phone_invalid'
      });
      phoneInput?.focus();
      return;
    }
    window.trackSiteEvent?.('lead_form_submit_attempt', {
      ...formTrackingParameters(form)
    });
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = isArabic ? 'جاري الإرسال…' : 'Sending…';
    }
    const destination = form.action;
    const submission = await postNetlifyForm(encodeNetlifyForm(form));
    if (!submission.confirmed) {
      const conversion = await prepareLeadConversion(form, phone.e164);
      if (conversion.stored) {
        form.action = createLeadConfirmationUrl(destination, conversion.lead);
      }
      form.submit();
      return;
    }
    const conversion = await prepareLeadConversion(form, phone.e164);
    dispatchConfirmedLead(conversion.lead, {
      onComplete: () => window.location.assign(destination)
    });
  });
});
