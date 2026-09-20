import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  ATTRIBUTION_STORAGE_KEY,
  LEAD_CONFIRMATION_CAPTURE_KEY,
  LEAD_CONFIRMATION_PARAMETER,
  PENDING_LEAD_STORAGE_KEY,
  TRACKING_SCHEMA_VERSION,
  buildEventEnvelope,
  captureLeadConfirmationToken,
  createAttributionSnapshot,
  createLeadConfirmationUrl,
  createPendingLead,
  createPhoneHashes,
  dispatchConfirmedLead,
  dispatchLeadConversion,
  getAttribution,
  markLeadDispatched,
  normalizePhoneForTracking,
  readCampaignParameters,
  readPendingLead,
  refreshTrackingAttribution,
  storePendingLead,
  syncFormAttribution,
  updateAttributionRecord
} from '../src/assets/js/modules/tracking-core.js';
import { encodeNetlifyForm, postNetlifyForm } from '../src/assets/js/modules/netlify-forms.js';

const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

for (const fixture of [
  '+201012345678',
  '+14155552671',
  '+442079460018',
  '+971501234567'
]) {
  const normalized = normalizePhoneForTracking(fixture);
  assert.deepEqual(normalized, { e164: fixture, digits: fixture.slice(1) });
  const hashes = await createPhoneHashes(fixture);
  assert.equal(hashes.phone_sha256_e164, hash(fixture));
  assert.equal(hashes.phone_sha256_digits, hash(fixture.slice(1)));
  assert.match(hashes.phone_sha256_e164, /^[a-f0-9]{64}$/);
  assert.match(hashes.phone_sha256_digits, /^[a-f0-9]{64}$/);
}
for (const invalid of ['01012345678', '+0123456789', '+123', '+1234567890123456', '']) {
  assert.equal(normalizePhoneForTracking(invalid), null);
  assert.equal(await createPhoneHashes(invalid), null);
}

const successfulPost = await postNetlifyForm('form-name=test', async (_url, options) => ({
  ok: options.method === 'POST' && options.body === 'form-name=test',
  status: 200
}));
assert.deepEqual(successfulPost, { confirmed: true, status: 200 });
assert.deepEqual(
  await postNetlifyForm('form-name=test', async () => ({ ok: false, status: 500 })),
  { confirmed: false, status: 500 }
);
assert.deepEqual(
  await postNetlifyForm('form-name=test', async () => { throw new Error('offline'); }),
  { confirmed: false, status: 0 }
);

assert.deepEqual(
  readCampaignParameters('?GCLID=google&ScCid=snap&TTCLID=tiktok&oppref=openai&wbraid=w&gbraid=g'),
  { gclid: 'google', sccid: 'snap', ttclid: 'tiktok', oppref: 'openai', wbraid: 'w', gbraid: 'g' }
);

const start = Date.UTC(2026, 0, 1);
const first = createAttributionSnapshot({
  pathname: '/ar/',
  search: '',
  referrer: '',
  origin: 'https://smile-pro.com',
  now: start
});
const initialRecord = updateAttributionRecord(null, first, start);
assert.equal(initialRecord.first_touch.landing_page, '/ar/');
assert.equal(initialRecord.last_non_direct, null);
assert.equal(initialRecord.expires_at, start + 90 * 24 * 60 * 60 * 1000);
assert.equal(initialRecord.first_touch_expires_at, initialRecord.expires_at);
assert.equal(initialRecord.last_non_direct_expires_at, 0);

const paid = createAttributionSnapshot({
  pathname: '/smile-pro/',
  search: '?utm_source=google&gclid=click-1',
  referrer: 'https://www.google.com/search?q=eyes',
  origin: 'https://smile-pro.com',
  now: start + 1000
});
const paidRecord = updateAttributionRecord(initialRecord, paid, start + 1000);
assert.equal(paidRecord.first_touch.landing_page, '/ar/');
assert.equal(paidRecord.last_non_direct.gclid, 'click-1');
assert.equal(paidRecord.last_non_direct.referrer, 'https://www.google.com/search');
assert.equal(paidRecord.first_touch_expires_at, initialRecord.first_touch_expires_at);
assert.equal(paidRecord.last_non_direct_expires_at, start + 1000 + 90 * 24 * 60 * 60 * 1000);
assert.equal(paidRecord.expires_at, paidRecord.last_non_direct_expires_at);

const direct = createAttributionSnapshot({
  pathname: '/blog/',
  origin: 'https://smile-pro.com',
  now: start + 2000
});
const directRecord = updateAttributionRecord(paidRecord, direct, start + 2000);
assert.equal(directRecord.last_non_direct.gclid, 'click-1');

const reset = updateAttributionRecord(paidRecord, direct, initialRecord.first_touch_expires_at + 1);
assert.equal(reset.first_touch.landing_page, '/blog/');
assert.equal(reset.last_non_direct.gclid, 'click-1');

const fullyExpired = updateAttributionRecord(paidRecord, direct, paidRecord.last_non_direct_expires_at + 1);
assert.equal(fullyExpired.first_touch.landing_page, '/blog/');
assert.equal(fullyExpired.last_non_direct, null);

const refreshedPaid = createAttributionSnapshot({
  pathname: '/articles/new/',
  search: '?fbclid=click-2',
  origin: 'https://smile-pro.com',
  now: start + 2000
});
const refreshedRecord = updateAttributionRecord(paidRecord, refreshedPaid, start + 2000);
assert.equal(refreshedRecord.first_touch.landing_page, '/ar/');
assert.equal(refreshedRecord.last_non_direct.fbclid, 'click-2');
assert.equal(refreshedRecord.last_non_direct_expires_at, start + 2000 + 90 * 24 * 60 * 60 * 1000);

const eventState = {
  attribution: paidRecord,
  page: { kind: 'article', language: 'ar', path: '/articles/test/', title: 'Test' },
  sessionId: 'ses_test'
};
const ordinaryEvent = buildEventEnvelope('content_view', {
  event_id: 'evt_test',
  user_data: { phone_sha256_digits: hash('201012345678') }
}, eventState);
assert.equal(ordinaryEvent.schema_version, TRACKING_SCHEMA_VERSION);
assert.equal(ordinaryEvent.session_id, 'ses_test');
assert.equal(ordinaryEvent.user_data, undefined);
assert.equal(ordinaryEvent.attribution.gclid, 'click-1');

const leadEvent = buildEventEnvelope('smile_pro_lead', {
  event_id: 'lead_test',
  lead_id: 'lead_test',
  attempt_id: 'attempt_test',
  form_name: 'consultation',
  user_data: { phone_sha256_digits: hash('201012345678') }
}, eventState);
assert.equal(leadEvent.event_id, 'lead_test');
assert.equal(leadEvent.form.id, 'lead_test');
assert.equal(leadEvent.user_data.phone_sha256_digits, hash('201012345678'));

class MemoryStorage {
  constructor({ blocked = false } = {}) {
    this.blocked = blocked;
    this.values = new Map();
  }
  getItem(key) {
    if (this.blocked) throw new Error('blocked');
    return this.values.get(key) || null;
  }
  setItem(key, value) {
    if (this.blocked) throw new Error('blocked');
    this.values.set(key, String(value));
  }
  removeItem(key) {
    if (this.blocked) throw new Error('blocked');
    this.values.delete(key);
  }
}

globalThis.window = { sessionStorage: new MemoryStorage() };
const pendingLead = {
  schema_version: TRACKING_SCHEMA_VERSION,
  status: 'pending',
  event_id: 'lead_test',
  lead_id: 'lead_test',
  confirmation_token: 'confirm_test',
  expires_at: Date.now() + 60_000,
  user_data: { phone_sha256_digits: hash('201012345678') }
};
assert.equal(storePendingLead(pendingLead), true);
assert.equal(readPendingLead(), null);
assert.equal(readPendingLead('wrong-token'), null);
assert.equal(readPendingLead('confirm_test')?.lead_id, 'lead_test');
assert.equal(markLeadDispatched(pendingLead), true);
assert.equal(readPendingLead('confirm_test'), null);
const tombstone = JSON.parse(window.sessionStorage.getItem(PENDING_LEAD_STORAGE_KEY));
assert.equal(tombstone.status, 'dispatched');
assert.equal(tombstone.user_data, undefined);

window.sessionStorage = new MemoryStorage();
window.sessionStorage.setItem(PENDING_LEAD_STORAGE_KEY, JSON.stringify({ ...pendingLead, expires_at: Date.now() - 1 }));
assert.equal(readPendingLead('confirm_test'), null);
assert.equal(window.sessionStorage.getItem(PENDING_LEAD_STORAGE_KEY), null);
window.sessionStorage = new MemoryStorage({ blocked: true });
assert.equal(storePendingLead(pendingLead), false);
assert.equal(readPendingLead('confirm_test'), null);

globalThis.window = {
  sessionStorage: new MemoryStorage(),
  localStorage: new MemoryStorage(),
  location: {
    search: '?utm_source=test&oppref=op_test',
    pathname: '/thank-you/',
    hash: '#done',
    origin: 'https://smileproegypt.com'
  },
  history: {
    replaceState: (_state, _title, url) => { globalThis.window.replacedUrl = url; }
  },
  dataLayer: [],
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout
};
globalThis.document = {
  body: { dataset: { pageKind: 'thank-you', locale: 'en' } },
  documentElement: { lang: 'en-EG' },
  referrer: '',
  title: 'Thank you'
};
window.sessionStorage.setItem(LEAD_CONFIRMATION_CAPTURE_KEY, 'confirm_from_url');
assert.equal(captureLeadConfirmationToken(), 'confirm_from_url');
assert.equal(window.replacedUrl, '/thank-you/?utm_source=test&oppref=op_test#done');
assert.equal(window.sessionStorage.getItem(LEAD_CONFIRMATION_CAPTURE_KEY), null);
assert.equal(captureLeadConfirmationToken(), 'confirm_from_url');
const mockFields = new Map([
  ['lead-id', { value: 'lead_runtime_test' }],
  ['attempt-id', { value: 'attempt_runtime_test' }],
  ...['gclid', 'oppref', 'first-touch', 'last-non-direct', 'session-id', 'source-page'].map((name) => [name, { value: '' }])
]);
const mockForm = {
  id: 'runtime-form',
  dataset: { formPosition: 'test', service: 'smile-pro' },
  elements: { namedItem: (name) => mockFields.get(name) || null },
  getAttribute: (name) => name === 'name' ? 'runtime-form' : ''
};
const runtimeLead = await createPendingLead(mockForm, '+201012345678');
assert.equal(JSON.stringify(runtimeLead).includes('+201012345678'), false);
assert.equal(runtimeLead.user_data.phone_sha256_e164, hash('+201012345678'));
assert.match(runtimeLead.confirmation_token, /^confirm_/);
const confirmationUrl = new URL(createLeadConfirmationUrl(
  '/thank-you/?source=test',
  runtimeLead,
  'https://smileproegypt.com/form/'
));
assert.equal(confirmationUrl.searchParams.get(LEAD_CONFIRMATION_PARAMETER), runtimeLead.confirmation_token);
assert.equal(confirmationUrl.searchParams.get('source'), 'test');

let completionCount = 0;
dispatchLeadConversion(runtimeLead, {
  onComplete: () => { completionCount += 1; },
  timeoutMs: 50
});
assert.equal(window.dataLayer[0].event, 'smile_pro_lead');
assert.equal(window.dataLayer[0].user_data.phone_sha256_digits, hash('201012345678'));
assert.equal(window.dataLayer[0].eventTimeout, 50);
window.dataLayer[0].eventCallback();
window.dataLayer[0].eventCallback();
assert.equal(completionCount, 1);
assert.deepEqual(window.dataLayer.at(-1), { user_data: null });
assert.equal(JSON.stringify(window.dataLayer).includes('+201012345678'), false);

const confirmedLead = {
  ...runtimeLead,
  event_id: 'lead_confirmed_test',
  lead_id: 'lead_confirmed_test',
  confirmation_token: 'confirm_confirmed_test'
};
assert.equal(storePendingLead(confirmedLead), true);
let confirmedCompletionCount = 0;
const confirmedEvent = dispatchConfirmedLead(confirmedLead, {
  onComplete: () => { confirmedCompletionCount += 1; },
  timeoutMs: 50
});
assert.equal(confirmedEvent.event, 'smile_pro_lead');
assert.equal(confirmedEvent.lead_id, 'lead_confirmed_test');
assert.equal(readPendingLead('confirm_confirmed_test'), null);
assert.equal(JSON.parse(window.sessionStorage.getItem(PENDING_LEAD_STORAGE_KEY)).status, 'dispatched');
confirmedEvent.eventCallback();
confirmedEvent.eventCallback();
assert.equal(confirmedCompletionCount, 1);
assert.equal(
  window.dataLayer.filter((entry) => entry.event === 'smile_pro_lead' && entry.lead_id === 'lead_confirmed_test').length,
  1
);

// A restored document must read the newer touch, not replay the old campaign parameters in its URL.
const cachedAttribution = getAttribution();
const campaignTime = Date.now();
const campaignB = updateAttributionRecord(cachedAttribution, createAttributionSnapshot({
  pathname: '/en/smile-pro/', search: '?gclid=campaign-B', now: campaignTime
}), campaignTime);
window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(campaignB));
assert.equal(getAttribution().last_non_direct.oppref, 'op_test');
assert.deepEqual(refreshTrackingAttribution(campaignTime + 1), campaignB);
syncFormAttribution(mockForm);
assert.equal(mockFields.get('gclid').value, 'campaign-B');
assert.equal(mockFields.get('oppref').value, '');
assert.deepEqual(JSON.parse(mockFields.get('first-touch').value), cachedAttribution.first_touch);
assert.deepEqual(JSON.parse(mockFields.get('last-non-direct').value), campaignB.last_non_direct);

// Capture attribution before FormData and keep the conversion on that same touch during a slow POST.
const originalFormData = globalThis.FormData;
let submittedBody;
try {
  globalThis.FormData = class {
    constructor(form) {
      assert.equal(form, mockForm);
      return [...mockFields].map(([name, field]) => [name, field.value]);
    }
  };
  submittedBody = new URLSearchParams(encodeNetlifyForm(mockForm));
} finally {
  globalThis.FormData = originalFormData;
}
assert.equal(submittedBody.get('gclid'), 'campaign-B');
const campaignC = updateAttributionRecord(campaignB, createAttributionSnapshot({
  pathname: '/blog/', search: '?gclid=campaign-C', now: campaignTime + 2
}), campaignTime + 2);
window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(campaignC));
assert.equal((await createPendingLead(mockForm)).attribution.gclid, 'campaign-B');
assert.equal((await createPendingLead(mockForm)).attribution.gclid, 'campaign-C');
window.localStorage.blocked = true;
assert.deepEqual(refreshTrackingAttribution(), campaignC);
window.localStorage.blocked = false;
const afterExpiry = refreshTrackingAttribution(campaignC.expires_at + 1);
assert.equal(afterExpiry.last_non_direct, null);
assert.equal(afterExpiry.first_touch.oppref, undefined);
assert.equal(afterExpiry.first_touch.gclid, undefined);

// Exercise the actual header script, including a throwing Storage getter and quota/write failures.
const headTemplate = readFileSync(new URL('../src/_includes/partials/head.njk', import.meta.url), 'utf8');
const confirmationScript = [...headTemplate.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find((match) => match[1].includes(LEAD_CONFIRMATION_PARAMETER))?.[1];
assert.ok(confirmationScript);
const originalWindow = globalThis.window;
try {
  for (const failureMode of ['none', 'write', 'getter']) {
    const location = new URL('https://smileproegypt.com/thank-you/?lead_confirmation=confirm_head&utm_source=test#done');
    const storage = new MemoryStorage();
    if (failureMode === 'write') storage.setItem = () => { throw new Error('QuotaExceeded'); };
    const headWindow = {
      location,
      sessionStorage: storage,
      history: { replaceState: (_state, _title, url) => { location.href = new URL(url, location).href; } }
    };
    if (failureMode === 'getter') Object.defineProperty(headWindow, 'sessionStorage', {
      get() { throw new Error('Storage denied'); }
    });
    runInNewContext(confirmationScript, { URL, window: headWindow });
    assert.equal(location.searchParams.has(LEAD_CONFIRMATION_PARAMETER), false);
    assert.equal(location.searchParams.get('utm_source'), 'test');
    assert.equal(location.hash, '#done');
    assert.equal(headWindow.__smileProLeadConfirmationToken, 'confirm_head');
    globalThis.window = headWindow;
    const freshCore = await import(`../src/assets/js/modules/tracking-core.js?head-test=${failureMode}`);
    assert.equal(freshCore.captureLeadConfirmationToken(), 'confirm_head');
    assert.equal(headWindow.__smileProLeadConfirmationToken, undefined);
    assert.equal(freshCore.captureLeadConfirmationToken(), 'confirm_head');
  }
} finally {
  globalThis.window = originalWindow;
}

// Run site.js against a controlled DOM and deliver queued callbacks from disconnected observers.
const observers = [];
const pageListeners = new Map();
const observedFields = new Map(['lead-id', 'attempt-id', 'gclid'].map((name) => [name, { value: '' }]));
const observedForm = {
  id: 'observed-form', dataset: {},
  elements: { namedItem: (name) => observedFields.get(name) },
  getAttribute: (name) => name === 'name' ? 'consultation' : name === 'action' ? '/ar/thank-you/' : '',
  setAttribute: () => {},
  querySelector: () => null,
  listeners: new Map(),
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  },
  dispatch(name, event = {}) {
    for (const callback of this.listeners.get(name) || []) callback(event);
  }
};
const observerRuntime = { page: { kind: 'home' }, attribution: { gclid: 'campaign-A' } };
const observerWindow = {
  location: { search: '', pathname: '/ar/', hash: '', origin: 'https://smileproegypt.com' },
  dataLayer: [],
  addEventListener: (name, callback) => pageListeners.set(name, callback)
};
class TestObserver {
  constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
  observe() {}
  disconnect() { this.disconnected = true; }
  deliver() { this.callback([{ isIntersecting: true }]); }
}
observerWindow.IntersectionObserver = TestObserver;
let observerId = 0;
const siteScript = readFileSync(new URL('../src/assets/js/site.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from '\.\/modules\/tracking-core\.js';/, '');
runInNewContext(siteScript, {
  URL, URLSearchParams, window: observerWindow, IntersectionObserver: TestObserver,
  document: {
    body: { dataset: {} },
    querySelectorAll: (selector) => selector === 'form[data-lead-form]' ? [observedForm] : [],
    querySelector: () => null, getElementById: () => null, addEventListener: () => {}
  },
  captureLeadConfirmationToken: () => '',
  initializeTrackingRuntime: () => observerRuntime,
  getAttribution: () => observerRuntime.attribution,
  refreshTrackingAttribution: () => { observerRuntime.attribution = { gclid: 'campaign-B' }; },
  syncFormAttribution: (_form, attribution) => { observedFields.get('gclid').value = attribution.gclid; },
  createTrackingId: (prefix) => `${prefix}_${++observerId}`,
  trackSiteEvent: (event, parameters) => observerWindow.dataLayer.push({ event, ...parameters, attribution: observerRuntime.attribution })
});
const pageShow = pageListeners.get('pageshow');
const formViews = () => observerWindow.dataLayer.filter((entry) => entry.event === 'lead_form_view');
pageShow({ persisted: false });
assert.equal(observers.length, 1);
pageShow({ persisted: true });
assert.equal(observers.length, 2);
assert.equal(observers[0].disconnected, true);
assert.equal(observedFields.get('gclid').value, 'campaign-B');
assert.equal(observerWindow.dataLayer.at(-1).attribution.gclid, 'campaign-B');
observers[0].deliver();
assert.equal(formViews().length, 0);
observedForm.dataset.service = 'femto-lasik';
observers[1].deliver();
observers[1].deliver();
assert.equal(formViews().length, 1);
assert.equal(formViews()[0].attempt_id, observedFields.get('attempt-id').value);
assert.equal(formViews()[0].service, 'femto-lasik');
const formStarts = () => observerWindow.dataLayer.filter((entry) => entry.event === 'lead_form_start');
observedForm.dispatch('input');
observedForm.dispatch('change');
observedForm.dispatch('submit');
assert.equal(formViews().length, 1);
assert.equal(formStarts().length, 1);
pageShow({ persisted: true });
observers[1].deliver();
observedForm.dataset.service = 'smile-pro';
observedForm.dispatch('submit');
observers[2].deliver();
assert.equal(formViews().length, 2);
assert.equal(formStarts().length, 2);
assert.notEqual(formViews()[0].attempt_id, formViews()[1].attempt_id);
assert.equal(formViews()[1].service, 'smile-pro');
assert.equal(formViews()[1].attempt_id, formStarts()[1].attempt_id);
assert.ok(observerWindow.dataLayer.indexOf(formViews()[1]) < observerWindow.dataLayer.indexOf(formStarts()[1]));

console.log('Tracking checks passed: attribution refresh, submission snapshots, header storage failures, form observers, phone hashes and lead deduplication.');
