const { getValidAccessToken, requireGoogleEnv } = require("../_google");

const RESEND_URL = "https://api.resend.com/emails";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function validDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.valueOf()) ? null : date;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

function eventPayload(item) {
  return {
    summary: item.name || "Rosewood Compass booking",
    description: [
      item.why ? `Why: ${item.why}` : "",
      item.meta ? `Details: ${item.meta}` : "",
      "Added by Rosewood Compass."
    ].filter(Boolean).join("\n"),
    start: { dateTime: item.startsAt },
    end: { dateTime: item.endsAt }
  };
}

async function askClaudeForCalendarAction({ command, calendarEvents, plannedItems }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing env var: ANTHROPIC_API_KEY");
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
      max_tokens: 500,
      system: "You are a careful calendar booking agent. Convert voice commands into one safe calendar action. Return valid JSON only.",
      messages: [{
        role: "user",
        content: `
Voice command:
${command}

Existing Google Calendar events:
${JSON.stringify(calendarEvents, null, 2)}

Planned recommendations not necessarily on calendar yet:
${JSON.stringify(plannedItems, null, 2)}

Return one JSON object:
{
  "action": "add|reschedule|delete",
  "eventId": "existing calendar event id when rescheduling/deleting, else empty",
  "targetTitle": "event title to match if eventId is empty",
  "name": "title for add or new title for reschedule",
  "startsAt": "ISO datetime with -07:00 timezone if adding/rescheduling",
  "endsAt": "ISO datetime with -07:00 timezone if adding/rescheduling",
  "why": "short reason or notes"
}

Rules:
- Prefer eventId from existing events for reschedule/delete.
- If adding from a planned recommendation, copy its name/startsAt/endsAt.
- For vague dates, keep within May 26-28, 2026.
- Do not invent deletion unless the command clearly says delete/cancel/remove.
`
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Claude calendar command failed");
  const text = (data.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
  return extractJson(text);
}

function findEventId(action, calendarEvents) {
  if (action.eventId) return action.eventId;
  const target = String(action.targetTitle || action.name || "").toLowerCase();
  if (!target) return "";
  const match = (calendarEvents || []).find((event) => String(event.title || "").toLowerCase().includes(target));
  return match?.id || "";
}

async function sendConfirmationEmail({ to, item }) {
  if (!process.env.RESEND_API_KEY || !to) return null;

  const from = process.env.RESEND_FROM_EMAIL || "GrabGrub <onboarding@resend.dev>";
  const start = validDate(item.startsAt);
  const date = start ? start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "May 26-28, 2026";
  const time = start ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD";
  const code = `GG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#fff3f6;padding:32px;color:#22131a">
      <div style="max-width:620px;margin:auto;background:#ffffff;border:2px solid #ff5a7d;padding:0;box-shadow:8px 8px 0 #2ee6a6">
        <div style="padding:22px 28px;border-bottom:2px solid #ff5a7d;background:#ff3d6e;color:#fff">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.02em">GrabGrub</div>
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#ffe66d;margin-top:4px">Booking concierge</div>
        </div>
        <div style="padding:30px 28px">
          <div style="display:inline-block;background:#2ee6a6;color:#06261b;border:2px solid #12b880;padding:7px 10px;font-size:12px;font-weight:800;margin-bottom:18px">Booking request confirmed</div>
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;margin:0 0 10px">${escapeHtml(item.name)}</h1>
          <p style="line-height:1.7;color:#5b3140;margin:0">GrabGrub prepared this booking request and added it to your calendar.</p>
          <div style="margin:24px 0;border-top:2px solid #ffcc00;border-bottom:2px solid #ffcc00;padding:18px 0">
            <p><strong>Confirmation code</strong><br>${escapeHtml(code)}</p>
            <p><strong>Date</strong><br>${escapeHtml(date)}</p>
            <p><strong>Time</strong><br>${escapeHtml(time)}</p>
            <p><strong>Notes</strong><br>${escapeHtml(item.why || "Personalized Rosewood Compass recommendation.")}</p>
          </div>
          <p style="font-size:12px;line-height:1.7;color:#765062;margin:0">Final partner availability may still require venue confirmation. This message was generated by GrabGrub.</p>
        </div>
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
      subject: `GrabGrub booking request confirmed: ${item.name}`,
      html
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Email request failed");
  return data.id || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  try {
    requireGoogleEnv();
    const accessToken = await getValidAccessToken(req, res);
    if (!accessToken) {
      res.status(401).json({ error: "Google Calendar is not connected" });
      return;
    }

    const command = String(req.body?.command || "").trim();
    if (command) {
      const calendarEvents = Array.isArray(req.body?.calendarEvents) ? req.body.calendarEvents : [];
      const plannedItems = Array.isArray(req.body?.plannedItems) ? req.body.plannedItems : [];
      const email = String(req.body?.email || "").trim();
      const action = await askClaudeForCalendarAction({ command, calendarEvents, plannedItems });
      const eventId = findEventId(action, calendarEvents);

      if (action.action === "delete") {
        if (!eventId) throw new Error("I could not find a matching calendar event to delete.");
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error?.message || "Google Calendar delete failed");
        }
        res.status(200).json({ action: "delete", decision: action, message: "Deleted matching calendar event." });
        return;
      }

      if (!validDate(action.startsAt) || !validDate(action.endsAt)) {
        throw new Error("I need a clear date and time for that calendar change.");
      }

      const item = {
        name: action.name || action.targetTitle || "Rosewood Compass booking",
        startsAt: action.startsAt,
        endsAt: action.endsAt,
        why: action.why || `Voice command: ${command}`,
        meta: `Voice calendar agent · ${command}`
      };

      if (action.action === "reschedule") {
        if (!eventId) throw new Error("I could not find a matching calendar event to reschedule.");
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(eventPayload(item))
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Google Calendar reschedule failed");
        if (email) await sendConfirmationEmail({ to: email, item });
        res.status(200).json({ action: "reschedule", decision: action, message: `Rescheduled ${data.summary}.`, event: data });
        return;
      }

      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(eventPayload(item))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Google Calendar insert failed");
      if (email) await sendConfirmationEmail({ to: email, item });
      res.status(200).json({ action: "add", decision: action, message: `Added ${data.summary}.`, event: data });
      return;
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const email = String(req.body?.email || "").trim();
    const publishable = items.filter((item) => validDate(item.startsAt) && validDate(item.endsAt));
    const created = [];
    const emailed = [];

    for (const item of publishable) {
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(eventPayload(item))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Google Calendar insert failed");
      created.push({ title: data.summary, id: data.id, link: data.htmlLink });

      if (email) {
        const emailId = await sendConfirmationEmail({ to: email, item });
        if (emailId) emailed.push(emailId);
      }
    }

    res.status(200).json({ created, emailed, skipped: items.length - publishable.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
