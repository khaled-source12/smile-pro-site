export const TRACKING_SCHEMA_VERSION = '2.0';
export const ATTRIBUTION_STORAGE_KEY = 'smile-pro-attribution-v2';
export const SESSION_STORAGE_KEY = 'smile-pro-session-v2';
export const PENDING_LEAD_STORAGE_KEY = 'smile-pro-pending-lead';
export const DISPATCHED_LEADS_STORAGE_KEY = 'smile-pro-dispatched-leads-v2';
export const LEAD_CONFIRMATION_PARAMETER = 'lead_confirmation';
export const LEAD_CONFIRMATION_CAPTURE_KEY = 'smile-pro-lead-confirmation-token';

const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const PENDING_LEAD_TTL_MS = 15 * 60 * 1000;
const ATTRIBUTION_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'wbraid',
  'gbraid',
  'fbclid',
  'ttclid',
  'sccid',
  'oppref',
  'msclkid'
];
const ATTRIBUTION_PARAMETER_ALIASES = new Map([
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_term', 'utm_term'],
  ['utm_content', 'utm_content'],
  ['gclid', 'gclid'],
  ['wbraid', 'wbraid'],
  ['gbraid', 'gbraid'],
  ['fbclid', 'fbclid'],
  ['ttclid', 'ttclid'],
  ['sccid', 'sccid'],
  ['oppref', 'oppref'],
  ['msclkid', 'msclkid']
]);

const runtime = {
  initialized: false,
  attribution: null,
  page: null,
  sessionId: '',
  leadConfirmationToken: ''
};
const submittedFormAttribution = new WeakMap();

const cleanValue = (value, maximumLength = 500) => String(value || '').trim().slice(0, maximumLength);

function storageValue(storage, key) {
  try {
    return storage?.getItem(key) || '';
  } catch (_error) {
    return '';
  }
}

function browserStorage(name) {
  try {
    return globalThis.window?.[name] || globalThis[name] || null;
  } catch (_error) {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return storage?.getItem(key) === value;
  } catch (_error) {
    return false;
  }
}

function removeStorage(storage, key) {
  try {
    storage?.removeItem(key);
    return true;
  } catch (_error) {
    return false;
  }
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

export function createTrackingId(prefix = 'evt') {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function readCampaignParameters(search = '') {
  const values = {};
  const parameters = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  for (const [rawName, rawValue] of parameters.entries()) {
    const canonicalName = ATTRIBUTION_PARAMETER_ALIASES.get(rawName.toLowerCase());
    const value = cleanValue(rawValue);
    if (canonicalName && value) values[canonicalName] = value;
  }
  return values;
}

export function sanitizeReferrer(referrer = '') {
  if (!referrer) return '';
  try {
    const parsed = new URL(referrer);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 1000);
  } catch (_error) {
    return '';
  }
}

function isExternalReferrer(referrer, origin) {
  if (!referrer) return false;
  try {
    return new URL(referrer).origin !== origin;
  } catch (_error) {
    return false;
  }
}

export function createAttributionSnapshot({ search = '', pathname = '/', referrer = '', origin = '', now = Date.now() } = {}) {
  const campaign = readCampaignParameters(search);
  return {
    captured_at: new Date(now).toISOString(),
    landing_page: cleanValue(pathname || '/', 1000),
    referrer: sanitizeReferrer(referrer),
    ...campaign,
    is_non_direct: Object.keys(campaign).length > 0 || isExternalReferrer(referrer, origin)
  };
}

export function updateAttributionRecord(previous, snapshot, now = Date.now()) {
  const validSchema = previous?.schema_version === TRACKING_SCHEMA_VERSION;
  const previousFirstExpiry = Number(previous?.first_touch_expires_at || previous?.expires_at);
  const previousLastExpiry = Number(previous?.last_non_direct_expires_at || previous?.expires_at);
  const validFirstTouch = validSchema && previous?.first_touch && previousFirstExpiry > now;
  const validLastNonDirect = validSchema && previous?.last_non_direct && previousLastExpiry > now;
  const hasNewNonDirectTouch = Boolean(snapshot.is_non_direct);
  const firstTouchExpiry = validFirstTouch ? previousFirstExpiry : now + ATTRIBUTION_TTL_MS;
  const lastNonDirectExpiry = hasNewNonDirectTouch
    ? now + ATTRIBUTION_TTL_MS
    : validLastNonDirect ? previousLastExpiry : 0;
  const record = {
    schema_version: TRACKING_SCHEMA_VERSION,
    first_touch: validFirstTouch ? previous.first_touch : snapshot,
    first_touch_expires_at: firstTouchExpiry,
    last_non_direct: hasNewNonDirectTouch ? snapshot : validLastNonDirect ? previous.last_non_direct : null,
    last_non_direct_expires_at: lastNonDirectExpiry,
    expires_at: Math.max(firstTouchExpiry, lastNonDirectExpiry)
  };
  return record;
}

function ensureSessionId() {
  const sessionStorage = browserStorage('sessionStorage');
  const existing = storageValue(sessionStorage, SESSION_STORAGE_KEY);
  if (existing) return existing;
  const sessionId = createTrackingId('ses');
  writeStorage(sessionStorage, SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export function initializeTrackingRuntime() {
  if (runtime.initialized) return runtime;
  const body = document.body;
  const now = Date.now();
  const snapshot = createAttributionSnapshot({
    search: window.location.search,
    pathname: window.location.pathname,
    referrer: document.referrer,
    origin: window.location.origin,
    now
  });
  const localStorage = browserStorage('localStorage');
  const previous = parseJson(storageValue(localStorage, ATTRIBUTION_STORAGE_KEY));
  runtime.attribution = updateAttributionRecord(previous, snapshot, now);
  writeStorage(localStorage, ATTRIBUTION_STORAGE_KEY, JSON.stringify(runtime.attribution));
  runtime.page = {
    kind: body.dataset.pageKind || 'standard',
    language: body.dataset.locale || document.documentElement.lang.slice(0, 2),
    path: window.location.pathname,
    title: document.title
  };
  runtime.sessionId = ensureSessionId();
  runtime.initialized = true;
  window.dataLayer = window.dataLayer || [];
  return runtime;
}

export function getAttribution() {
  return initializeTrackingRuntime().attribution;
}

export function refreshTrackingAttribution(now = Date.now()) {
  const state = initializeTrackingRuntime();
  const localStorage = browserStorage('localStorage');
  const storedValue = storageValue(localStorage, ATTRIBUTION_STORAGE_KEY);
  const stored = parseJson(storedValue);
  const previous = stored?.schema_version === TRACKING_SCHEMA_VERSION ? stored : state.attribution;
  // Returning to an old document is not a new campaign touch, even if its URL still has click IDs.
  const snapshot = createAttributionSnapshot({ pathname: window.location.pathname, now });
  state.attribution = updateAttributionRecord(previous, snapshot, now);
  const serialized = JSON.stringify(state.attribution);
  if (serialized !== storedValue) writeStorage(localStorage, ATTRIBUTION_STORAGE_KEY, serialized);
  return state.attribution;
}

export function getEffectiveAttribution(record = getAttribution()) {
  return record?.last_non_direct || record?.first_touch || {};
}

export function getFormAttributionValues(record = getAttribution()) {
  const firstTouch = record?.first_touch || {};
  const lastNonDirect = record?.last_non_direct || {};
  const effective = getEffectiveAttribution(record);
  const values = {
    'landing-page': firstTouch.landing_page || '',
    referrer: firstTouch.referrer || '',
    'first-touch': JSON.stringify(firstTouch),
    'last-non-direct': lastNonDirect.captured_at ? JSON.stringify(lastNonDirect) : ''
  };
  for (const field of ATTRIBUTION_FIELDS) values[field.replaceAll('_', '-')] = effective[field] || '';
  return values;
}

export function syncFormAttribution(form, record = getAttribution()) {
  const state = initializeTrackingRuntime();
  const values = {
    ...getFormAttributionValues(record),
    'session-id': state.sessionId,
    'source-page': state.page.path
  };
  for (const [name, value] of Object.entries(values)) {
    const field = form?.elements?.namedItem(name);
    if (field) field.value = value;
  }
}

export function captureFormAttribution(form) {
  const record = refreshTrackingAttribution();
  syncFormAttribution(form, record);
  submittedFormAttribution.set(form, record);
}

function attributionForEvent(record) {
  const effective = getEffectiveAttribution(record);
  const identifiers = {};
  for (const field of ATTRIBUTION_FIELDS) {
    if (effective[field]) identifiers[field] = effective[field];
  }
  return {
    first_touch: record?.first_touch || null,
    last_non_direct: record?.last_non_direct || null,
    ...identifiers
  };
}

export function buildEventEnvelope(eventName, parameters = {}, state = initializeTrackingRuntime()) {
  const suppliedAttribution = parameters.attribution;
  const attribution = suppliedAttribution || attributionForEvent(state.attribution);
  const eventId = cleanValue(parameters.event_id) || createTrackingId('evt');
  const form = parameters.form || (parameters.form_name || parameters.lead_id ? {
    id: parameters.lead_id || '',
    name: parameters.form_name || 'unknown',
    position: parameters.form_position || 'unknown',
    procedure: parameters.service || 'unknown'
  } : undefined);
  const envelope = {
    ...parameters,
    event: eventName,
    schema_version: TRACKING_SCHEMA_VERSION,
    event_id: eventId,
    event_time_ms: Number(parameters.event_time_ms) || Date.now(),
    page: parameters.page || state.page,
    session: parameters.session || { id: state.sessionId },
    session_id: (parameters.session || { id: state.sessionId })?.id || '',
    attribution,
    page_kind: (parameters.page || state.page)?.kind || 'standard',
    language: (parameters.page || state.page)?.language || '',
    page_path: (parameters.page || state.page)?.path || ''
  };
  if (form) envelope.form = form;
  if (eventName !== 'smile_pro_lead') delete envelope.user_data;
  return envelope;
}

export function trackSiteEvent(eventName, parameters = {}) {
  const envelope = buildEventEnvelope(eventName, parameters);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(envelope);
  return envelope;
}

export function normalizePhoneForTracking(value) {
  const e164 = cleanValue(value, 32);
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  const digits = e164.slice(1).replace(/^0+/, '');
  if (!/^\d{8,15}$/.test(digits)) return null;
  return { e164: `+${digits}`, digits };
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') return '';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPhoneHashes(value) {
  const normalized = normalizePhoneForTracking(value);
  if (!normalized) return null;
  let phoneSha256E164 = '';
  let phoneSha256Digits = '';
  try {
    [phoneSha256E164, phoneSha256Digits] = await Promise.all([
      sha256Hex(normalized.e164),
      sha256Hex(normalized.digits)
    ]);
  } catch (_error) {
    return null;
  }
  if (!phoneSha256E164 || !phoneSha256Digits) return null;
  return {
    phone_sha256_e164: phoneSha256E164,
    phone_sha256_digits: phoneSha256Digits
  };
}

function formValue(form, name) {
  return cleanValue(form?.elements?.namedItem(name)?.value);
}

export async function createPendingLead(form, e164 = '') {
  const state = initializeTrackingRuntime();
  // Keep the conversion aligned with the submitted POST if another campaign arrives while it is in flight.
  const attribution = submittedFormAttribution.get(form) || refreshTrackingAttribution();
  submittedFormAttribution.delete(form);
  const leadId = formValue(form, 'lead-id') || createTrackingId('lead');
  const attemptId = formValue(form, 'attempt-id') || cleanValue(form?.dataset?.attemptId) || createTrackingId('attempt');
  const now = Date.now();
  const hashes = await createPhoneHashes(e164);
  const lead = {
    schema_version: TRACKING_SCHEMA_VERSION,
    status: 'pending',
    event_id: leadId,
    lead_id: leadId,
    attempt_id: attemptId,
    confirmation_token: createTrackingId('confirm'),
    created_at: now,
    expires_at: now + PENDING_LEAD_TTL_MS,
    form_name: cleanValue(form?.getAttribute?.('name') || form?.id || 'unknown'),
    form_position: cleanValue(form?.dataset?.formPosition || 'unknown'),
    service: cleanValue(form?.dataset?.service || 'unknown'),
    language: state.page.language,
    source_page: state.page.path,
    page: state.page,
    session: { id: state.sessionId },
    attribution: attributionForEvent(attribution)
  };
  if (hashes) lead.user_data = hashes;
  return lead;
}

export function storePendingLead(lead) {
  return writeStorage(browserStorage('sessionStorage'), PENDING_LEAD_STORAGE_KEY, JSON.stringify(lead));
}

export async function prepareLeadConversion(form, e164 = '') {
  const lead = await createPendingLead(form, e164);
  return { lead, stored: storePendingLead(lead) };
}

export function createLeadConfirmationUrl(action, lead, baseUrl = globalThis.window?.location?.href || 'https://smileproegypt.com/') {
  const token = cleanValue(lead?.confirmation_token, 200);
  if (!token) return action;
  try {
    const url = new URL(action || '/', baseUrl);
    url.searchParams.set(LEAD_CONFIRMATION_PARAMETER, token);
    return url.href;
  } catch (_error) {
    return action;
  }
}

export function captureLeadConfirmationToken() {
  if (runtime.leadConfirmationToken) return runtime.leadConfirmationToken;
  const sessionStorage = browserStorage('sessionStorage');
  const parameters = new URLSearchParams(globalThis.window?.location?.search || '');
  const token = cleanValue(
    parameters.get(LEAD_CONFIRMATION_PARAMETER) || globalThis.window?.__smileProLeadConfirmationToken ||
      storageValue(sessionStorage, LEAD_CONFIRMATION_CAPTURE_KEY),
    200
  );
  if (!token) return '';
  runtime.leadConfirmationToken = token;
  if (globalThis.window) delete globalThis.window.__smileProLeadConfirmationToken;
  removeStorage(sessionStorage, LEAD_CONFIRMATION_CAPTURE_KEY);
  parameters.delete(LEAD_CONFIRMATION_PARAMETER);
  const location = globalThis.window?.location;
  const cleanUrl = `${location?.pathname || '/'}${parameters.toString() ? `?${parameters.toString()}` : ''}${location?.hash || ''}`;
  try {
    globalThis.window?.history?.replaceState(null, '', cleanUrl);
  } catch (_error) {
    // Tracking can continue even when the browser blocks History API writes.
  }
  return token;
}

function readDispatchedLeadIds() {
  const parsed = parseJson(storageValue(browserStorage('sessionStorage'), DISPATCHED_LEADS_STORAGE_KEY), []);
  return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string').slice(-20) : [];
}

function rememberDispatchedLead(leadId) {
  const values = readDispatchedLeadIds().filter((value) => value !== leadId);
  values.push(leadId);
  return writeStorage(browserStorage('sessionStorage'), DISPATCHED_LEADS_STORAGE_KEY, JSON.stringify(values.slice(-20)));
}

export function readPendingLead(confirmationToken = '', now = Date.now()) {
  const sessionStorage = browserStorage('sessionStorage');
  const lead = parseJson(storageValue(sessionStorage, PENDING_LEAD_STORAGE_KEY));
  if (!lead) return null;
  if (lead.status === 'dispatched') return null;
  if (lead.status !== 'pending' || !lead.lead_id || Number(lead.expires_at) <= now) {
    removeStorage(sessionStorage, PENDING_LEAD_STORAGE_KEY);
    return null;
  }
  if (!confirmationToken || cleanValue(confirmationToken, 200) !== lead.confirmation_token) return null;
  if (readDispatchedLeadIds().includes(lead.lead_id)) return null;
  return lead;
}

export function markLeadDispatched(lead) {
  if (!lead?.lead_id) return false;
  const tombstone = {
    schema_version: TRACKING_SCHEMA_VERSION,
    status: 'dispatched',
    lead_id: lead.lead_id,
    dispatched_at: Date.now()
  };
  const tombstoneStored = writeStorage(browserStorage('sessionStorage'), PENDING_LEAD_STORAGE_KEY, JSON.stringify(tombstone));
  const idStored = rememberDispatchedLead(lead.lead_id);
  return tombstoneStored && idStored;
}

export function dispatchLeadConversion(lead, { onComplete, timeoutMs = 2000 } = {}) {
  if (!lead?.lead_id) return null;
  let completed = false;
  let completionTimer;
  const complete = () => {
    if (completed) return;
    completed = true;
    const clearTimer = window.clearTimeout || globalThis.clearTimeout;
    if (completionTimer) clearTimer(completionTimer);
    window.dataLayer?.push({ user_data: null });
    if (typeof onComplete === 'function') onComplete();
  };
  completionTimer = window.setTimeout(complete, timeoutMs);
  const event = trackSiteEvent('smile_pro_lead', {
    event_category: 'form',
    event_id: lead.event_id || lead.lead_id,
    lead_id: lead.lead_id,
    attempt_id: lead.attempt_id,
    form_name: lead.form_name,
    form_position: lead.form_position,
    service: lead.service,
    language: lead.language,
    source_page: lead.source_page,
    page: lead.page,
    session: lead.session,
    attribution: lead.attribution,
    user_data: lead.user_data,
    eventCallback: complete,
    eventTimeout: timeoutMs
  });
  return event;
}

export function dispatchConfirmedLead(lead, options = {}) {
  const event = dispatchLeadConversion(lead, options);
  if (event) markLeadDispatched(lead);
  return event;
}
