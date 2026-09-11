exports.handler = async (event) => {
  const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
  const redirect = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,user`;
  return {
    statusCode: 302,
    headers: { Location: redirect },
  };
};
