const { getValidAccessToken, requireGoogleEnv } = require("../_google");

const ARRIVAL_SEARCH = [
  "newer_than:180d",
  "(arrival OR arriving OR flight OR itinerary OR confirmation OR reservation OR landing)"
].join(" ");

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

function headersByName(headers = []) {
  return Object.fromEntries(headers.map((header) => [header.name.toLowerCase(), header.value]));
}

function extractArrivalClues(text) {
  const source = text || "";
  const airportCodes = Array.from(new Set(source.match(/\b[A-Z]{3}\b/g) || [])).slice(0, 4);
  const times = Array.from(new Set(source.match(/\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?\b/g) || [])).slice(0, 4);
  const dates = Array.from(new Set(source.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/gi) || [])).slice(0, 4);

  return {
    airportCodes,
    times,
    dates
  };
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
      `messages?maxResults=10&q=${encodeURIComponent(ARRIVAL_SEARCH)}`,
      accessToken
    );

    const messages = await Promise.all(
      (list.messages || []).map(async (message) => {
        const detail = await gmailFetch(
          `messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          accessToken
        );
        const headers = headersByName(detail.payload?.headers || []);
        return {
          id: detail.id,
          internalDate: Number(detail.internalDate || 0),
          subject: headers.subject || "(no subject)",
          from: headers.from || "",
          date: headers.date || "",
          snippet: detail.snippet || ""
        };
      })
    );

    const latest = messages.sort((a, b) => b.internalDate - a.internalDate)[0] || null;
    if (!latest) {
      res.status(200).json({ query: ARRIVAL_SEARCH, arrivalEmail: null });
      return;
    }

    res.status(200).json({
      query: ARRIVAL_SEARCH,
      arrivalEmail: {
        ...latest,
        extracted: extractArrivalClues(`${latest.subject} ${latest.snippet}`)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
