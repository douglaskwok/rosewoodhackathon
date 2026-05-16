const RESEND_URL = "https://api.resend.com/emails";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      res.status(500).json({ error: "Missing env var: RESEND_API_KEY" });
      return;
    }

    const to = String(req.body?.to || "").trim();
    if (!to || !to.includes("@")) {
      res.status(400).json({ error: "A recipient email is required" });
      return;
    }

    const restaurant = String(req.body?.restaurant || "Madera Restaurant at Rosewood Sand Hill");
    const date = String(req.body?.date || "2026-05-27");
    const time = String(req.body?.time || "19:00");
    const covers = String(req.body?.covers || "2");
    const from = process.env.RESEND_FROM_EMAIL || "Rosewood Compass <onboarding@resend.dev>";

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;background:#f4efe7;padding:32px;color:#211d18">
        <div style="max-width:620px;margin:auto;background:#fffaf2;border:1px solid #ded3c4;padding:30px">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:lowercase;color:#8a7158">rosewood compass</div>
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:18px 0 8px">Dining request received</h1>
          <p style="line-height:1.7;color:#5f554b">Your concierge dining request has been prepared. Please confirm final availability through the restaurant booking page.</p>
          <div style="margin:24px 0;border-top:1px solid #e5dacb;border-bottom:1px solid #e5dacb;padding:18px 0">
            <p><strong>Restaurant</strong><br>${escapeHtml(restaurant)}</p>
            <p><strong>Date</strong><br>${escapeHtml(date)}</p>
            <p><strong>Time</strong><br>${escapeHtml(time)}</p>
            <p><strong>Party size</strong><br>${escapeHtml(covers)}</p>
          </div>
          <p style="font-size:12px;line-height:1.7;color:#7b6c5c">This is a Rosewood Compass demo confirmation, not a final OpenTable reservation confirmation.</p>
        </div>
      </div>
    `;

    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Dining request: ${restaurant}`,
        html
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(response.status).json({ error: data.message || "Email request failed" });
      return;
    }

    res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
