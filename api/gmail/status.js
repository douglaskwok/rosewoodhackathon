const { readCookies } = require("../_google");

module.exports = async function handler(req, res) {
  const cookies = readCookies(req);
  res.status(200).json({
    connected: Boolean(cookies.gmail_access_token || cookies.gmail_refresh_token)
  });
};
