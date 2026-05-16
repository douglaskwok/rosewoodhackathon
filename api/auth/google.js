const crypto = require("crypto");
const { GMAIL_SCOPE, cookie, getRedirectUri, requireGoogleEnv } = require("../_google");

module.exports = async function handler(req, res) {
  try {
    requireGoogleEnv();

    const state = crypto.randomBytes(24).toString("hex");
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(req),
      response_type: "code",
      scope: GMAIL_SCOPE,
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true"
    });

    res.setHeader("Set-Cookie", cookie("oauth_state", state, { maxAge: 600 }));
    res.writeHead(302, {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    });
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
