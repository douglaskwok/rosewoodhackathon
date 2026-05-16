const { getValidAccessToken, requireGoogleEnv } = require("../_google");
const { createVertexEmbeddings, requireGcpEnv } = require("../_gcp");

const EMBEDDING_MODEL = process.env.GCP_EMBEDDING_MODEL || "gemini-embedding-001";
const GMAIL_QUERY = [
  "newer_than:365d",
  "(dinner OR restaurant OR reservation OR menu OR allergy OR dietary OR event OR concert OR spa OR yoga OR pilates OR tour OR tasting OR itinerary OR travel OR birthday OR anniversary OR meeting)"
].join(" ");

const PREFERENCE_AREAS = [
  {
    key: "foodPreferences",
    label: "Food preferences + dietary needs",
    prototype: "dietary restrictions allergies vegan vegetarian gluten free dairy free cuisine preferences restaurant dinner reservations dislikes favorite foods"
  },
  {
    key: "favoriteEvents",
    label: "Favorite events",
    prototype: "favorite activities events concerts tastings wellness spa yoga pilates tours art music sports social plans reservations experiences"
  },
  {
    key: "latentGoals",
    label: "Latent goals",
    prototype: "underlying travel goals rest recharge productivity family celebration learning fitness social connection relaxation recovery"
  }
];

const TAGS = {
  foodPreferences: [
    "vegetarian", "vegan", "gluten-free", "dairy-free", "allergy", "sushi", "Japanese",
    "Italian", "Mediterranean", "Thai", "Mexican", "Indian", "wine", "coffee", "brunch",
    "dinner", "tasting menu", "reservation"
  ],
  favoriteEvents: [
    "concert", "spa", "yoga", "pilates", "tour", "tasting", "dinner", "reservation",
    "meeting", "workshop", "museum", "art", "music", "birthday", "anniversary"
  ],
  latentGoals: [
    "relax", "recharge", "recover", "fitness", "wellness", "learning", "celebration",
    "family", "social", "productive", "quiet", "luxury", "connection"
  ]
};

const DEMO_NODES = [
  {
    key: "foodPreferences",
    label: "Food preferences + dietary needs",
    insight: "Japanese, Mediterranean, seasonal tasting menus; prefers quiet tables; light dairy",
    confidence: 0.92,
    evidence: [
      {
        subject: "Dinner reservation confirmed",
        from: "Madera Reservations",
        date: "Demo",
        snippet: "Quiet table, seasonal menu, lighter dairy notes.",
        similarity: 0.94
      }
    ]
  },
  {
    key: "favoriteEvents",
    label: "Favorite events",
    insight: "Private tastings, wellness classes, art/design tours, intimate dinners",
    confidence: 0.88,
    evidence: [
      {
        subject: "Private tasting itinerary",
        from: "Concierge",
        date: "Demo",
        snippet: "Chef tasting, spa block, design tour, and dinner plans.",
        similarity: 0.91
      }
    ]
  },
  {
    key: "latentGoals",
    label: "Latent goals",
    insight: "Recharge between work commitments; stay fit while traveling; discover local culture without overplanning",
    confidence: 0.84,
    evidence: [
      {
        subject: "Calendar holds and arrival plan",
        from: "Google Calendar + Gmail",
        date: "Demo",
        snippet: "Sparse schedule, protected recovery windows, wellness and culture signals.",
        similarity: 0.87
      }
    ]
  }
];

function queryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

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

async function fetchPreferenceMessages(accessToken) {
  const list = await gmailFetch(
    `messages?maxResults=20&q=${encodeURIComponent(GMAIL_QUERY)}`,
    accessToken
  );

  return Promise.all(
    (list.messages || []).map(async (message) => {
      const detail = await gmailFetch(
        `messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        accessToken
      );
      const headers = headersByName(detail.payload?.headers || []);
      return {
        id: detail.id,
        subject: headers.subject || "(no subject)",
        from: headers.from || "",
        date: headers.date || "",
        snippet: detail.snippet || ""
      };
    })
  );
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findTags(key, texts) {
  const source = texts.join(" ").toLowerCase();
  return TAGS[key].filter((tag) => source.includes(tag.toLowerCase())).slice(0, 6);
}

function fallbackInsight(key, tags) {
  if (tags.length) return tags.join(", ");
  if (key === "foodPreferences") return "No strong dietary signal yet";
  if (key === "favoriteEvents") return "No strong event pattern yet";
  return "Not enough evidence for a latent goal yet";
}

module.exports = async function handler(req, res) {
  try {
    const mode = queryValue(req.query.mode) || "vertex";
    const useVertex = mode === "vertex" && process.env.USE_VERTEX_MINDMAP === "true";
    if (!useVertex) {
      res.status(200).json({
        model: "demo-profile",
        provider: "demo",
        query: "pre-seeded demo signals",
        nodes: DEMO_NODES
      });
      return;
    }

    requireGoogleEnv();
    requireGcpEnv();

    const accessToken = await getValidAccessToken(req, res);
    if (!accessToken) {
      res.status(401).json({ error: "Gmail is not connected" });
      return;
    }

    const messages = await fetchPreferenceMessages(accessToken);
    if (!messages.length) {
      res.status(200).json({
        model: EMBEDDING_MODEL,
        query: GMAIL_QUERY,
        nodes: PREFERENCE_AREAS.map((area) => ({
          ...area,
          insight: "No matching emails found",
          confidence: 0,
          evidence: []
        }))
      });
      return;
    }

    const messageTexts = messages.map((message) => `${message.subject}. ${message.snippet}`);
    const inputs = [
      ...PREFERENCE_AREAS.map((area) => area.prototype),
      ...messageTexts
    ];
    const embeddings = await createVertexEmbeddings(inputs);
    const labelEmbeddings = embeddings.slice(0, PREFERENCE_AREAS.length);
    const messageEmbeddings = embeddings.slice(PREFERENCE_AREAS.length);

    const nodes = PREFERENCE_AREAS.map((area, areaIndex) => {
      const ranked = messages
        .map((message, messageIndex) => ({
          message,
          score: cosineSimilarity(labelEmbeddings[areaIndex], messageEmbeddings[messageIndex])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      const evidenceTexts = ranked.map((item) => `${item.message.subject}. ${item.message.snippet}`);
      const tags = findTags(area.key, evidenceTexts);
      const averageScore = ranked.reduce((sum, item) => sum + item.score, 0) / Math.max(1, ranked.length);

      return {
        key: area.key,
        label: area.label,
        insight: fallbackInsight(area.key, tags),
        confidence: Number(Math.max(0, Math.min(1, averageScore)).toFixed(2)),
        evidence: ranked.map((item) => ({
          subject: item.message.subject,
          from: item.message.from,
          date: item.message.date,
          snippet: item.message.snippet,
          similarity: Number(item.score.toFixed(3))
        }))
      };
    });

    res.status(200).json({
      model: EMBEDDING_MODEL,
      provider: "vertex-ai",
      query: GMAIL_QUERY,
      nodes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
