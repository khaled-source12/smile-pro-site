exports.handler = async (event) => {
  const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
  const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
  const code = event.queryStringParameters.code;

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  const script = `
    <script>
      (function() {
        function recv(e) {
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify({ token })}',
            e.origin
          );
          window.removeEventListener("message", recv, false);
        }
        window.addEventListener("message", recv, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
  `;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: script,
  };
};
