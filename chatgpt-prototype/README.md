# NocLense ChatGPT Prototype

Temporary backend for GPT Actions testing. This prototype uses OAuth + tool endpoints and lets ChatGPT handle reasoning using user subscription capacity.

## What this prototype does

- Accepts raw logs (`/v1/logs/submit`)
- Returns structured context (`/v1/logs/{log_id}/context`)
- Provides OAuth endpoints for GPT Actions:
  - `/oauth/authorize`
  - `/oauth/token`
- Does **not** call OpenAI API for inference in this prototype.

## Local run

1. Open terminal in `chatgpt-prototype`.
2. Set environment variables from `.env.example` in your shell.
3. Run:

```bash
npm run dev
```

4. Verify health:

```bash
curl http://localhost:8788/health
```

## GPT Actions setup (step-by-step)

This is the OAuth flow users will experience in ChatGPT.

1. Start this service locally, then expose it publicly using a tunnel (for example ngrok or cloudflared).
2. Update `openapi.yaml` server URL and OAuth URLs to your public HTTPS URL.
3. In ChatGPT, create/edit a GPT and open **Actions**.
4. Import `openapi.yaml`.
5. In Action authentication, choose **OAuth** and set:
   - Authorization URL: `https://<your-host>/oauth/authorize`
   - Token URL: `https://<your-host>/oauth/token`
   - Client ID: `OAUTH_CLIENT_ID`
   - Client Secret: `OAUTH_CLIENT_SECRET`
6. Save once in GPT Builder, then copy the callback URL(s) ChatGPT shows.
7. Register those callback URL(s) in your OAuth provider/app configuration.
8. Save again and test an action call from ChatGPT:
   - It should prompt user sign-in
   - OAuth redirects back to ChatGPT
   - ChatGPT can call `submitLogs` and `getLogContext`

## Important OAuth note

This OAuth authenticates users to **your action backend**.  
It is not "OpenAI API OAuth" for your app. For this prototype, GPT handles reasoning and your backend only serves log tooling endpoints.

## Real login setup (Auth0)

Use this when you want a real user login experience instead of the dev OAuth shortcut.

1. Create an Auth0 **Regular Web Application**.
2. Configure Auth0 app callback URL:
   - `https://<your-public-host>/oauth/callback`
3. Configure logout URL(s) as needed for your test environment.
4. In `chatgpt-prototype` env, set:
   - `AUTH_MODE=auth0`
   - `AUTH0_DOMAIN=<tenant>.auth0.com`
   - `AUTH0_CLIENT_ID=<auth0 app client id>`
   - `AUTH0_CLIENT_SECRET=<auth0 app client secret>`
   - Optional: `AUTH0_AUDIENCE=<auth0 api audience>`
5. Restart backend.
6. Keep GPT Action OAuth endpoints pointing to your backend:
   - Authorization URL: `https://<your-public-host>/oauth/authorize`
   - Token URL: `https://<your-public-host>/oauth/token`

### User login flow with Auth0 enabled

1. User invokes Action in ChatGPT.
2. ChatGPT redirects user to backend `/oauth/authorize`.
3. Backend redirects to Auth0 Universal Login.
4. User signs in on Auth0.
5. Auth0 calls backend `/oauth/callback`.
6. Backend issues a short-lived internal auth code and redirects back to ChatGPT callback.
7. ChatGPT exchanges code at backend `/oauth/token` and calls your protected endpoints with bearer token.

## Real login setup (Generic OIDC / integration-style)

Use this mode if your identity provider is not Auth0 and supports standard OAuth/OIDC endpoints.

1. In `chatgpt-prototype` env, set:
   - `AUTH_MODE=oidc`
   - `OIDC_AUTHORIZE_URL=<provider authorize endpoint>`
   - `OIDC_TOKEN_URL=<provider token endpoint>`
   - `OIDC_USERINFO_URL=<provider userinfo endpoint>`
   - `OIDC_CLIENT_ID=<provider app client id>`
   - `OIDC_CLIENT_SECRET=<provider app client secret>`
   - Optional: `OIDC_SCOPE` (default `openid profile email`)
   - Optional: `OIDC_AUDIENCE`
2. In your identity provider app, add callback URL:
   - `https://<your-public-host>/oauth/callback`
3. Restart backend.
4. Keep GPT Action OAuth endpoints pointing to your backend:
   - Authorization URL: `https://<your-public-host>/oauth/authorize`
   - Token URL: `https://<your-public-host>/oauth/token`

### User login flow with OIDC enabled

1. User invokes Action in ChatGPT.
2. ChatGPT redirects user to backend `/oauth/authorize`.
3. Backend redirects to your configured OIDC provider login.
4. User signs in with the provider.
5. Provider calls backend `/oauth/callback`.
6. Backend exchanges provider code, resolves user identity from `userinfo`, and issues an internal auth code.
7. Backend redirects to ChatGPT callback with internal auth code.
8. ChatGPT exchanges that code at `/oauth/token` and calls protected endpoints.

## Example tool flow in ChatGPT

1. Call `submitLogs` with pasted log text.
2. Call `getLogContext` with returned `log_id`.
3. Ask ChatGPT to analyze the returned summary and sample error lines.

## Current limitations

- In-memory storage only (data resets on restart)
- Single-user dev behavior (`OAUTH_DEV_USER_ID`)
- No file upload endpoint (Option B: text/pre-uploaded flow only)
- No production auth/session hardening yet
