const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const FALLBACK_ITINERARY = {
  activity: [
    {
      name: "Morning walk through the Stanford Dish foothills",
      meta: "May 26, 8:30 AM · private guide · sparkling water packed",
      startsAt: "2026-05-26T08:30:00-07:00",
      endsAt: "2026-05-26T09:30:00-07:00",
      why: "You want to stay fit during the trip, and this keeps movement low-friction after arrival.",
      cta: "reserve guide"
    },
    {
      name: "Low-impact private Pilates at Rosewood",
      meta: "May 28, 10:00 AM · quiet studio · nut-free recovery snack",
      startsAt: "2026-05-28T10:00:00-07:00",
      endsAt: "2026-05-28T11:00:00-07:00",
      why: "Your profile favors wellness that supports energy without over-scheduling the day.",
      cta: "add to calendar"
    }
  ],
  wellness: [
    {
      name: "Asaya-inspired recovery ritual",
      meta: "May 26, 4:30 PM · steam, massage, hydration service",
      startsAt: "2026-05-26T16:30:00-07:00",
      endsAt: "2026-05-26T18:00:00-07:00",
      why: "Staff notes show you value recovery windows and sparkling water after travel.",
      cta: "book spa"
    },
    {
      name: "Sleep-focused turndown",
      meta: "May 27, 9:00 PM · cool room, charger left bedside, sparkling water",
      startsAt: "2026-05-27T21:00:00-07:00",
      endsAt: "2026-05-27T21:30:00-07:00",
      why: "This reflects staff observations about room temperature, bedside setup, and evening routine.",
      cta: "confirm setup"
    }
  ],
  learning: [
    {
      name: "Private estate tasting with nut-free pairings",
      meta: "May 27, 3:00 PM · chef-reviewed allergy notes",
      startsAt: "2026-05-27T15:00:00-07:00",
      endsAt: "2026-05-27T16:30:00-07:00",
      why: "You enjoy private tastings, and the nut allergy needs to be handled before service.",
      cta: "reserve tasting"
    },
    {
      name: "Cantor Arts Center private preview",
      meta: "May 28, 1:30 PM · short transfer · low-crowd window",
      startsAt: "2026-05-28T13:30:00-07:00",
      endsAt: "2026-05-28T15:00:00-07:00",
      why: "Your latent goal is local culture without overplanning or long transfer time.",
      cta: "request access"
    }
  ]
};

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Claude did not return JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: "Missing env var: ANTHROPIC_API_KEY" });
      return;
    }

    const mindmap = req.body?.mindmap || {};
    const calendarEvents = Array.isArray(req.body?.calendarEvents) ? req.body.calendarEvents : [];
    const prompt = `
Create a luxury Rosewood Sand Hill itinerary for May 26 through May 28, 2026.
Use this guest mind map:
${JSON.stringify(mindmap, null, 2)}

Use these Google Calendar events as fixed commitments. Do not create any recommendation that overlaps them:
${JSON.stringify(calendarEvents, null, 2)}

Return only valid JSON with this exact shape:
{
  "activity": [
    { "name": "...", "meta": "May 26, 9:00 AM · ...", "startsAt": "2026-05-26T09:00:00-07:00", "endsAt": "2026-05-26T10:00:00-07:00", "why": "One sentence explaining which guest preference, person, calendar event, or staff observation caused this recommendation.", "cta": "..." }
  ],
  "wellness": [
    { "name": "...", "meta": "May 27, 4:00 PM · ...", "startsAt": "2026-05-27T16:00:00-07:00", "endsAt": "2026-05-27T17:00:00-07:00", "why": "One sentence explaining which guest preference, person, calendar event, or staff observation caused this recommendation.", "cta": "..." }
  ],
  "learning": [
    { "name": "...", "meta": "May 28, 2:00 PM · ...", "startsAt": "2026-05-28T14:00:00-07:00", "endsAt": "2026-05-28T15:00:00-07:00", "why": "One sentence explaining which guest preference, person, calendar event, or staff observation caused this recommendation.", "cta": "..." }
  ]
}
Give 2 items per category. Respect nut allergy and sparkling water preference. Keep recommendations specific to Rosewood Sand Hill / Menlo Park / Bay Area luxury. The "why" must be specific, like "You're meeting John and he likes birdwatching" or "You want to stay fit during the trip." Calendar events are fixed; recommendations must fit around them.
`;

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 1000,
        system: "You are a Rosewood hospitality itinerary planner. Return compact valid JSON only.",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "Claude API request failed" });
      return;
    }

    const text = (data.content || [])
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    try {
      res.status(200).json({ itinerary: extractJson(text), model: data.model, fallback: false });
    } catch (parseError) {
      res.status(200).json({
        itinerary: FALLBACK_ITINERARY,
        model: data.model,
        fallback: true,
        warning: parseError.message
      });
    }
  } catch (error) {
    res.status(200).json({
      itinerary: FALLBACK_ITINERARY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      fallback: true,
      warning: error.message
    });
  }
};
