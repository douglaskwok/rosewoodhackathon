const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const FALLBACK_ITINERARY = {
  activity: [
    {
      name: "Morning walk through the Stanford Dish foothills",
      meta: "May 26, 8:30 AM · private guide · sparkling water packed",
      why: "You want to stay fit during the trip, and this keeps movement low-friction after arrival.",
      cta: "reserve guide"
    },
    {
      name: "Low-impact private Pilates at Rosewood",
      meta: "May 28, 10:00 AM · quiet studio · nut-free recovery snack",
      why: "Your profile favors wellness that supports energy without over-scheduling the day.",
      cta: "add to calendar"
    }
  ],
  wellness: [
    {
      name: "Asaya-inspired recovery ritual",
      meta: "May 26, 4:30 PM · steam, massage, hydration service",
      why: "Staff notes show you value recovery windows and sparkling water after travel.",
      cta: "book spa"
    },
    {
      name: "Sleep-focused turndown",
      meta: "May 27, 9:00 PM · cool room, charger left bedside, sparkling water",
      why: "This reflects staff observations about room temperature, bedside setup, and evening routine.",
      cta: "confirm setup"
    }
  ],
  learning: [
    {
      name: "Private estate tasting with nut-free pairings",
      meta: "May 27, 3:00 PM · chef-reviewed allergy notes",
      why: "You enjoy private tastings, and the nut allergy needs to be handled before service.",
      cta: "reserve tasting"
    },
    {
      name: "Cantor Arts Center private preview",
      meta: "May 28, 1:30 PM · short transfer · low-crowd window",
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
    const prompt = `
Create a luxury Rosewood Sand Hill itinerary for May 26 through May 28, 2026.
Use this guest mind map:
${JSON.stringify(mindmap, null, 2)}

Return only valid JSON with this exact shape:
{
  "activity": [
    { "name": "...", "meta": "May 26, 9:00 AM · ...", "why": "One sentence explaining which guest preference, person, calendar event, or staff observation caused this recommendation.", "cta": "..." }
  ],
  "wellness": [
    { "name": "...", "meta": "May 27, 4:00 PM · ...", "why": "One sentence explaining which guest preference, person, calendar event, or staff observation caused this recommendation.", "cta": "..." }
  ],
  "learning": [
    { "name": "...", "meta": "May 28, 2:00 PM · ...", "why": "One sentence explaining which guest preference, person, calendar event, or staff observation caused this recommendation.", "cta": "..." }
  ]
}
Give 2 items per category. Respect nut allergy and sparkling water preference. Keep recommendations specific to Rosewood Sand Hill / Menlo Park / Bay Area luxury. The "why" must be specific, like "You're meeting John and he likes birdwatching" or "You want to stay fit during the trip."
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
