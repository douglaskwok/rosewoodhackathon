const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      res.status(500).json({ error: "Missing env var: ELEVENLABS_API_KEY" });
      return;
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      res.status(400).json({ error: "Text is required" });
      return;
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const response = await fetch(`${ELEVENLABS_BASE_URL}/${voiceId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text.slice(0, 1800),
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.78,
          style: 0.18,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText || "ElevenLabs request failed" });
      return;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
