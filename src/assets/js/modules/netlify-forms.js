import { captureFormAttribution } from './tracking-core.js';

export function encodeNetlifyForm(form) {
  captureFormAttribution(form);
  return new URLSearchParams(new FormData(form)).toString();
}

export async function postNetlifyForm(encodedBody, fetchImplementation = globalThis.fetch) {
  try {
    const response = await fetchImplementation('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodedBody
    });
    return { confirmed: Boolean(response?.ok), status: Number(response?.status) || 0 };
  } catch (_error) {
    return { confirmed: false, status: 0 };
  }
}
