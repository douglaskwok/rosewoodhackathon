# Rosewood Compass Wireframe

Minimal static HTML wireframe for a Rosewood Compass web app.

## Live Demo

https://rosewoodhackathon.vercel.app/

## Includes

- User onboarding screen with logo, title, and integration buttons.
- Admin onboarding screen with a simple preference mind map.
- User/admin weekly calendar screen for a Tuesday-Thursday stay, with large blocks for flight, image, and link placeholders.
- Real Google OAuth entry point for Gmail read-only integration.
- Google login status that shows the signed-in user's name.

## Gmail OAuth Setup

In Google Cloud Console:

1. Enable the Gmail API.
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

## Run

Open `index.html` directly in a browser.
