const {
  getValidAccessToken,
  requireGoogleEnv
} = require("../_google");

const GMAIL_SEARCH = "newer_than:30d (flight OR reservation OR itinerary OR arrival OR confirmation)";

async function gmailFetch(path, accessToken) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gmail API request failed");
  }

  return data;
}

module.exports = async function handler(req, res) {
  try {
    requireGoogleEnv();

    const accessToken = await getValidAccessToken(req, res);
    if (!accessToken) {
      res.status(401).json({ error: "Gmail is not connected" });
      return;
    }

    const list = await gmailFetch(
      `messages?maxResults=5&q=${encodeURIComponent(GMAIL_SEARCH)}`,
      accessToken
    );

    const messages = await Promise.all(
      (list.messages || []).map(async (message) => {
        const detail = await gmailFetch(
          `messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          accessToken
        );
        const headers = Object.fromEntries(
          (detail.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value])
        );
        return {
          id: detail.id,
          subject: headers.subject || "(no subject)",
          from: headers.from || "",
          date: headers.date || "",
          snippet: detail.snippet || ""
        };
      })
    );

    res.status(200).json({ query: GMAIL_SEARCH, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
