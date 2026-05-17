# Rosewood: Curated by Tia

Minimal concierge web app prototype for Rosewood, curated by Tia.

## Live Demo

https://rosewoodhackathon.vercel.app/

## Includes

- User onboarding screen with logo, warm greeting, and integration buttons.
- Admin onboarding screen with a simple preference mind map.
- User/admin weekly calendar screen that renders connected Google Calendar events.
- Real Google OAuth entry point for Gmail read-only integration.
- Google login status that shows the signed-in user's name.
- Google Calendar week view for May 24-30, 2026.
- Arrival info card that shows the latest arrival-related Gmail message.
- Admin preference mind map with a reliable demo profile and optional Vertex AI embedding mode.
- Editable hierarchical admin mind map saved locally in the browser.
- Claude-generated May 26-28 activities and itinerary from the local mind map, with fallback JSON.
- Tia booking flow that can add recommended activities to Google Calendar and help users book activities.

## Gmail OAuth Setup

In Google Cloud Console:

1. Enable the Gmail API and Google Calendar API.
2. Create an OAuth client for a Web application.
3. Add this Authorized redirect URI:

```txt
https://rosewoodhackathon.vercel.app/api/auth/google/callback
```

In Vercel Project Settings > Environment Variables, add:

```txt
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
APP_URL=https://rosewoodhackathon.vercel.app
GOOGLE_REDIRECT_URI=https://rosewoodhackathon.vercel.app/api/auth/google/callback
```

Then redeploy.

After adding Calendar integration, sign in again so Google can ask for the new Calendar read-only permission.

## Vertex AI Embeddings Setup

Enable the Vertex AI API in the same Google Cloud project, then create a service account with permission to call Vertex AI.

Add these Vercel Environment Variables:

```txt
GCP_PROJECT_ID=your-google-cloud-project-id
GCP_LOCATION=us-central1
GCP_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GCP_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GCP_EMBEDDING_MODEL=gemini-embedding-001
```

The admin mind map calls `/api/preferences/mindmap`. By default it returns a polished demo profile. To use real Vertex AI embeddings, set:

```txt
USE_VERTEX_MINDMAP=true
```

Then the endpoint embeds relevant Gmail snippets and groups them into food preferences, favorite events, and latent goals.

## Claude API Setup

Add these Vercel Environment Variables:

```txt
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Claude routes run server-side so the API key stays private.

## Run

Open `index.html` directly in a browser.
