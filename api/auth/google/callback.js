const {
  clearCookie,
  cookie,
  exchangeCodeForTokens,
  getBaseUrl,
  readCookies,
  requireGoogleEnv
} = require("../../_google");

module.exports = async function handler(req, res) {
  try {
    requireGoogleEnv();

    const { code, state, error } = req.query;
    if (error) throw new Error(error);
    if (!code || !state) throw new Error("Missing OAuth callback parameters");

    const cookies = readCookies(req);
    if (!cookies.oauth_state || cookies.oauth_state !== state) {
      throw new Error("OAuth state mismatch");
    }

    const tokens = await exchangeCodeForTokens({ code, req });
    const setCookies = [
      clearCookie("oauth_state"),
      cookie("gmail_access_token", tokens.access_token, {
        maxAge: Math.max(60, (tokens.expires_in || 3600) - 60)
      }),
      cookie("gmail_connected", "true", {
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30
      })
    ];

    if (tokens.refresh_token) {
      setCookies.push(cookie("gmail_refresh_token", tokens.refresh_token, {
        maxAge: 60 * 60 * 24 * 30
      }));
    }

    res.setHeader("Set-Cookie", setCookies);
    res.writeHead(302, { Location: `${getBaseUrl(req)}/?gmail=connected` });
    res.end();
  } catch (error) {
    res.writeHead(302, { Location: `${getBaseUrl(req)}/?gmail=error` });
    res.end();
  }
};
