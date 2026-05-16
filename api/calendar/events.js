const { getValidAccessToken, requireGoogleEnv } = require("../_google");

function isoDaysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function queryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

module.exports = async function handler(req, res) {
  try {
    requireGoogleEnv();

    const accessToken = await getValidAccessToken(req, res);
    if (!accessToken) {
      res.status(401).json({ error: "Google Calendar is not connected" });
      return;
    }

    const timeMin = queryValue(req.query.timeMin) || isoDaysFromNow(-1);
    const timeMax = queryValue(req.query.timeMax) || isoDaysFromNow(30);

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "40",
      timeMin,
      timeMax
    });

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "Calendar API request failed" });
      return;
    }

    const events = (data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || "(no title)",
      location: event.location || "",
      startsAt: event.start?.dateTime || event.start?.date || "",
      endsAt: event.end?.dateTime || event.end?.date || "",
      link: event.htmlLink || ""
    }));

    res.status(200).json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
