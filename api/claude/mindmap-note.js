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
        max_tokens: 300,
        system: "You convert hotel staff conversation notes into one concise guest preference memory. Return valid JSON only.",
        messages: [
          {
            role: "user",
            content: `
Transcript:
${transcript}

Choose exactly one branch:
- food
- events
- goals
- observations

Return only JSON:
{
  "branch": "food|events|goals|observations",
  "item": "one concise mind map node, max 9 words",
  "reason": "one short reason"
}

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
    const note = extractJson(text);
    const branch = ["food", "events", "goals", "observations"].includes(note.branch)
      ? note.branch
      : "observations";

    res.status(200).json({
      branch,
      item: String(note.item || "").trim(),
      reason: String(note.reason || "").trim(),
      model: data.model
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
