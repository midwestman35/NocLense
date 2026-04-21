# NocLense Tauri Migration — Design Spec

**Date:** 2026-04-20
**Version:** v2 (draft)
**Owner:** Enrique Velazquez, Network Engineer, SaaS Operations (Axon Enterprise / APEX)
**Status:** Draft v2 — awaiting `/codex:adversarial-review` re-review before implementation begins
**Role split:** Claude designs and reviews; Codex implements commit-by-commit with self-assessment after each commit (per `feedback_codex_review_cycle.md`)

**Related specs:**
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` — UI polish redesign (parallel work on `redesign/ui-polish` branch; not blocked by this migration)
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` — Procurement / IT request (approvals checklist; companion to this spec)

---

## Revision history

| Version | Date | Summary of changes |
|---|---|---|
| v1 | 2026-04-20 | Initial draft. Shared HMAC baked into Tauri binary; stateless proxy with generic passthrough for Zendesk/Confluence/Jira; in-memory nonce cache; Electron integrations cut at T+45 of token rotation. |
| **v2** | **2026-04-20** | **Post-adversarial-review amendments (four structural changes):** (1) Per-device revocable credentials replace shared baked HMAC; DynamoDB device registry enables per-seat revocation without fleet rotation. (2) DynamoDB-backed nonce + idempotency store replaces in-memory cache; shared replay prevention across Lambda containers; idempotency keys required on mutating ops. (3) Path allowlists per integration replace generic `{method, path, body}` passthrough; proxy rejects any vendor path not in the allowlist. (4) Electron-via-proxy (shimmed) productionized and stays functional through the entire pilot window; only retired at Phase 3 cutover post-GO-gate. |

---

## Executive Summary

NocLense is migrating from Electron + Vercel serverless proxies to a standalone Tauri 2.x desktop application backed by a dedicated integration proxy on AWS.

**Three independent failure domains replace today's single-point-of-failure:**

1. **Tauri client** — zero integration secrets in the distributed binary. Per-device credential (HMAC key) issued at first-run enrollment and stored in OS keyring; revocable per seat without fleet-wide impact.
2. **AWS-hosted integration proxy** — holds the 5 org admin credentials in AWS Secrets Manager; Lambda + API Gateway + DynamoDB for device registry, nonces, and idempotency keys. Path-allowlisted per integration.
3. **GitHub Enterprise Releases** — hosts signed `.msi` binaries + Ed25519-signed update manifest.

**Timeline:** ~8–10 weeks engineering after approvals land (up from ~6–8 in v1 due to enrollment flow + DynamoDB + path allowlists). Procurement/approval work (AWS access, EV cert, security review) can run in parallel (~2–4 weeks).

**Budget:** ~$984/yr recurring (+$4/yr for DynamoDB); $0 one-time capex. (Detail in `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`.)

**Risk profile:** Low. 95% of the React codebase is shell-agnostic and ports unchanged; the Electron native surface is ~430 LOC and maps to ~700 LOC of Rust (up from v1's ~600 LOC due to enrollment flow and keyring integration). The UI polish redesign on its parallel branch is not affected.

---

## Table of Contents

1. [Context and motivation](#1-context-and-motivation)
2. [Architecture overview (end-state)](#2-architecture-overview-end-state)
3. [Sequencing plan](#3-sequencing-plan)
4. [Proxy service design](#4-proxy-service-design)
5. [Tauri shell design](#5-tauri-shell-design)
6. [Rollout and pilot plan](#6-rollout-and-pilot-plan)
7. [Non-goals](#7-non-goals)
8. [References](#8-references)
9. [Appendix A — Risk register](#9-appendix-a--risk-register)
10. [Appendix B — Budget](#10-appendix-b--budget)

---

## 1. Context and motivation

### 1.1 Current state

NocLense is an internal NOC operational tool for the SaaS Operations team on the Axon APEX (formerly Carbyne APEX) NG911 platform. Core workflows: Zendesk ticket triage, Jira R&D escalations, Datadog log analysis, Confluence runbook lookup, Unleashed AI-assisted root-cause investigation.

Current deployment targets two runtimes sharing one React 19 + Vite codebase:

- **Electron desktop app** — installed on NOC workstations; bundles Chromium; holds all 5 integration tokens as `VITE_*` environment variables compiled into the app bundle. NSIS installer, ~120MB.
- **Web app on Vercel** — served from Vercel; integration calls proxied through Vercel serverless functions that inject credentials server-side.

Branching between runtimes is managed by `window.electronAPI` detection across 11 files: 6 service wrappers (`unleashService`, `zendeskService`, `jiraService`, `datadogService`, `confluenceService`, `UnleashProvider`), `apiKeyStorage.ts`, `CrashReportsPanel.tsx`, 2 type declarations, and error reporting. Total Electron-specific native code: ~430 lines across `electron/main.js` and `electron/preload.js`.

### 1.2 Triggering incidents

**2026-04-18: Vercel incident.** The Vercel-hosted web app became unavailable for approximately 36 hours. Post-incident review surfaced two structural concerns:

1. **Baked-in credential exposure.** Electron builds in distribution have five org admin tokens compiled into their bundles. Any former employee, lost laptop, or incidental copy retains functional access to all five vendor APIs indefinitely. The `.asar` archive is an unencrypted tar; `npx asar extract` + grep reveals tokens in seconds.
2. **Single failure domain.** Coupling every integration to one hosting vendor means any vendor incident cascades through every workflow simultaneously.

**2024-09 (prior): Axon Enterprise acquisition of Carbyne.** Legal entity, branding, and corp domain ownership shifted. Bundle identifiers, signing authority, and internal URLs need to be established under the Axon namespace going forward.

### 1.3 Design goals (priority order)

1. Remove org integration credentials from the distributed client binary. No exceptions.
2. Eliminate single-point-of-failure coupling. Integration failures should fail per-integration, not app-wide.
3. Enable per-seat revocation without fleet-wide coordination. One compromised device must be cut off without rotating every other seat.
4. Establish production-grade standalone desktop experience: native packaging, code-signed installers, auto-updates, OS-integrated secret storage.
5. Preserve the UI polish redesign work already underway on a parallel branch. Shell migration must not require UI work to be redone.
6. Match Axon Enterprise naming/identity conventions throughout.

---

## 2. Architecture overview (end-state)

### 2.1 Three independent components

```
┌─────────────────────────────────────────────────────┐
│  NocLense Tauri app (installed on NOC seats)        │
│  - WebView2 on Windows (system-provided Chromium)   │
│  - React 19 + Vite frontend (unchanged from today)  │
│  - Rust main process (~700 LOC target)              │
│  - Zero integration secrets in binary               │
│  - Per-device credential in OS keyring              │
│    (established at first-run enrollment)            │
└─────────────────────────────────────────────────────┘
          │                              │
          │ HMAC-signed HTTPS            │ Auto-update poll
          │ (per-device secret)          │
          ▼                              ▼
┌─────────────────────────────────┐   ┌──────────────────────────┐
│  AWS integration proxy          │   │  GitHub Enterprise       │
│  Lambda + API Gateway           │   │  Releases                │
│                                 │   │  - Signed .msi           │
│  DynamoDB:                      │   │  - latest.json manifest  │
│    - Device registry (status)   │   │    (Ed25519-signed)      │
│    - Nonce store (replay)       │   └──────────────────────────┘
│    - Idempotency keys (writes)  │
│                                 │
│  Allowlisted endpoints:         │
│    - /proxy/enroll              │
│    - /proxy/unleash             │
│    - /proxy/datadog             │
│    - /proxy/zendesk (allowlist) │
│    - /proxy/confluence (allowl) │
│    - /proxy/jira (allowlist)    │
└─────────────────────────────────┘
          │
          │ (credentials injected from AWS Secrets Manager)
          ▼
┌───────────────────────────────────────────────────┐
│  Unleashed AI / Datadog / Zendesk / Confluence /  │
│  Jira (Axon-held org accounts)                    │
└───────────────────────────────────────────────────┘
```

### 2.2 Client: Tauri 2.x standalone app

- **Runtime:** System WebView2 on Windows (primary target); WKWebView on macOS if extended later.
- **Native process:** Rust, capability-scoped. Target ~700 LOC in `src-tauri/src/main.rs`.
- **Filesystem access:** scoped to `$APPDATA/NocLense/**`, `$DOCUMENTS/DailyNOC/**`, and user-selected drop files. No broad shell or arbitrary HTTP.
- **Secret storage:** Per-device credential (`device_id` UUID + `device_secret` 32-byte random) stored in OS keyring via `tauri-plugin-keyring` (Windows Credential Manager). Established at first-run via admin-issued enrollment code. Revocable server-side per seat.
- **Auto-update:** Tauri's built-in updater with Ed25519 signature verification.
- **Packaging:** Authenticode-signed `.msi` installer. Bundle identifier `com.axon.noclense`.

### 2.3 Proxy: hybrid service on AWS

- **Platform:** AWS Lambda + API Gateway + DynamoDB (low-QPS stateful proxy, folds into existing Axon AWS footprint).
- **Endpoints (6):** `POST /proxy/enroll` (first-run device registration), `POST /proxy/unleash`, `POST /proxy/datadog`, `POST /proxy/zendesk` (path-allowlisted), `POST /proxy/confluence` (path-allowlisted), `POST /proxy/jira` (path-allowlisted).
- **Credentials:** All org admin tokens in AWS Secrets Manager; Lambda reads on cold start via IAM role.
- **Authentication:** Per-device HMAC-SHA256 with `X-Device-Id` header. Device registry in DynamoDB tracks per-device status (`active` / `revoked`). Revocation takes effect on next request from that device.
- **Replay prevention:** DynamoDB nonce store with conditional put (60s TTL) ensures global rejection of replayed signatures across all Lambda containers.
- **Idempotency:** Mutating requests (POST/PUT/DELETE) require an `idempotency_key` in the payload. DynamoDB idempotency store (24h TTL) caches response; duplicate keys return cached response without re-calling upstream.
- **Path allowlists:** Zendesk, Confluence, Jira each have an explicit per-integration allowlist of (method, path pattern) tuples in proxy source code. Unmatched requests return 403.
- **Observability:** structured JSON logs to existing Axon Datadog.

### 2.4 Update manifest server: GitHub Enterprise Releases

- **Hosting:** Release artifacts (`noclense_<version>_x64_en-US.msi`) + `latest.json` manifest published under the Axon Enterprise GitHub org.
- **Signatures:** Two-layer. (1) Authenticode on the `.msi` (Windows SmartScreen trusts immediately). (2) Ed25519 on the `latest.json` manifest (Tauri verifies before any download).
- **Signing keys:** Ed25519 private key in GitHub Actions secret; Authenticode cert thumbprint (or Azure Key Vault reference) in CI.

### 2.5 Data flow and failure domains

**Four independent failure domains:**

| Failure | Impact |
|---|---|
| Proxy Lambda down | AI + Datadog + Zendesk + Confluence + Jira fail. App still runs; user sees "integration unavailable" messages per surface. Local investigation work continues. |
| DynamoDB unavailable (nonce/idempotency/device registry) | Proxy rejects all authenticated requests (fail-safe; no degraded bypass). Independent DynamoDB outages in AWS are rare (<4h/yr historical). |
| Update server down | Existing installs keep working; no new updates reach seats. |
| Vendor API down (e.g. Datadog) | That integration fails; other four still work through proxy. Matches today's vendor-outage behavior. |

### 2.6 Token rotation and per-device revocation

**Vendor admin tokens:** Before any Tauri build leaves dev, all 5 vendor admin tokens are rotated. This establishes a clean cryptographic baseline: any Electron builds in the wild (pre-incident or otherwise) with baked tokens stop working against upstream vendors. Old integration capability dies at the rotation event, regardless of installer redistribution. Rotation choreography detailed in § 6.2.

**Per-device revocation (new in v2):** Each Tauri install has a unique `device_id` + `device_secret` pair. Compromise of any single seat is resolved by setting that device's status to `revoked` in DynamoDB via AWS CLI. Next request from that device returns `device_revoked`. No fleet-wide rotation, no coordinated client update required. Compromise response time: seconds.

### 2.7 Naming conventions (Axon)

| Artifact | Value |
|---|---|
| Bundle identifier | `com.axon.noclense` |
| Cert legal entity | Axon Enterprise, Inc. |
| Proxy subdomain | `noclense-proxy.axon.com` (final confirmation pending IT DNS allocation; may be `noclense-proxy.internal.axon.com` if corp policy dictates) |
| GitHub Enterprise org | existing Axon Enterprise org (exact slug TBD with IT/GitHub admin) |

---

## 3. Sequencing plan

### 3.1 Ordering rationale

The Path 1 architecture decision (zero integration secrets in Tauri binary) creates a critical-path dependency: the Tauri build cannot functionally call any vendor on its own and must call the proxy. Therefore the proxy must exist and be running before the Tauri build is usable end-to-end.

Sequential execution over parallel: the team prefers getting each phase right without context-switching, and the "out of production" window removes calendar pressure.

### 3.2 Phase 0 — Foundation prep (~3 days)

Parallel prep tasks, any order, can start immediately:

- [ ] Provision Authenticode code-signing certificate (EV, from DigiCert / Sectigo / SSL.com — SSL.com recommended for cloud HSM integration).
- [ ] Generate Ed25519 keypair for Tauri updater manifest signing. Private key → GitHub Actions secret. Public key → baked into `tauri.conf.json`.
- [ ] Confirm GitHub Enterprise Releases artifact path and Actions secret scope on the NocLense repo.
- [ ] Provision AWS resources under existing Axon AWS account: Lambda function, API Gateway, Secrets Manager namespace, CloudWatch log group, three DynamoDB tables (`noclense-proxy-devices`, `noclense-proxy-nonces`, `noclense-proxy-idempotency`), IAM role with least-privilege secret-read + DynamoDB-read/write access.
- [ ] Allocate subdomain `noclense-proxy.axon.com` (or IT-specified equivalent).
- [ ] Create CLI tooling for Enrique to issue one-time enrollment codes (AWS CLI wrapper or small Node script that writes a short-lived code into `noclense-proxy-devices` with `status=pending`).

**Output:** credentials, cert, hosting account, signing keys, DNS, DynamoDB tables, enrollment CLI. No app code.

### 3.3 Phase 1 — Proxy service (~2.5 weeks, fullstack-developer)

Build and deploy the 6-endpoint hybrid proxy. Extended scope from v1 due to DynamoDB, enrollment, and path allowlists.

- [ ] Node/TypeScript service (Node 20+, matching existing stack conventions).
- [ ] Six endpoints as specified in § 4.
- [ ] Per-device HMAC middleware: verify `X-Device-Id` in DynamoDB (`status == active`), verify `X-NocLense-Signature` against per-device `device_secret`.
- [ ] DynamoDB nonce store: conditional put on every request, reject duplicates globally.
- [ ] DynamoDB idempotency store: required on POST/PUT/DELETE; cached response path for duplicates.
- [ ] Path allowlists for Zendesk, Confluence, Jira — enumerated from current service modules (`zendeskService.ts`, `jiraService.ts`, `confluenceService.ts`, `UnleashProvider.ts`); reject 403 on miss.
- [ ] Enrollment endpoint: validate one-time code from Enrique's CLI, atomically flip device status from `pending` → `active`, store hashed `device_secret`.
- [ ] Structured JSON request/response logging to Datadog (includes `device_id` for attribution).
- [ ] Health check endpoint for API Gateway.
- [ ] Secrets in AWS Secrets Manager: `UNLEASH_TOKEN`, `UNLEASH_ASSISTANT_ID`, `DATADOG_API_KEY`, `DATADOG_APP_KEY`, `ZENDESK_EMAIL`, `ZENDESK_TOKEN`, `CONFLUENCE_EMAIL`, `CONFLUENCE_TOKEN`, `JIRA_EMAIL`, `JIRA_TOKEN`. (Note: HMAC_SHARED_SECRET removed from v2 — replaced with per-device secrets in DynamoDB.)
- [ ] **Productionize Electron-via-proxy shim** (new in v2): Electron builds updated to sign requests using a per-device credential issued the same way as Tauri. Electron enrollment uses the same `/proxy/enroll` endpoint. Electron builds published to NSIS distribution channel stay functional through the proxy for the entire pilot window.

**Gate before Phase 2:** proxy deployed, per-device auth tested end-to-end, DynamoDB replay prevention verified (synthetic replay rejected), path allowlist catches unauthorized paths (synthetic test returns 403), enrollment flow complete, all six endpoints reachable from Electron-via-proxy shim, 24 hours uneventful operation.

**Token rotation event at end of Phase 1** — see § 6.2. Old pre-Phase-1 Electron builds (baked tokens) stop working; Electron-via-proxy shim stays functional.

### 3.4 Phase 2 — Tauri shell migration (~3–5 weeks, fullstack-developer)

Substages:

**2a. Scaffold (1 day).** `npm create tauri-app@latest`, point at existing Vite `dist/`, verify React 19 loads in WebView2 window. First commit green. Include `tauri-plugin-keyring` and `tauri-plugin-window-state` from day 1.

**2b. electronAPI compat shim (3–5 days).** Inventory the 11 files; write Tauri `#[tauri::command]` equivalents for the 4 custom operations plus 2 new enrollment commands (`enroll_device`, `get_device_status` — detailed in § 5.3); write `src/shell/api.ts` that detects `window.__TAURI__` vs `window.electronAPI` and dispatches. Keep Electron still building during this work. ~200 lines of JS changes, ~500 lines of Rust.

**2c. Enrollment flow UI (2–3 days).** First-run onboarding: if no `device_id` in keyring, show enrollment screen. User pastes one-time code from admin. Tauri calls `/proxy/enroll`, receives device record, stores `device_id` + `device_secret` in keyring. If enrollment fails, show clear error with contact info. Successful enrollment transitions to normal app UI.

**2d. Secret storage via keyring (1–2 days).** `tauri-plugin-keyring` wrapper commands for `device_id` and `device_secret` storage. User preferences still plaintext JSON in `$APPDATA/NocLense/preferences.json`. Delete `src/store/apiKeyStorage.ts` — integration tokens live entirely on proxy.

**2e. Error-reporting webhook (0.5 day).** Move from `process.env.NOCLENSE_ERROR_REPORT_URL` in `electron/main.js` to Rust-side `reqwest` call via new `report_error` command.

**2f. Auto-updater wiring (1–2 days).** `@tauri-apps/plugin-updater` pointed at GitHub Releases manifest URL; Ed25519 pubkey baked; test full + delta update cycles.

**2g. CI/CD (2–3 days).** `tauri build` in GitHub Actions, Authenticode signing for `.msi`, Ed25519 signing of `latest.json`, publish artifacts to GitHub Releases.

**2h. Dual-run validation (1–2 weeks calendar).** Tauri build on internal dev seats alongside Electron-via-proxy. Soak on real NOC workflows. Fix WebView2-specific regressions (IndexedDB quota, font antialiasing, Motion edge cases). Verify per-device enrollment across different machines.

**Gate before Phase 3:** Tauri build passes full vitest suite in WebView2; 2+ weeks internal soak with no critical regressions; auto-update tested end-to-end; enrollment flow verified on ≥3 fresh machines.

### 3.5 Phase 3 — Cutover + Electron retirement (~0.5 day)

See § 6.6. Retires BOTH Electron variants (pre-Phase-1 baked-secret and Phase-1-shimmed-via-proxy) at cutover, after the 14-day pilot GO-gate (§ 6.5) clears.

### 3.6 Parallel coordination with UI redesign

The UI polish redesign runs on `redesign/ui-polish` branch owned by frontend-developer throughout all phases. It does not stop, pause, or slow for the shell migration.

**Coordination point:** when fullstack-developer merges the Phase 2 shim commit (touching `src/shell/api.ts` + the 11 electronAPI files), frontend-developer rebases the redesign branch. The changes are scoped to the top-of-file shell-detection helpers, not the API-interaction code that UI phases extend. Expected conflict: zero or minor.

A standing async ping at merge time is enough. No synchronous sync meetings required.

### 3.7 Agent ownership

| Phase | Owner | Claude's role |
|---|---|---|
| 0 (Foundation prep) | fullstack-developer + Enrique (procurement) | Review prep checklist; confirm approvals land |
| 1 (Proxy) | fullstack-developer | Review each commit's self-assessment per role-split cycle; design oversight; path allowlist enumeration sign-off |
| 2 (Tauri migration) | fullstack-developer | Review each commit; resolve design questions; coordinate with frontend-developer |
| 3 (Cutover) | fullstack-developer | Sign-off GO/NO-GO |
| UI redesign (ongoing) | frontend-developer | Separate track; unchanged review cadence |

---

## 4. Proxy service design

Hosting-agnostic by design — the code runs identically on AWS Lambda, a Fly.io VM, or a local Node process. AWS Lambda + DynamoDB is the assumed target.

### 4.1 Request/response envelope

All authenticated endpoints follow the same envelope pattern. (The `/proxy/enroll` endpoint has a different shape; see § 4.2.)

**Request envelope (authenticated endpoints):**

```ts
interface ProxyRequest<TPayload> {
  /** ISO-8601 timestamp; rejected if >60s skew from server time */
  timestamp: string;
  /** Opaque random nonce; rejected if previously seen in DynamoDB within 60s */
  nonce: string;
  /** Required on POST/PUT/DELETE; UUIDv4; idempotency replay returns cached response */
  idempotency_key?: string;
  /** Scenario-specific payload */
  payload: TPayload;
}
```

**Headers required on authenticated requests:**
- `X-Device-Id: <uuid>` — device identifier from keyring
- `X-NocLense-Signature: <base64>` — `HMAC-SHA256(timestamp + "." + nonce + "." + JSON.stringify(payload), device_secret)`

**Response envelope:**

```ts
type ProxyResponse<TResult> =
  | { ok: true; result: TResult; cached?: boolean }  // `cached: true` on idempotency hit
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        upstreamStatus?: number;
      };
    };
```

**Per-device HMAC signature:** Proxy looks up `device_id` in `noclense-proxy-devices` DynamoDB table. If `status != 'active'`, reject with `device_revoked`. Otherwise fetch stored hashed `device_secret`, recompute signature, compare in constant time.

**Replay prevention (DynamoDB):** `noclense-proxy-nonces` table. Partition key `nonce`, TTL `expires_at` (timestamp + 70s to allow 60s skew + 10s grace). On every request: `PutItem` with `ConditionExpression: attribute_not_exists(nonce)`. On failure → reject as replay with `replay_detected`.

**Idempotency (DynamoDB):** `noclense-proxy-idempotency` table. Partition key `idempotency_key`, attributes include `response_body`, `response_status`, TTL 24h. On POST/PUT/DELETE: look up key first; if present, return cached response with `cached: true`. Otherwise execute upstream, cache response, return.

### 4.2 Endpoint shapes

**Enrollment endpoint (special — no per-device auth):**

| Endpoint | Request | Response |
|---|---|---|
| `POST /proxy/enroll` | `{ device_id: string, device_secret: string, enrollment_code: string, hostname?: string }` (TLS only; no HMAC signature — this is the bootstrap) | `{ ok: true, enrolled_at: ISO8601 }` or `{ ok: false, error: { code: 'enrollment_code_invalid' \| 'enrollment_code_expired' \| 'enrollment_code_already_used' \| 'device_already_enrolled' } }` |

Enrollment code lifecycle: Enrique runs CLI → writes `{ enrollment_code, expires_at: now + 15min, used: false }` to DynamoDB. User enters code in Tauri first-run. Tauri calls `/proxy/enroll`. Proxy validates code (not expired, not used), hashes `device_secret`, writes device record `{ device_id, hashed_device_secret, status: 'active', enrolled_at, hostname }`, marks enrollment code `used: true`.

**Authenticated endpoints:**

| Endpoint | Payload | Forwards to | Credentials injected |
|---|---|---|---|
| `POST /proxy/unleash` | `{ chatId?, userEmail, message, ... }` (mirrors current `POST /chats` body) | `https://api.unleash.so/chats` | `Authorization: Bearer ${UNLEASH_TOKEN}`, `X-Assistant-Id: ${UNLEASH_ASSISTANT_ID}` |
| `POST /proxy/datadog` | `{ method: 'search' \| 'station-discover' \| 'test', query, timeRange, ... }` | `https://api.${DATADOG_SITE}/api/v2/logs/events/search` or `/api/v1/metrics/search` depending on `method` | `DD-API-KEY: ${DATADOG_API_KEY}`, `DD-APPLICATION-KEY: ${DATADOG_APP_KEY}` |
| `POST /proxy/zendesk` | `{ op: string, ...params }` — allowlisted operations | Upstream path derived from `op` | Basic auth: `${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}` |
| `POST /proxy/confluence` | `{ op: string, ...params }` — allowlisted operations | Upstream path derived from `op` | Basic auth |
| `POST /proxy/jira` | `{ op: string, ...params }` — allowlisted operations | Upstream path derived from `op` | Basic auth |

**Path allowlist design (new in v2):** Zendesk, Confluence, and Jira each expose a named `op` that maps to exactly one (method, path pattern) tuple in proxy source. Unknown `op` → reject 403 `path_not_allowed`. Allowlist enumerated during Phase 1 from current service modules; added to spec Appendix C when enumeration completes. Expanding the allowlist requires a proxy code change + PR review.

**Example Zendesk allowlist shape (illustrative; final list derived during Phase 1):**

```ts
const ZENDESK_OPS = {
  'get-ticket':      { method: 'GET',  path: (p) => `/tickets/${encodeURIComponent(p.ticketId)}.json` },
  'update-ticket':   { method: 'PUT',  path: (p) => `/tickets/${encodeURIComponent(p.ticketId)}.json` },
  'search-tickets':  { method: 'GET',  path: (p) => `/search.json?query=${encodeURIComponent(p.query)}` },
  'add-comment':     { method: 'POST', path: (p) => `/tickets/${encodeURIComponent(p.ticketId)}/comments.json` },
  // ... enumerated during Phase 1 from zendeskService.ts usage
};
```

### 4.3 Error handling taxonomy

| `error.code` | HTTP | Meaning | Client action |
|---|---|---|---|
| `hmac_invalid` | 401 | Signature verification failed | Device secret mismatch. Prompt user to re-enroll. |
| `hmac_expired` | 401 | Timestamp outside skew window | Retry once with fresh timestamp; if still fails, surface clock-skew warning. |
| `device_revoked` | 401 | Device status is `revoked` in DynamoDB | Admin has revoked this seat. Show contact admin message. No automatic recovery. |
| `device_not_enrolled` | 401 | Device ID unknown to proxy | Device was never enrolled (fresh install without enrollment, or enrollment failed). Prompt enrollment. |
| `replay_detected` | 401 | Nonce already seen in DynamoDB | Retry once with fresh nonce; if still fails, log and surface to user. |
| `enrollment_code_invalid` | 400 | Enrollment code not found or already used | Ask admin for a fresh code. |
| `enrollment_code_expired` | 400 | Code expired (15min lifetime) | Ask admin for a fresh code. |
| `idempotency_conflict` | 409 | Idempotency key seen with different payload | Client bug — same key reused for different operations. Regenerate key. |
| `path_not_allowed` | 403 | Requested `op` not in allowlist for this integration | Client bug — proxy doesn't support this operation. File a ticket. |
| `rate_limited` | 429 | Per-endpoint bucket exhausted | Exponential backoff. Not expected in normal use at team size. |
| `upstream_4xx` | 502 | Upstream vendor returned 4xx | Likely vendor-side config (expired admin token, API change). Log INFO; surface generic "service unavailable" to user. |
| `upstream_5xx` | 502 | Upstream 5xx | Transient. Retry once; if persistent, degraded-mode UI. |
| `upstream_timeout` | 504 | Upstream request >30s | Unleashed long prompts may hit this. Show "taking longer than expected" after 10s client-side. |
| `internal_error` | 500 | Proxy bug | Client logs; surfaces "unexpected error." Should not fire in steady state. |

### 4.4 Rate limiting

DynamoDB-backed per-device rate limits (in addition to per-endpoint in-memory limits from v1):

- **Per-device:** 300 req/min across all endpoints (rolling window via DynamoDB atomic counter). Prevents a single compromised device from exhausting shared upstream quotas.
- **Per-endpoint global:** Unleashed 20 req/min per container; Datadog 30 req/min; Zendesk/Confluence/Jira 60 req/min each.

Device-level limits matter more than endpoint limits in v2 because the per-device attribution makes abuse detectable and scoped.

### 4.5 Observability

Structured JSON logs per request, shipped to Axon Datadog:

```json
{
  "ts": "2026-04-20T15:30:45.123Z",
  "endpoint": "/proxy/unleash",
  "device_id": "a1b2c3d4-...",
  "result": "ok",
  "upstream_status": 200,
  "duration_ms": 843,
  "client_version": "noclense-1.4.2",
  "request_bytes": 2048,
  "response_bytes": 8192,
  "cached": false,
  "idempotency_key": "e5f6g7h8-..."
}
```

**NOT logged:** request payloads, response bodies, auth headers, cookies, user prompts, ticket text, device secrets. Metadata only. `device_id` is a UUID; no PII.

Datadog dashboards (set up in Phase 1):
- Per-device request volume (detect anomalous spikes)
- Per-endpoint latency + error rate
- Enrollment attempts (success/failure)
- Replay rejections (should be ~0 in steady state)

### 4.6 Secret rotation flow

**Vendor token rotation** (e.g. Unleashed) — operations playbook:

1. Generate new token at vendor.
2. Install in AWS Secrets Manager under `UNLEASH_TOKEN_NEW` (alongside existing `UNLEASH_TOKEN`).
3. Deploy proxy version that accepts either secret name; verify with smoke test.
4. Rename `UNLEASH_TOKEN_NEW` → `UNLEASH_TOKEN`; delete old value.
5. Revoke old token at vendor.

**Per-device credential rotation:** Not a fleet operation. Each device is independently revocable. Lost laptop or former employee:

1. Identify the device's `device_id` from Datadog logs or NOC records.
2. Run `aws dynamodb update-item --table-name noclense-proxy-devices --key '{"device_id":{"S":"..."}}' --update-expression "SET #s = :r" --expression-attribute-names '{"#s":"status"}' --expression-attribute-values '{":r":{"S":"revoked"}}'`.
3. Next request from that device returns `device_revoked` immediately.

**Ed25519 updater signing key rotation:** Infrequent. If private key is compromised:

1. Generate new Ed25519 keypair.
2. Ship new Tauri build with both old and new pubkeys (accept either signature for a transition window).
3. Sign new manifests with new key only. Wait for auto-update to propagate.
4. Ship third Tauri build with only new pubkey. Revoke old key.

No fleet-wide HMAC rotation exists in v2 because there is no fleet-wide HMAC.

### 4.7 Non-goals for proxy v1

- **Per-user auth (SSO, JWT, user identity).** Per-device is the v2 identity model — each device attributable but not each user. Upgrade path to SSO exists via additive `Authorization: Bearer <jwt>` header alongside per-device HMAC if compliance demands it.
- **Request caching.** Not worth it at this QPS. Idempotency cache handles write-side deduplication only.
- **Upstream failover.** If a vendor is down, that integration is down; not the proxy's job to synthesize responses.
- **Business logic transformations.** Pure pass-through within allowlist.
- **Batch / GraphQL endpoints.** Allowlisted named operations only.

---

## 5. Tauri shell design

### 5.1 Tauri configuration (`src-tauri/tauri.conf.json`)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "NocLense",
  "version": "../package.json",
  "identifier": "com.axon.noclense",
  "app": {
    "windows": [{
      "label": "main",
      "title": "NocLense",
      "width": 1400,
      "height": 900,
      "minWidth": 1024,
      "minHeight": 768,
      "resizable": true,
      "center": true,
      "decorations": true,
      "devtools": false
    }],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://noclense-proxy.axon.com; style-src 'self' 'unsafe-inline'; script-src 'self'"
    },
    "withGlobalTauri": false
  },
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "bundle": {
    "active": true,
    "targets": ["msi"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.sectigo.com",
      "webviewInstallMode": { "type": "embedBootstrapper" },
      "allowDowngrades": false
    }
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/<axon-org>/noclense/releases/latest/download/latest.json"
      ],
      "pubkey": "<base64 ed25519 public key — baked at build>",
      "dialog": true,
      "windows": { "installMode": "passive" }
    }
  }
}
```

**Required plugins (enumerated in `Cargo.toml`):**
- `tauri-plugin-keyring` — per-device credential storage (new in v2)
- `tauri-plugin-window-state` — window size/position persistence
- `tauri-plugin-updater` — auto-update
- `tauri-plugin-dialog` — file pickers
- `tauri-plugin-fs` — scoped filesystem access

**Key decisions with rationale:**

- `withGlobalTauri: false` — no `window.__TAURI__` global pollution. Renderer uses `import { invoke } from '@tauri-apps/api/core'`. Forces explicit imports, easier to grep, avoids Electron-style "is there a Tauri API on window" detection pattern.
- CSP locks `connect-src` to the proxy domain + self. Any regression where a service forgets to route through the proxy fails at the browser layer, not silently.
- `webviewInstallMode: embedBootstrapper` ships the WebView2 bootstrapper in the MSI. ~2MB add; guarantees install works even on older Win10 builds that might lack WebView2.
- `allowDowngrades: false` — auto-updater refuses older versions. Prevents rollback attack via signed-but-old releases.

### 5.2 Capability system

Tauri 2's declarative capability JSON replaces Electron's "context isolation + preload whitelist" pattern. The capability file is living documentation — a reviewer sees exactly what native powers the frontend has in ~25 lines.

**`src-tauri/capabilities/main.json`:**

```json
{
  "identifier": "main-capability",
  "description": "NocLense renderer permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:scope-appdata-recursive",
    "fs:scope-documents-recursive",
    "fs:allow-read-text-file",
    "fs:allow-read-binary-file",
    "fs:allow-write-text-file",
    "updater:default",
    "keyring:allow-get",
    "keyring:allow-set",
    "keyring:allow-delete",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://noclense-proxy.axon.com/**" },
        { "url": "http://localhost:5173/**" }
      ]
    }
  ]
}
```

**Explicit exclusions:**
- No `shell:` capability. The app never spawns processes.
- No unscoped `fs:` access. The WebView can read/write only under AppData and Documents.
- No `process:` or `os:` capabilities.
- Keyring scoped to `noclense.*` key prefix (prevents reading other apps' keyring entries).

### 5.3 `invoke()` surface — six custom commands

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `get_crash_reports` | `{ limit: u32 }` | `Vec<CrashReport>` | Replaces `window.electronAPI.getCrashReports` |
| `open_crash_log_location` | `()` | `()` | Replaces `window.electronAPI.openCrashLogLocation` |
| `clear_crash_reports` | `()` | `u32` (count deleted) | Replaces `window.electronAPI.clearCrashReports` |
| `report_error` | `{ payload: ErrorReportPayload }` | `()` | Replaces `app:report-error` IPC |
| `enroll_device` | `{ enrollment_code: String }` | `{ device_id: String, enrolled_at: String }` | First-run enrollment (new in v2) |
| `get_device_status` | `()` | `{ enrolled: bool, device_id?: String, last_enrolled_at?: String }` | Check enrollment state at startup |

**Everything else uses plugin-provided commands** (keyring, dialog, updater, fs).

**Explicit non-custom commands:**
- **Secret storage** — use `keyring:allow-get` / `keyring:allow-set` plugin commands directly with keys `noclense.device_id` and `noclense.device_secret`.
- **Proxy URL resolution** — compile-time constant (`PROXY_URL` from `tauri.conf.json`). No branching.
- **User preferences** — `$APPDATA/NocLense/preferences.json` via standard `fs:allow-write-text-file` capability. No custom command.

### 5.4 Secret handling

**v2 design: OS keyring for per-device credential.**

| Secret | Where it lives | Why |
|---|---|---|
| 5 vendor integration tokens | AWS Secrets Manager (proxy) | Not on the client, period. |
| Per-device credential (`device_id`, `device_secret`) | OS keyring via `tauri-plugin-keyring` (Windows Credential Manager) | OS-level encryption; per-user scoped; accessible only to NocLense and the logged-in user. |
| Enrollment code (ephemeral) | User's clipboard → input field → immediate use | Never stored; single-use; 15min TTL. |
| User preferences | `$APPDATA/NocLense/preferences.json` | Not secrets. Plaintext JSON. |
| Crash report correlation UUID | Same preferences.json | Not a secret. First-launch generated. |

**First-run enrollment flow:**

1. Tauri launches, checks keyring for `noclense.device_id`. Not present → enrollment UI.
2. UI: "Paste your one-time enrollment code from your NOC admin." Input field + Enroll button.
3. User pastes code. Tauri generates `device_id = UUIDv4()` and `device_secret = random(32 bytes)`.
4. Tauri calls `invoke('enroll_device', { enrollment_code })`. Rust command:
   - POSTs to `/proxy/enroll` with `{ device_id, device_secret, enrollment_code, hostname: os::hostname }`.
   - On success: stores `device_id` and `device_secret` in keyring.
   - Returns `device_id` to UI.
5. UI transitions to normal app. Subsequent launches skip enrollment (keyring check passes).

**Re-enrollment:** If proxy returns `device_revoked` during normal operation, UI offers "Re-enroll?" — user gets a fresh code from admin, existing keyring entries are cleared, flow starts over.

**Design rationale — why keyring over file-based storage:**

OS keyring provides encryption at rest tied to the OS user account. A compromised file-system reader (another app running as the same user) cannot read keyring entries without also authenticating as the user. A stolen laptop with disk encryption has zero data-at-rest exposure. Compared to v1's baked HMAC, this gives per-device isolation AND at-rest protection with no meaningful UX cost (enrollment is one-time per install).

### 5.5 Auto-updater — two-layer signing

(Unchanged from v1.)

1. **Authenticode (Windows)** — `.msi` signed with the EV cert. SmartScreen trusts immediately.
2. **Tauri Ed25519** — `latest.json` manifest signed with separately-held Ed25519 key. Tauri verifies before downloading the `.msi`.

**Manifest format:** See v1 § 5.5. Unchanged.

**Update flow:** See v1 § 5.5. Unchanged.

### 5.6 Window / WebView configuration details

- Window size persistence via `tauri-plugin-window-state`.
- DevTools force-disabled in release builds. No keyboard shortcut.
- `style-src 'unsafe-inline'` precautionary for Tailwind/emotion; audit in later hardening pass.

### 5.7 Build and CI

GitHub Actions workflow on tag push (`v*`): (unchanged from v1.)

```
1. Checkout + setup (Node 20, Rust stable, MSVC toolchain)
2. npm ci
3. npm run test:run                  # vitest + TS + ESLint must all pass
4. npm run tauri build               # signed .msi via cert thumbprint
5. tauri signer sign latest.json     # Ed25519 sign the manifest
6. gh release create <tag> <.msi> latest.json
```

### 5.8 Migration shim — the transition layer

Between Phase 2 start and Phase 3 complete, both shells coexist. The shim at `src/shell/api.ts` hides shell detection behind a uniform API:

```ts
export interface ShellAPI {
  getCrashReports(limit?: number): Promise<CrashReport[]>;
  openCrashLogLocation(): Promise<void>;
  clearCrashReports(): Promise<number>;
  reportError(payload: ErrorReportPayload): Promise<void>;
  // v2 additions — enrollment is Tauri-only; Electron-via-proxy
  // uses a different enrollment CLI tool, not shell API
  enrollDevice?(enrollmentCode: string): Promise<{ deviceId: string }>;
  getDeviceStatus?(): Promise<{ enrolled: boolean; deviceId?: string }>;
}

export const shell: ShellAPI = detectShell();
```

Every call site imports `shell` from `'@/shell/api'`. Electron-via-proxy uses the original Electron `window.electronAPI` and does its own device registration via a bundled enrollment CLI (Electron doesn't get a first-run GUI flow; enrollment happens out-of-band via Enrique's CLI).

**Phase 3 retirement:** delete the Electron branch from the shim; keep Tauri only. Enrollment methods become non-optional.

Net new code: ~200 lines of shim (TypeScript) + ~500 lines of Rust for the 6 custom commands.

### 5.9 What's intentionally not in the Rust layer

| Tempting to add | Why skipping | Upgrade path if needed |
|---|---|---|
| Native log file streaming | File API works in WebView2 | Add `fs:stream` only if real performance problem |
| Native PDF parser | `pdfjs-dist` works in WebView2 | Keep as-is |
| Native ZIP extraction | `jszip` works in WebView2 | Keep as-is |
| Background workers | Web Workers work in WebView2 | Keep as-is |
| Native notification center | `Notification` API works | Add `notification:default` only if UX demands it |
| OAuth/SSO flow | Per-device enrollment is v1 identity; SSO upgrade path is additive, not native | Add tauri-plugin-oauth when compliance requires |

---

## 6. Rollout and pilot plan

### 6.1 Pre-rollout prep (Day -14 to Day 0)

Hard prerequisites. Nothing starts without all green.

| Item | Owner | Verification |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager + 3 DynamoDB tables provisioned | fullstack-developer + IT | `curl https://noclense-proxy.axon.com/health` → 200; DynamoDB tables visible in console |
| 10 secrets populated in AWS Secrets Manager (5 integrations × 2 fields each, roughly) | Enrique (admin tokens) + fullstack-developer (Ed25519) | AWS console shows all entries |
| EV Authenticode cert issued; installed in CI secrets | Legal signatory + fullstack-developer | `signtool verify` passes on test `.msi` |
| Ed25519 keypair generated; pubkey baked; privkey in Actions secret | fullstack-developer | `tauri signer verify` passes on test `latest.json` |
| Subdomain `noclense-proxy.axon.com` provisioned | IT DNS admin | `dig` returns expected CNAME |
| CI produces signed `.msi` + signed `latest.json` to test Release | fullstack-developer | GitHub Release with both artifacts |
| Enrollment CLI tool tested by Enrique | fullstack-developer + Enrique | Generates code; code resolves on test device; device registered |
| Tauri build installable on 1 dev machine; enrollment completes; auto-update cycle tested | fullstack-developer | Dev machine enrolls + receives update successfully |
| Electron-via-proxy build tested; enrolled via CLI; functional through proxy | fullstack-developer | Electron seat runs through proxy without direct vendor calls |
| Pilot participants identified and briefed | Enrique | Committed for 2-week soak |
| Pilot Slack channel created | Enrique | Channel active |

### 6.2 Token rotation choreography (Day 0, T+0 through T+60)

This is the single atomic window to kill old-binary blast radius for the pre-Phase-1 Electron builds. Phase-1 Electron-via-proxy seats are unaffected because they enroll per-device like Tauri.

Schedule for off-peak NOC hours. Pilot group on standby.

| T+ | Step | Owner | Expected state |
|---|---|---|---|
| 0:00 | Snapshot current proxy secrets to sealed backup file | fullstack-developer | Backup exists |
| 0:05 | Generate new Unleashed token; install as `UNLEASH_TOKEN_NEW` in Secrets Manager | Enrique | Secret exists alongside old |
| 0:10 | Verify proxy endpoint works with new token | fullstack-developer | 200 OK |
| 0:15 | Rename `UNLEASH_TOKEN_NEW` → `UNLEASH_TOKEN`; delete old | fullstack-developer | Only new token |
| 0:20–0:40 | Repeat for Datadog, Zendesk, Confluence, Jira | Enrique + fullstack-developer | All 5 on new tokens |
| 0:45 | Revoke old tokens at each vendor | Enrique | Old tokens dead |
| 0:50 | Smoke test each proxy endpoint from Tauri dev build | fullstack-developer | All 5 return expected responses |
| 0:55 | Smoke test each proxy endpoint from Electron-via-proxy build | fullstack-developer | All 5 return expected responses |
| 1:00 | Announce in pilot channel + broader NOC team | Enrique | Messages sent |

**Impact summary:**
- Pre-Phase-1 Electron builds (baked tokens): **non-functional** after T+45.
- Phase-1 Electron-via-proxy builds: **fully functional** (no baked tokens).
- Tauri builds (if any installed pre-rotation): **fully functional**.

### 6.3 Dual-build transition (Day 0 through Day +14) — v2 revised

| Environment | Electron (baked) | Electron-via-proxy | Tauri |
|---|---|---|---|
| Build | Legacy NSIS, pre-Phase-1 | NSIS with proxy-signing shim | Tauri MSI |
| Branch | (not built after Phase 1) | `main` | `main` |
| Distribution | Still installed on non-updated seats | NSIS download; auto-push via existing channels | Manual MSI download for pilot; auto-update thereafter |
| Integration | **Non-functional** after T+45 | **Functional through proxy** (per-device enrolled) | **Functional through proxy** (per-device enrolled) |
| Pilot status | Not pilot; should be uninstalled | Non-pilot NOC seats during pilot window | Pilot seats only |

**Key change from v1:** Electron-via-proxy stays fully functional through the entire pilot window. Non-pilot seats are NOT stranded during Tauri's 14-day soak. Any rollback from Tauri to Electron-via-proxy is available for the duration of pilot.

After Day +14 AND GO-gate clears, CI stops building both Electron variants. Phase 3 begins.

### 6.4 Internal pilot program

| Dimension | Plan |
|---|---|
| Pilot group size | 3–5 NOC agents including Enrique |
| Selection criteria | Active NOC workload; diversity of ticket patterns |
| Duration | 14 calendar days from first pilot install |
| Cadence | Daily async in pilot channel; weekly 30-min retro |
| Installation | Manual MSI from GitHub Release; admin-issued enrollment code per agent; auto-update thereafter |
| Fallback | If a pilot user encounters a blocker, they can revert to Electron-via-proxy using the enrollment code issued for their Electron seat (separate from Tauri enrollment) |

**Tracked metrics and bars:**

| Metric | Bar |
|---|---|
| Crash count | ≤ 1/agent/week |
| Memory footprint (4h steady state) | Median RSS ≤ 200MB |
| Cold start time | ≤ 2s on pilot hardware |
| Enrollment success rate | 100% on fresh machines (≥3 machines tested) |
| Auto-update reach within 24h | ≥ 95% of pilot seats on latest |
| Investigation workflow completion | Yes for all agents; no regressions vs Electron-via-proxy |
| WebView2 rendering fidelity | No visible regressions vs Electron-via-proxy baseline |
| 200MB+ IndexedDB log load | Completes without quota errors |
| Proxy latency overhead (per-device HMAC + DynamoDB) | ≤ 200ms vs direct call (up from v1's 150ms due to DynamoDB roundtrip) |

### 6.5 GO/NO-GO gate (Day +14)

**All must pass for GO:**

1. Zero unresolved P0/P1 bugs.
2. Zero unresolved security-review findings.
3. All 9 pilot metrics met.
4. Auto-update cycle exercised at least once per pilot seat successfully.
5. Enrollment flow validated on ≥3 fresh machines (clean Windows install).
6. Per-device revocation tested end-to-end (revoke one test device; verify `device_revoked` response).
7. Replay prevention tested (synthetic replayed signature rejected by DynamoDB).
8. Full test suite green on main.
9. IndexedDB 200MB+ log path verified on ≥2 pilot machines.
10. Pilot consensus: "this is better than Electron-via-proxy."
11. fullstack-developer greenlight on Phase 3 execution readiness.

**NO-GO triggers (any one):**
- P0/P1 bug with no known workaround.
- Auto-update failure rate >5%.
- Performance regression ≥20% on measured workflow.
- WebView2 rendering bug affecting investigation workflow.
- Enrollment flow failure rate >10% on fresh machines.
- Unremediated security finding.

**On NO-GO:** Phase 2 reopens. Tauri pilot continues. Electron-via-proxy remains fully functional for non-pilot seats during fixes. No Electron retirement until re-GO.

**NO-GO decision:** Enrique + fullstack-developer jointly. Not a single-person call.

### 6.6 Phase 3 — Electron retirement (Day +14 to +17)

| Step | Owner | Duration |
|---|---|---|
| Delete `electron/` directory | fullstack-developer | 1 hour |
| Remove `electron-builder` config from `package.json` | fullstack-developer | 30 min |
| Remove Electron-only npm scripts | fullstack-developer | 30 min |
| Delete Electron branches from `src/shell/api.ts` | fullstack-developer | 1 hour |
| Strip `electron-builder` dependencies | fullstack-developer | 30 min |
| Revoke Electron-via-proxy device credentials (mass revocation) | Enrique + fullstack-developer | 30 min |
| Update `CLAUDE.md` — Tauri-only architecture | Claude drafts, fullstack-developer reviews | 2 hours |
| Update `README.md` install instructions | Enrique + Claude | 1 hour |
| Archive last Electron-via-proxy NSIS to `frozen/` (90-day retention) | fullstack-developer | 30 min |
| Tag `v2.0.0` — first post-Electron release | fullstack-developer | 5 min |
| Announce broadly | Enrique | 10 min |

Total: ~1 business day.

Non-pilot users have 14 days after pilot conclusion to migrate from Electron-via-proxy to Tauri before their device credentials are revoked.

### 6.7 Rollback plan

| Severity | Response | Time-to-restore |
|---|---|---|
| Minor bug | Hotfix Tauri, auto-update rolls out | ~4h |
| Major bug | Freeze auto-update at last-good; ship hotfix | ~4–8h |
| Single seat compromised | Revoke single device via AWS CLI | ~30 seconds |
| Mass credential leak | Revoke multiple devices via AWS CLI batch update; ship new Tauri if systemic | ~15 min |
| Catastrophic Tauri issue (post-cutover) | Revive Electron-via-proxy from `frozen/` archive; mass re-enroll seats | ~4h |

**Frozen Electron-via-proxy NSIS retention:** 90 days unless corporate compliance mandates different (confirm with Axon policy; match if stricter).

### 6.8 Post-cutover operations

**Ownership:**

| System | Primary | Backup |
|---|---|---|
| Proxy (Lambda + API Gateway + DynamoDB) | fullstack-developer | Enrique |
| AWS Secrets Manager | Enrique | fullstack-developer |
| DynamoDB device registry | Enrique (revocation authority) | fullstack-developer |
| Enrollment code issuance CLI | Enrique | fullstack-developer |
| Tauri build + release | fullstack-developer | Enrique |
| Ed25519 signing key | fullstack-developer | Enrique (sealed backup) |
| EV Authenticode cert | Legal signatory + fullstack-developer | — |
| Datadog logs for proxy | Enrique | fullstack-developer |

**Recurring operations:**

| Cadence | Operation |
|---|---|
| As needed | Issue enrollment codes for new NOC seats |
| As needed | Revoke device credentials for departed seats |
| As needed | Respond to proxy alerts; investigate 4xx/5xx spikes |
| Annually | Rotate 5 vendor tokens; renew EV cert; audit IAM; audit DynamoDB device registry for orphans |
| Quarterly | Update Tauri + Rust deps; rebuild and re-pilot |

### 6.9 Runbooks to write (post-cutover)

Claude drafts from this spec as each phase completes, with fullstack-developer reviewing:

1. "Rotating a vendor admin token"
2. "Rolling back to a previous Tauri release"
3. "Diagnosing a proxy outage"
4. "Responding to auto-update failures"
5. "Ed25519 signing key rotation playbook"
6. "EV cert annual renewal"
7. "Issuing enrollment codes for new seats" (new in v2)
8. "Revoking a device credential" (new in v2)
9. "Auditing DynamoDB device registry for stale entries" (new in v2)

Location: `docs/runbooks/`. Linked from main README.

### 6.10 Documentation updates (Day +14 onward)

| File | Change type | Reviewer |
|---|---|---|
| `CLAUDE.md` | Major rewrite — remove "Electron / React Boundary"; add "Tauri Shell" | fullstack-developer |
| `README.md` | Replace "Desktop App (Electron)" with "Desktop App (Tauri)" | Enrique |
| `package.json` | Remove `electron`, `electron-builder`, `wait-on`, `concurrently`, `cross-env` | fullstack-developer |
| `vite.config.ts` | Keep as-is | — |
| `docs/superpowers/specs/2026-04-20-tauri-migration-design.md` | Mark as "Implemented v2" in frontmatter | Claude |
| `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` | Update sign-off checklist | Enrique |
| `docs/runbooks/` | Net-new directory + 9 runbooks | Claude drafts, fullstack-developer reviews |

---

## 7. Non-goals

Explicitly out of scope for this spec:

### 7.1 Per-user SSO authentication

Per-device revocable credentials are the v2 identity model. Full SSO becomes worth the complexity when:
- Team exceeds ~100 agents.
- Compliance requires per-user (not per-device) attribution.
- One-seat-per-user assumption breaks (shared stations, hot-desking).

Upgrade path: additive `Authorization: Bearer <jwt>` header alongside per-device HMAC during transition; per-device HMAC removed post-cutover. Clean incremental change, not a rewrite.

### 7.2 Case library / ML on resolved investigations

Separate spec, future phase. `embeddingService.ts` + canonical investigation format already provide the foundation. Surfaced in the UI polish redesign spec as Phase 6 territory.

### 7.3 NOC workbench vision expansion

Full in-app integration with Zendesk / Jira / Slack / Teams / Confluence beyond current read/write needs. Separate initiative; would redefine NocLense's scope from "log analyzer" to "NOC workbench."

### 7.4 Codebase restructure and documentation hygiene

**Explicitly flagged as out of scope for this spec, captured here so it doesn't get lost:**

The NocLense repo's `docs/` directory has accumulated slop: root-level markdowns mixed with proper subdirectories, overlapping implementation plans, deprecated handoffs, experimental design drafts, and session-specific scratch files. A brief inventory of the current state (as of 2026-04-20):

- Root-level mixed content: `AGENTS.md`, `AI_ONBOARDING_EXAMPLES.md`, `CHANGELOG_3-30-session.md`, `DEMO_SCRIPT.md`, `HANDOFF_enrique-3-30.md`, `IMPLEMENTATION_PLAN_3-30.md`, `IMPLEMENTATION_PLAN_4-02.md`, `ROADMAP_investigation-memory.md`, `USAGE_GUIDE.md`, plus others.
- Existing subdirectories that should be authoritative: `architecture/`, `decisions/`, `ops/`, `perf/`, `plans/`, `releases/`, `review/`, `runbooks/`, `superpowers/`, `tools/`.
- Legacy / deprecated: `chatgpt-prototype/`, `Q1_ACCELERATORS_SUBMISSION.md`, `CHATGPT_OAUTH_PIVOT_STATUS_2026-03-04.md`, `reference_noc_tool.html`.

**Scope of the separate initiative (to be executed by Codex under its own spec):**

- Audit every file in `docs/` and classify: authoritative, deprecated-but-keep, delete.
- Move deprecated-but-keep content to `docs/_archive/YYYY-MM-DD-<topic>/` with a DEPRECATED.md in each subdirectory noting superseded-by links.
- Authoritative content organized into clean subdirectories: `docs/architecture/`, `docs/runbooks/`, `docs/decisions/` (ADRs), `docs/ops/` (procurement, rollouts), `docs/specs/` (redirect to `superpowers/specs/`), `docs/philosophy/` (coding standards, development model, role split).
- Net-new foundational docs: code philosophies (TypeScript/React conventions, test strategy, error handling), onboarding (for future NOC engineers or contractors), handoff template.
- `README.md` top-level rewrite linking into the cleaned structure.

**When:** after Tauri migration Phase 3 completes (to avoid churn during the big shell swap).
**By whom:** Codex, dispatched with a dedicated cleanup spec. Claude can draft that cleanup spec as a brainstorm deliverable in a separate chat.
**Backup strategy per Enrique's direction:** all deprecated content preserved under `docs/_archive/`; nothing deleted outright. Git history remains full.

### 7.5 Changes to the UI polish redesign

The redesign operates entirely inside the WebView; shell migration is orthogonal. Any UI changes during Phase 2 happen on the `redesign/ui-polish` branch per its own spec and own cadence.

---

## 8. References

**Internal:**
- `CLAUDE.md` — project conventions and current architecture
- `README.md` — install and usage
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` — UI polish redesign (parallel)
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` — companion IT procurement request
- `~/.claude/projects/.../memory/feedback_codex_review_cycle.md` — role split: Claude designs, Codex executes
- `~/.claude/projects/.../memory/feedback_codex_workflow.md` — separate-session Codex workflow (no skills, no MCP)

**External:**
- Tauri 2.x documentation: https://tauri.app/start/
- Tauri capability system: https://tauri.app/security/capabilities/
- Tauri updater plugin: https://tauri.app/plugin/updater/
- Tauri keyring plugin: https://tauri.app/plugin/keyring/
- WebView2 runtime distribution modes: https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- AWS Lambda + API Gateway + DynamoDB patterns: (existing Axon cloud-architecture docs if applicable)
- DynamoDB TTL: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
- Authenticode signing: Microsoft docs on code signing best practices

---

## 9. Appendix A — Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | EV cert procurement delays (business verification slow) | Medium | Medium | Start procurement in Phase 0 in parallel with code work; use SSL.com or DigiCert for fastest turnaround |
| 2 | WebView2 version drift across NOC seats causes rendering regressions | Medium | Low | Document minimum supported WebView2 version in README; surface in CI tests; `embedBootstrapper` guarantees install |
| 3 | IndexedDB quota on WebView2 insufficient for 200MB+ logs | Low | Medium | Pre-flight `navigator.storage.estimate()` check; surface warning; tested in Phase 2h soak |
| 4 | Lambda cold start latency unacceptable for interactive use (DynamoDB makes this worse vs v1) | Low | Medium | Measured in Phase 1 gate; if problematic, switch to provisioned concurrency or Fargate |
| 5 | Auto-updater misfires (infinite reboot loop on bad update) | Low | High | Validate signatures aggressively; fail safe to no-update on any error; last-good version stays installed |
| 6 | Enrollment flow friction (user pastes wrong code, code expires during install, keyring write fails) (new in v2) | Medium | Low | Clear UI error messages; 15-min code TTL is forgiving; keyring fallback prompts re-enrollment |
| 7 | DynamoDB outage blocks all authenticated proxy requests (new in v2) | Low | High | DynamoDB historical availability >99.99%; proxy fails safe (no bypass); Tauri shows "service unavailable" UI; restore when DynamoDB recovers |
| 8 | Codex migration introduces regressions not caught by tests | Medium | Medium | Phase 2h 2-week soak on real workflows; Codex self-assessment per commit; Claude overview review |
| 9 | fullstack-developer bandwidth insufficient for parallel UI redesign + Tauri | Medium | Medium | Sequential phase gates; UI redesign self-contained on its branch with frontend-developer; no true parallelism demanded |
| 10 | Axon domain/GitHub org transition incomplete at Phase 0 | Medium | Low | Verify domain availability before committing identifier; flag any naming ambiguity with IT early |
| 11 | Rollback to Electron needed but codebase has drifted | Low | Medium | 90-day frozen Electron-via-proxy NSIS retention; Electron code in git history; any resurrection is a project, not a checkout |
| 12 | Path allowlist incomplete — a legitimate NocLense operation is rejected (new in v2) | Medium | Low | Enumeration during Phase 1 from existing service code; CI test covering every allowlisted op; add-to-allowlist requires PR review |

**Note: Risk 6 from v1 (shared HMAC leak) is removed in v2 — per-device credentials + revocation replace that threat model entirely.**

---

## 10. Appendix B — Budget

From `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`:

| Line item | One-time | Annual |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager + CloudWatch | — | $360 (upper bound) |
| AWS DynamoDB (3 tables, low QPS, pay-per-request) | — | $4 |
| EV Authenticode cert (SSL.com recommended) | — | $500 |
| Dev/staging AWS resources | — | $120 |
| DNS subdomain | — | $0 |
| GitHub Enterprise Releases | — | $0 |
| Datadog for proxy observability | — | $0 |
| **TOTAL** | **$0** | **~$984/yr** |

Budget ceiling to request: **$1,000/yr** (unchanged — fits within v1's request).

---

**End of spec v2. Hard stop here. Ready for `/codex:adversarial-review` re-review.**
