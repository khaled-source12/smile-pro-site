const defaultCmsOrigins = [
  'https://smileproegypt.com',
  'https://www.smileproegypt.com',
  'https://smile-pro-eg.netlify.app',
];

function normalizedHttpsOrigin(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.origin === value ? parsed.origin : '';
  } catch {
    return '';
  }
}

function cmsOrigins() {
  const configured = (process.env.CMS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const origins = configured.length ? configured : defaultCmsOrigins;
  return [...new Set(origins.map(normalizedHttpsOrigin).filter(Boolean))];
}

function isAllowedCmsOrigin(origin, allowedOrigins = cmsOrigins()) {
  const normalized = normalizedHttpsOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins.includes(normalized)) return true;

  const parsed = new URL(normalized);
  if (parsed.port) return false;
  const preview = parsed.hostname.match(/^deploy-preview-\d+--(.+\.netlify\.app)$/i);
  if (!preview) return false;
  return allowedOrigins.some((allowedOrigin) => new URL(allowedOrigin).hostname === preview[1]);
}

function requestCmsOrigin(event = {}, allowedOrigins = cmsOrigins()) {
  const headers = event.headers || {};
  for (const value of [headers.origin, headers.Origin, headers.referer, headers.Referer, headers.referrer]) {
    if (!value) continue;
    try {
      const origin = new URL(value).origin;
      if (isAllowedCmsOrigin(origin, allowedOrigins)) return origin;
    } catch {
      // Ignore malformed request metadata and fall back to configured origins.
    }
  }
  return '';
}

function encodeStateCookie(state, origin) {
  return origin ? `${state}.${Buffer.from(origin, 'utf8').toString('base64url')}` : state;
}

function decodeStateCookie(value = '') {
  const separator = value.indexOf('.');
  if (separator === -1) return { state: value, origin: '' };
  const state = value.slice(0, separator);
  try {
    const origin = Buffer.from(value.slice(separator + 1), 'base64url').toString('utf8');
    return { state, origin };
  } catch {
    return { state, origin: '' };
  }
}

module.exports = { cmsOrigins, decodeStateCookie, encodeStateCookie, isAllowedCmsOrigin, requestCmsOrigin };
