const crypto = require('node:crypto');

const expiredStateCookie = 'decap_oauth_state=; Path=/.netlify/functions/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Set-Cookie': expiredStateCookie,
    },
    body: `<!doctype html><meta charset="utf-8"><title>CMS sign-in failed</title><p>${message}</p>`,
  };
}

function readCookie(header = '', name) {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return '';
}

function equalState(received, expected) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

exports.handler = async (event = {}) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return errorResponse(500, 'CMS OAuth environment variables are missing.');

  const query = event.queryStringParameters || {};
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const expectedState = readCookie(cookieHeader, 'decap_oauth_state');
  if (!equalState(query.state, expectedState)) return errorResponse(400, 'The OAuth state is missing or invalid. Please try signing in again.');
  if (!query.code) return errorResponse(400, 'GitHub did not return an authorization code. Please try signing in again.');

  let token;
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: query.code }),
    });
    if (!tokenResponse.ok) return errorResponse(502, 'GitHub rejected the token request. Please try again.');
    const tokenData = await tokenResponse.json();
    token = tokenData.access_token;
    if (!token) return errorResponse(502, 'GitHub did not return an access token. Please try again.');
  } catch {
    return errorResponse(502, 'GitHub could not be reached. Please try again.');
  }

  const successMessage = JSON.stringify(`authorization:github:success:${JSON.stringify({ token })}`);
  const script = `<!doctype html>
    <meta charset="utf-8">
    <title>CMS sign-in complete</title>
    <p id="status">Completing CMS sign-in…</p>
    <script>
      (function() {
        var status = document.getElementById("status");
        if (!window.opener) {
          status.textContent = "The CMS window is no longer open. Return to the admin page and try again.";
          return;
        }
        function recv(event) {
          if (event.source !== window.opener) return;
          window.opener.postMessage(${successMessage}, event.origin);
          window.removeEventListener("message", recv, false);
          status.textContent = "Sign-in complete. You can close this window.";
          window.close();
        }
        window.addEventListener("message", recv, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    <\/script>`;

  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Set-Cookie': expiredStateCookie,
    },
    body: script,
  };
};
