# ChatGPT OAuth Pivot Status (2026-03-04)

## Scope
This document summarizes the ChatGPT integration pivot work completed so far in the `chatgpt-prototype` subfolder and captures remaining decisions for SecOps review.

## Final Direction Chosen
- Keep NocLense browser-based for now (no Electron migration for this initiative).
- Use a temporary backend for Action testing.
- Phase 1 uses a single provider path focused on ChatGPT-driven log analysis.
- Move away from direct browser-side OpenAI API key validation as the primary integration path for this prototype.

## Why We Pivoted
- Earlier OpenAI API validation surfaced repeated 4xx issues:
  - `max_output_tokens` below minimum (`8` vs required `>=16`).
  - `insufficient_quota` billing/quota error after request parameter issues were corrected.
- We also identified model/version drift risk from deprecated endpoints/models returning 4xx.
- Result: for this prototype, ChatGPT should do reasoning in-chat; backend serves tools/data via GPT Actions OAuth.

## What Was Implemented

### 1) Isolated prototype workspace
- Created: `chatgpt-prototype/`
- Added:
  - `chatgpt-prototype/server.mjs`
  - `chatgpt-prototype/openapi.yaml`
  - `chatgpt-prototype/.env.example`
  - `chatgpt-prototype/README.md`
  - `chatgpt-prototype/package.json`

### 2) OAuth + tool backend for GPT Actions
- Endpoints:
  - `GET /health`
  - `GET /oauth/authorize`
  - `GET /oauth/callback`
  - `POST /oauth/token`
  - `POST /v1/logs/submit`
  - `GET /v1/logs/{log_id}/context`
- Behavior:
  - No backend OpenAI inference in this prototype.
  - In-memory auth/session/log storage.
  - Bearer auth on tool endpoints.

### 3) OAuth modes supported
- `AUTH_MODE=dev` for local fake login flow.
- `AUTH_MODE=auth0` for real Auth0 bridge.
- `AUTH_MODE=oidc` for generic provider bridge (integration-style OAuth flow).

### 4) Generic OIDC support added (for non-Auth0 IdPs)
- New env vars in `.env.example`:
  - `OIDC_AUTHORIZE_URL`
  - `OIDC_TOKEN_URL`
  - `OIDC_USERINFO_URL`
  - `OIDC_CLIENT_ID`
  - `OIDC_CLIENT_SECRET`
  - `OIDC_SCOPE`
  - `OIDC_AUDIENCE`
- Server changes:
  - Redirect user to provider authorize endpoint from `/oauth/authorize`.
  - Handle provider callback in `/oauth/callback`.
  - Exchange provider code for access token.
  - Resolve user identity via userinfo endpoint.
  - Mint short-lived internal code/token for ChatGPT action calls.

## Related Code Updates in Main App (Earlier)
- `CodexProvider` moved toward recommended OpenAI SDK style.
- Prior `max_output_tokens` floor issue cleaned where stale value `8` was still present in one branch copy.
- Outcome: validation progressed from parameter error to quota/billing error, indicating request shape improved.

## Current Product/Architecture Position
- Supported, low-risk path: GPT Actions/App calls NocLense backend APIs.
- OAuth authenticates users to NocLense backend, not as a replacement for OpenAI API key auth.
- OpenClaw-style direct OpenAI PKCE subscription flow is not treated as a stable/supported baseline for this project at this time.

## SecOps Discussion Items
1. Confirm approved Identity Provider and tenant controls (Okta is candidate).
2. Confirm allowed callback domains for testing and production.
3. Define token lifetime, refresh policy, and session revocation requirements.
4. Confirm data handling policy for submitted log text (retention, redaction, PII).
5. Require encrypted-at-rest persistence before broader testing (current prototype is in-memory only).
6. Define audit logging requirements for OAuth and tool access.
7. Define provider allowlist and strict redirect URI allowlist.
8. Confirm whether enterprise ChatGPT policy allows this Action/App integration model.

## Known Gaps Before Production
- No persistent database for sessions/log payloads.
- No refresh token support.
- No rate limiting / abuse controls.
- No hardened CSRF/nonce/session binding beyond basic state handling.
- No tenant-aware RBAC model.
- No secrets manager integration.

## Recommended Next Steps After SecOps
1. Lock target IdP (Okta or other) and approved environments.
2. Implement production auth hardening in `chatgpt-prototype`:
   - strict redirect allowlist
   - nonce + PKCE validation for upstream provider
   - refresh token flow (if required)
   - secure storage + rotation strategy
3. Add persistent storage and retention controls for logs/sessions.
4. Add audit logs + request tracing.
5. Run security review + threat model + penetration checklist.
6. Promote prototype into structured service folder once controls are approved.

## Quick Resume Reference
- Primary prototype folder: `chatgpt-prototype/`
- Setup guide: `chatgpt-prototype/README.md`
- API schema for GPT Actions import: `chatgpt-prototype/openapi.yaml`
- Environment template: `chatgpt-prototype/.env.example`
