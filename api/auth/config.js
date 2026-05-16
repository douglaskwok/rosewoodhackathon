const { getRedirectUri } = require("../_google");

module.exports = async function handler(req, res) {
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  res.status(200).json({
    ready: missing.length === 0,
    missing,
    redirectUri: getRedirectUri(req)
  });
};
