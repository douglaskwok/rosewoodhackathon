# Rosewood Compass Wireframe

Minimal static HTML wireframe for a Rosewood Compass web app.

## Live Demo

https://rosewoodhackathon.vercel.app/

## Includes

- User onboarding screen with logo, title, and integration buttons.
- Admin onboarding screen with a simple preference mind map.
- User/admin weekly calendar screen that renders connected Google Calendar events.
- Real Google OAuth entry point for Gmail read-only integration.
- Google login status that shows the signed-in user's name.
- Google Calendar week view for May 24-30, 2026.
- Arrival info card that shows the latest arrival-related Gmail message.

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

To verify the deployed backend is configured, open:

```txt
https://rosewoodhackathon.vercel.app/api/auth/config
```

It should return `"ready": true`.

To debug Calendar access after signing in, open:

```txt
https://rosewoodhackathon.vercel.app/api/calendar/debug
```

It should include `calendar.readonly` in `tokenScopes`.

After adding Calendar integration, sign in again so Google can ask for the new Calendar read-only permission.

## Run

Open `index.html` directly in a browser.
