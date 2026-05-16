const crypto = require("crypto");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cachedToken = null;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(value) {
  return value.replace(/\\n/g, "\n");
}

function requireGcpEnv() {
  const missing = [
    "GCP_PROJECT_ID",
    "GCP_SERVICE_ACCOUNT_EMAIL",
    "GCP_PRIVATE_KEY"
  ].filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

async function getGcpAccessToken() {
  requireGcpEnv();

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claim = {
    iss: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    scope: CLOUD_PLATFORM_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(normalizePrivateKey(process.env.GCP_PRIVATE_KEY));
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Could not get GCP access token");
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000
  };
  return cachedToken.accessToken;
}

async function createVertexEmbedding(input) {
  const accessToken = await getGcpAccessToken();
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || "us-central1";
  const model = process.env.GCP_EMBEDDING_MODEL || "gemini-embedding-001";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          content: input,
          task_type: "SEMANTIC_SIMILARITY"
        }
      ],
      parameters: {
        autoTruncate: true,
        outputDimensionality: 768
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Vertex AI embedding request failed");
  }

  const values = data.predictions?.[0]?.embeddings?.values;
  if (!values) {
    throw new Error("Vertex AI embedding response did not include vector values");
  }

  return values;
}

async function createVertexEmbeddings(inputs) {
  const embeddings = [];
  for (const input of inputs) {
    embeddings.push(await createVertexEmbedding(input));
  }
  return embeddings;
}

module.exports = {
  createVertexEmbeddings,
  requireGcpEnv
};
