const crypto = require('node:crypto');

exports.handler = async () => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  if (!clientId) {
    return {
      statusCode: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
      body: 'CMS OAuth is not configured: OAUTH_CLIENT_ID is missing.',
    };
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirect = new URL('https://github.com/login/oauth/authorize');
  redirect.searchParams.set('client_id', clientId);
  // `repo` is sufficient for Decap to read and commit content. Avoid the
  // broader `user` scope because the CMS does not need private profile data.
  redirect.searchParams.set('scope', 'repo');
  redirect.searchParams.set('state', state);

  return {
    statusCode: 302,
    headers: {
      Location: redirect.href,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Set-Cookie': `decap_oauth_state=${state}; Path=/.netlify/functions/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  };
};
