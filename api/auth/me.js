const { getValidAccessToken, requireGoogleEnv } = require("../_google");

module.exports = async function handler(req, res) {
  try {
    requireGoogleEnv();

    const accessToken = await getValidAccessToken(req, res);
    if (!accessToken) {
      res.status(401).json({ authenticated: false });
      return;
    }

    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const profile = await response.json();
    if (!response.ok) {
      res.status(401).json({ authenticated: false, error: profile.error?.message || "Not signed in" });
      return;
    }

    res.status(200).json({
      authenticated: true,
      name: profile.name || profile.email || "Google user",
      email: profile.email || "",
      picture: profile.picture || ""
    });
  } catch (error) {
    res.status(500).json({ authenticated: false, error: error.message });
  }
};
