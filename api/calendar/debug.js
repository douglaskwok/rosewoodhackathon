const { getValidAccessToken, requireGoogleEnv } = require("../_google");

module.exports = async function handler(req, res) {
  try {
    requireGoogleEnv();

    const accessToken = await getValidAccessToken(req, res);
    if (!accessToken) {
      res.status(401).json({
        ok: false,
        error: "No Google access token. Sign in again with Google."
      });
      return;
    }

    const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    const tokenInfo = await tokenInfoResponse.json();

    const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const calendarData = await calendarResponse.json();

    res.status(calendarResponse.ok ? 200 : calendarResponse.status).json({
      ok: calendarResponse.ok,
      tokenScopes: tokenInfo.scope || "",
      calendarApiStatus: calendarResponse.status,
      calendars: (calendarData.items || []).map((calendar) => ({
        id: calendar.id,
        summary: calendar.summary,
        primary: Boolean(calendar.primary)
      })),
      error: calendarData.error?.message || null
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};
