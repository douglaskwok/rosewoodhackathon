const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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

    const transcript = String(req.body?.transcript || "").trim();
    if (!transcript) {
      res.status(400).json({ error: "Transcript is required" });
      return;
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 700,
        system: "You are a superhospitality master: an elite Rosewood guest-memory curator who notices explicit needs, latent goals, service risks, and tiny preference signals that would let staff deliver unusually thoughtful care. Convert conversation notes into concise, useful guest memories. Return valid JSON only.",
        messages: [
          {
            role: "user",
            content: `
Transcript:
${transcript}

The transcript may include multiple speakers or multiple distinct preferences.
Extract up to 5 useful mind map memories.

Your goal is to capture actual guest needs, not random facts. Prioritize:
- explicit needs or constraints the staff must honor
- latent goals behind the guest's words, such as rest, fitness, focus, bonding, privacy, discovery, recovery, or celebration
- preferences that would change service, itinerary, food, room setup, or staff behavior
- small but actionable details that would make the guest feel remembered

Do not add a memory if it is vague, temporary, unimportant, or just conversation filler.
If a statement implies a deeper need, use the goals branch and phrase it as the need.
Example: "I have back-to-back meetings but want to keep moving" becomes "Stay fit between work commitments."
Keep each item short, label-like, and scannable. Prefer "No caffeine after 11" over "The guest does not want caffeine after 11 AM."

Use these branches:
- food
- events
- goals
- observations

Return only JSON:
{
  "items": [
    {
      "branch": "food|events|goals|observations",
      "item": "one concise mind map node, max 5 words",
      "reason": "one short reason"
    }
  ]
}

If speaker labels are present, use them as context but do not include staff names unless they matter to the preference.
Only include stable guest preferences, goals, or staff observations. Skip filler, greetings, and uncertain details.

Prefer:
- food for dietary needs, drinks, restaurants, table/service preferences
- events for experiences, hobbies, meetings, nightlife, cultural interests
- goals for latent intentions like rest, fitness, focus, bonding, discovery
- observations for staff-only operational details or very niche behavior
`
          }
        ]
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
    const parsed = extractJson(text);
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [parsed];
    const items = rawItems
      .map((note) => {
        const branch = ["food", "events", "goals", "observations"].includes(note.branch)
          ? note.branch
          : "observations";
        return {
          branch,
          item: String(note.item || "").trim(),
          reason: String(note.reason || "").trim()
        };
      })
      .filter((note) => note.item)
      .slice(0, 5);

    res.status(200).json({ items, model: data.model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
