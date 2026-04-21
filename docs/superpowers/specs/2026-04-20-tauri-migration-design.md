# NocLense Tauri Migration — Design Spec

**Date:** 2026-04-20
**Owner:** Enrique Velazquez, Network Engineer, SaaS Operations (Axon Enterprise / APEX)
**Status:** Draft — awaiting `/codex:review` before implementation begins
**Role split:** Claude designs and reviews; Codex implements commit-by-commit with self-assessment after each commit (per `feedback_codex_review_cycle.md`)

**Related specs:**
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` — UI polish redesign (parallel work on `redesign/ui-polish` branch; not blocked by this migration)
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` — Procurement / IT request (approvals checklist; companion to this spec)

---

## Executive Summary

NocLense is migrating from Electron + Vercel serverless proxies to a standalone Tauri 2.x desktop application backed by a dedicated integration proxy on AWS.

**Three independent failure domains replace today's single-point-of-failure:**

1. **Tauri client** — zero integration secrets in the distributed binary; only an HMAC key that rotates on major releases via auto-update.
2. **AWS-hosted integration proxy** — holds the 5 org admin credentials in AWS Secrets Manager; stateless Lambda + API Gateway.
3. **GitHub Enterprise Releases** — hosts signed `.msi` binaries + Ed25519-signed update manifest.

**Timeline:** ~6–8 weeks engineering after approvals land. Procurement/approval work (AWS access, EV cert, security review) can run in parallel (~2–4 weeks).

**Budget:** ~$980/yr recurring; $0 one-time capex. (Detail in `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`.)

**Risk profile:** Low. 95% of the React codebase is shell-agnostic and ports unchanged; the Electron native surface is ~430 LOC and maps cleanly to ~600 LOC of Rust. The UI polish redesign on its parallel branch is not affected.

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
3. Establish production-grade standalone desktop experience: native packaging, code-signed installers, auto-updates, OS-integrated secret storage.
4. Preserve the UI polish redesign work already underway on a parallel branch. Shell migration must not require UI work to be redone.
5. Match Axon Enterprise naming/identity conventions throughout.

---

## 2. Architecture overview (end-state)

### 2.1 Three independent components

```
┌─────────────────────────────────────────────────────┐
│  NocLense Tauri app (installed on NOC seats)        │
│  - WebView2 on Windows (system-provided Chromium)   │
│  - React 19 + Vite frontend (unchanged from today)  │
│  - Rust main process (~600 LOC target)              │
│  - Zero integration secrets in binary               │
│  - Holds only: HMAC key (baked, rotates on release) │
└─────────────────────────────────────────────────────┘
          │                              │
          │ HMAC-signed HTTPS            │ Auto-update poll
          ▼                              ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│  AWS integration proxy  │      │  GitHub Enterprise       │
│  Lambda + API Gateway   │      │  Releases                │
│  Stateless, ~300 LOC    │      │  - Signed .msi           │
│                         │      │  - latest.json manifest  │
│  - /proxy/unleash       │      │    (Ed25519-signed)      │
│  - /proxy/datadog       │      └──────────────────────────┘
│  - /proxy/zendesk       │
│  - /proxy/confluence    │
│  - /proxy/jira          │
└─────────────────────────┘
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
- **Native process:** Rust, capability-scoped. Target ~600 LOC in `src-tauri/src/main.rs`.
- **Filesystem access:** scoped to `$APPDATA/NocLense/**`, `$DOCUMENTS/DailyNOC/**`, and user-selected drop files. No broad shell or arbitrary HTTP.
- **Secret storage:** HMAC key baked into build as compile-time constant. No OS keyring in v1 (see § 5.4 for rationale).
- **Auto-update:** Tauri's built-in updater with Ed25519 signature verification.
- **Packaging:** Authenticode-signed `.msi` installer. Bundle identifier `com.axon.noclense`.

### 2.3 Proxy: tiny hybrid service on AWS

- **Platform:** AWS Lambda + API Gateway (low-QPS stateless proxy, folds into existing Axon AWS footprint).
- **Endpoints (5):** `POST /proxy/unleash`, `POST /proxy/datadog`, `POST /proxy/zendesk`, `POST /proxy/confluence`, `POST /proxy/jira`.
- **Credentials:** All org admin tokens in AWS Secrets Manager; Lambda reads on cold start via IAM role.
- **Authentication:** HMAC-SHA256 shared-secret verification on every request.
- **Stateless:** no database, no session store, no user identity.
- **Observability:** structured JSON logs to existing Axon Datadog.

### 2.4 Update manifest server: GitHub Enterprise Releases

- **Hosting:** Release artifacts (`noclense_<version>_x64_en-US.msi`) + `latest.json` manifest published under the Axon Enterprise GitHub org.
- **Signatures:** Two-layer. (1) Authenticode on the `.msi` (Windows SmartScreen trusts immediately). (2) Ed25519 on the `latest.json` manifest (Tauri verifies before any download).
- **Signing keys:** Ed25519 private key in GitHub Actions secret; Authenticode cert thumbprint (or Azure Key Vault reference) in CI.

### 2.5 Data flow and failure domains

**Three independent failure domains:**

| Failure | Impact |
|---|---|
| Proxy down | AI + Datadog + Zendesk + Confluence + Jira fail. App still runs; user sees "integration unavailable" messages per surface. Local investigation work continues. |
| Update server down | Existing installs keep working; no new updates reach seats. |
| Vendor API down (e.g. Datadog) | That integration fails; other four still work through proxy. Matches today's vendor-outage behavior. |

### 2.6 Token rotation guardrail

Before any Tauri build leaves dev, all 5 vendor admin tokens are rotated. This establishes a clean cryptographic baseline: any Electron builds in the wild (pre-incident or otherwise) hold tokens that no longer work with upstream vendors. Old integration capability dies at the rotation event, regardless of installer redistribution.

Rotation choreography detailed in § 6.2.

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
- [ ] Provision AWS resources under existing Axon AWS account: Lambda function, API Gateway, Secrets Manager namespace, CloudWatch log group, IAM role with least-privilege secret read access.
- [ ] Allocate subdomain `noclense-proxy.axon.com` (or IT-specified equivalent).
- [ ] Generate initial HMAC shared secret (32+ random bytes). Installed in AWS Secrets Manager; baked into first Tauri build at compile time.

**Output:** credentials, cert, hosting account, signing keys, DNS. No code.

### 3.3 Phase 1 — Proxy service (~2 weeks, fullstack-developer)

Build and deploy the 5-endpoint hybrid proxy.

- [ ] Node/TypeScript service (Node 20+, matching existing stack conventions).
- [ ] Five endpoints as specified in § 4.
- [ ] HMAC middleware verifying `X-NocLense-Signature` header on every request body.
- [ ] Stateless; no DB; no session; signature verify + credential inject + request forward.
- [ ] In-memory rate limiting per endpoint (defense-in-depth; actual quotas enforced upstream at vendors).
- [ ] Structured JSON request/response logging to Datadog.
- [ ] Health check endpoint for API Gateway.
- [ ] Secrets in AWS Secrets Manager: `UNLEASH_TOKEN`, `UNLEASH_ASSISTANT_ID`, `DATADOG_API_KEY`, `DATADOG_APP_KEY`, `ZENDESK_EMAIL`, `ZENDESK_TOKEN`, `CONFLUENCE_EMAIL`, `CONFLUENCE_TOKEN`, `JIRA_EMAIL`, `JIRA_TOKEN`, `HMAC_SHARED_SECRET`.

**Gate before Phase 2:** proxy deployed, HMAC validation tested, all five endpoints reachable from current Electron (via temporary signing shim in Electron's main.js), 24 hours uneventful operation.

**Token rotation event at end of Phase 1** — see § 6.2.

### 3.4 Phase 2 — Tauri shell migration (~3–5 weeks, fullstack-developer)

Substages:

**2a. Scaffold (1 day).** `npm create tauri-app@latest`, point at existing Vite `dist/`, verify React 19 loads in WebView2 window. First commit green.

**2b. electronAPI compat shim (3–5 days).** Inventory the 11 files; write Tauri `#[tauri::command]` equivalents for the 4 custom operations (detailed in § 5.3); write `src/shell/api.ts` that detects `window.__TAURI__` vs `window.electronAPI` and dispatches. Keep Electron still building during this work. ~140 lines of JS changes, ~300 lines of Rust.

**2c. Secret storage simplification (1–2 days).** Delete `src/store/apiKeyStorage.ts` — integration tokens move entirely to the proxy; no client-side secret storage. Any user preferences that were in secure storage migrate to `$APPDATA/NocLense/preferences.json`.

**2d. Error-reporting webhook (0.5 day).** Move from `process.env.NOCLENSE_ERROR_REPORT_URL` in `electron/main.js` to Rust-side `reqwest` call via new `report_error` command.

**2e. Auto-updater wiring (1–2 days).** `@tauri-apps/plugin-updater` pointed at GitHub Releases manifest URL; Ed25519 pubkey baked; test full + delta update cycles.

**2f. CI/CD (2–3 days).** `tauri build` in GitHub Actions, Authenticode signing for `.msi`, Ed25519 signing of `latest.json`, publish artifacts to GitHub Releases.

**2g. Dual-run validation (1–2 weeks calendar).** Tauri build on internal dev seats alongside Electron. Soak on real NOC workflows. Fix WebView2-specific regressions (IndexedDB quota, font antialiasing, Motion edge cases).

**Gate before Phase 3:** Tauri build passes full vitest suite in WebView2; 2+ weeks internal soak with no critical regressions; auto-update tested end-to-end.

### 3.5 Phase 3 — Cutover + Electron retirement (~0.5 day)

See § 6.6. Executed after the 14-day pilot GO-gate (§ 6.5) clears.

### 3.6 Parallel coordination with UI redesign

The UI polish redesign runs on `redesign/ui-polish` branch owned by frontend-developer throughout all phases. It does not stop, pause, or slow for the shell migration.

**Coordination point:** when fullstack-developer merges the Phase 2 shim commit (touching `src/shell/api.ts` + the 11 electronAPI files), frontend-developer rebases the redesign branch. The changes are scoped to the top-of-file shell-detection helpers, not the API-interaction code that UI phases extend. Expected conflict: zero or minor.

A standing async ping at merge time is enough. No synchronous sync meetings required.

### 3.7 Agent ownership

| Phase | Owner | Claude's role |
|---|---|---|
| 0 (Foundation prep) | fullstack-developer + Enrique (procurement) | Review prep checklist; confirm approvals land |
| 1 (Proxy) | fullstack-developer | Review each commit's self-assessment per role-split cycle; design oversight |
| 2 (Tauri migration) | fullstack-developer | Review each commit; resolve design questions; coordinate with frontend-developer |
| 3 (Cutover) | fullstack-developer | Sign-off GO/NO-GO |
| UI redesign (ongoing) | frontend-developer | Separate track; unchanged review cadence |

---

## 4. Proxy service design

Hosting-agnostic by design — the code runs identically on AWS Lambda, a Fly.io VM, or a local Node process. AWS Lambda is the assumed target.

### 4.1 Request/response envelope

All five endpoints follow the same envelope pattern.

**Request envelope (all endpoints):**

```ts
interface ProxyRequest<TPayload> {
  /** ISO-8601 timestamp; rejected if >60s skew from server time */
  timestamp: string;
  /** Opaque random nonce; prevents replay within the timestamp window */
  nonce: string;
  /** Scenario-specific payload */
  payload: TPayload;
}
```

**Response envelope:**

```ts
type ProxyResponse<TResult> =
  | { ok: true; result: TResult }
  | {
      ok: false;
      error: {
        code: string;            // e.g. 'upstream_4xx', 'hmac_invalid', 'rate_limited'
        message: string;
        upstreamStatus?: number; // present on upstream_4xx / upstream_5xx
      };
    };
```

**HMAC signature:** In `X-NocLense-Signature` header. Client computes `HMAC-SHA256(timestamp + "." + nonce + "." + JSON.stringify(payload), HMAC_SHARED_SECRET)` and base64-encodes. Proxy recomputes and compares in constant time. Signature covers timestamp + nonce to prevent replay.

**Replay prevention:** in-memory nonce cache in the Lambda container, TTL = 60s (same as timestamp skew tolerance). Container recycling clears cache, which is acceptable — replay window is bounded by timestamp skew regardless.

### 4.2 Endpoint shapes

| Endpoint | Payload | Forwards to | Credentials injected |
|---|---|---|---|
| `POST /proxy/unleash` | `{ chatId?, userEmail, message, ... }` (mirrors current `POST /chats` body) | `https://api.unleash.so/chats` | `Authorization: Bearer ${UNLEASH_TOKEN}`, `X-Assistant-Id: ${UNLEASH_ASSISTANT_ID}` |
| `POST /proxy/datadog` | `{ method: 'search' \| 'station-discover' \| 'test', query, timeRange, ... }` | `https://api.${DATADOG_SITE}/api/v2/logs/events/search` or `/api/v1/metrics/search` depending on `method` | `DD-API-KEY: ${DATADOG_API_KEY}`, `DD-APPLICATION-KEY: ${DATADOG_APP_KEY}` |
| `POST /proxy/zendesk` | `{ method: 'GET' \| 'POST' \| 'PUT', path, body? }` — generic REST passthrough | `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2${path}` | Basic auth: `${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}` base64 |
| `POST /proxy/confluence` | `{ method, path, body? }` — generic REST passthrough | `https://${CONFLUENCE_SUBDOMAIN}.atlassian.net/wiki/api/v2${path}` | Basic auth |
| `POST /proxy/jira` | `{ method, path, body? }` — generic REST passthrough | `https://${JIRA_SUBDOMAIN}.atlassian.net/rest/api/3${path}` | Basic auth |

**Rationale for generic `{ method, path, body }` on Atlassian/Zendesk:** the existing client-side services make many different REST calls (`/tickets`, `/users`, `/search`, custom fields). A generic pass-through avoids writing a bespoke proxy endpoint per API call site. The tradeoff is that the proxy doesn't validate allowed paths — any valid Zendesk path reachable from the credentials is reachable through the proxy. This is acceptable given the credentials already grant that access; the proxy doesn't widen the blast radius beyond the credentials themselves.

### 4.3 Error handling taxonomy

| `error.code` | HTTP | Meaning | Client action |
|---|---|---|---|
| `hmac_invalid` | 401 | Signature verification failed | Likely wrong HMAC key — user on outdated client. Prompt update. |
| `hmac_expired` | 401 | Timestamp outside skew window | Retry once with fresh timestamp; if still fails, surface clock-skew warning. |
| `rate_limited` | 429 | Per-endpoint bucket exhausted | Exponential backoff. Not expected in normal use at team size. |
| `upstream_4xx` | 502 | Upstream vendor returned 4xx | Likely vendor-side config (expired admin token, API change). Log INFO; surface generic "service unavailable" to user. |
| `upstream_5xx` | 502 | Upstream 5xx | Transient. Retry once; if persistent, degraded-mode UI. |
| `upstream_timeout` | 504 | Upstream request >30s | Unleashed long prompts may hit this. Show "taking longer than expected" after 10s client-side. |
| `internal_error` | 500 | Proxy bug | Client logs; surfaces "unexpected error." Should not fire in steady state. |

### 4.4 Rate limiting

Simple in-memory token bucket per endpoint:

- Unleashed: 20 req/min per Lambda container (unlimited license; mostly smooths accidental loops)
- Datadog: 30 req/min (defense-in-depth; Datadog enforces its own upstream)
- Zendesk / Confluence / Jira: 60 req/min each

Not shared across Lambda invocations — each cold container has its own bucket. At low QPS, effectively no rate limiting. Acceptable for internal tool threat model; upgrade to Redis-backed distributed limiter if ever needed.

### 4.5 Observability

Structured JSON logs per request, shipped to Axon Datadog:

```json
{
  "ts": "2026-04-20T15:30:45.123Z",
  "endpoint": "/proxy/unleash",
  "result": "ok",
  "upstream_status": 200,
  "duration_ms": 843,
  "client_version": "noclense-1.4.2",
  "request_bytes": 2048,
  "response_bytes": 8192
}
```

**NOT logged:** request payloads, response bodies, auth headers, cookies, user prompts, ticket text. Metadata only.

### 4.6 Secret rotation flow

**Vendor token rotation** (e.g. Unleashed) — operations playbook:

1. Generate new token at vendor.
2. Install in AWS Secrets Manager under `UNLEASH_TOKEN_NEW` (alongside existing `UNLEASH_TOKEN`).
3. Deploy proxy version that accepts either secret name; verify with smoke test.
4. Rename `UNLEASH_TOKEN_NEW` → `UNLEASH_TOKEN`; delete old value.
5. Revoke old token at vendor.

**HMAC key rotation** (requires coordinated client update):

1. Generate new HMAC key; add to Secrets Manager as `HMAC_KEY_NEXT`.
2. Deploy proxy version accepting signatures from either `HMAC_KEY` or `HMAC_KEY_NEXT`.
3. Ship new Tauri build with new HMAC; publish to GitHub Releases.
4. Wait 48 hours for auto-update to reach all seats.
5. Flip proxy to reject old HMAC; remove `HMAC_KEY`; rename `HMAC_KEY_NEXT` → `HMAC_KEY`.

### 4.7 Non-goals for proxy v1

- **Per-user auth (SSO, JWT, user identity).** Upgrade path exists via additive `Authorization` header alongside HMAC if ever needed.
- **Request caching.** Not worth it at this QPS.
- **Upstream failover.** If a vendor is down, that integration is down; not the proxy's job to synthesize responses.
- **Business logic transformations.** Pure pass-through.
- **Batch / GraphQL endpoints.** Five narrow endpoints, one upstream per endpoint.

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

**Key decisions with rationale:**

- `withGlobalTauri: false` — no `window.__TAURI__` global pollution. Renderer uses `import { invoke } from '@tauri-apps/api/core'`. Forces explicit imports, easier to grep, avoids Electron-style "is there a Tauri API on window" detection pattern.
- CSP locks `connect-src` to the proxy domain + self. Any regression where a service forgets to route through the proxy fails at the browser layer, not silently.
- `webviewInstallMode: embedBootstrapper` ships the WebView2 bootstrapper in the MSI. ~2MB add; guarantees install works even on older Win10 builds that might lack WebView2.
- `allowDowngrades: false` — auto-updater refuses older versions. Prevents rollback attack via signed-but-old releases.

**Include:** `tauri-plugin-window-state` (saves window size/position across launches) — confirmed low-risk UX win.

### 5.2 Capability system

Tauri 2's declarative capability JSON replaces Electron's "context isolation + preload whitelist" pattern. The capability file is living documentation — a reviewer sees exactly what native powers the frontend has in ~20 lines.

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

### 5.3 `invoke()` surface — four custom commands

| Command | Args | Returns | Replaces |
|---|---|---|---|
| `get_crash_reports` | `{ limit: u32 }` | `Vec<CrashReport>` | `window.electronAPI.getCrashReports({ limit })` |
| `open_crash_log_location` | `()` | `()` | `window.electronAPI.openCrashLogLocation()` |
| `clear_crash_reports` | `()` | `u32` (count deleted) | `window.electronAPI.clearCrashReports()` |
| `report_error` | `{ payload: ErrorReportPayload }` | `()` | `app:report-error` IPC in `electron/main.js` |

**Everything else uses plugin-provided commands** (dialog, updater, fs).

**Explicit non-Tauri commands:**

- **Secret storage** — `apiKeyStorage.ts` deletes entirely. Integration tokens live on the proxy. Legacy `safeStorage` commands have no Tauri equivalent because they have no consumer.
- **Proxy URL resolution** — collapses to a single constant. No branching; no detection. In Tauri: always proxy. In dev: localhost:5173 via Vite reverse-proxy.
- **User preferences** — `$APPDATA/NocLense/preferences.json` via standard `fs:allow-write-text-file` capability. No custom command.

### 5.4 Secret handling philosophy

**Revised design: no OS keyring in v1.**

| Secret | Where it lives | Why |
|---|---|---|
| 5 vendor integration tokens | AWS Secrets Manager (proxy) | Not on the client, period. |
| HMAC shared secret | Baked into Tauri build as compile-time constant | Rotates on major release via auto-update; keyring adds no security value over a constant already in the `.msi`. |
| User preferences | `$APPDATA/NocLense/preferences.json` | Not secrets. Plaintext JSON. |
| Crash report correlation UUID | Same preferences.json | Not a secret. First-launch generated. |

**Design rationale — the HMAC key is baked into the binary by design, not oversight:**

Anyone with a `.msi` can extract the HMAC key. This is acceptable because:

1. The HMAC key only authorizes proxy access — it is not an upstream vendor credential. An attacker with the HMAC cannot directly call Datadog/Zendesk/etc.; they can only call the proxy.
2. Proxy rate limits bound the blast radius of a leaked HMAC to "normal usage rates."
3. Rotation is automatic on the next major release via auto-update. Treating the HMAC as a keyring-worthy secret would add UX friction (first-run keyring prompt? Copy-paste from where?) without adding security.
4. The actual sensitive secrets — the 5 vendor admin tokens — are in AWS Secrets Manager, never touch the client, and are protected by IAM + HMAC-gated proxy access.

If SSO is added in the future, per-user JWTs would live in Tauri's keyring plugin. That's a clean additive change, not a redesign.

### 5.5 Auto-updater — two-layer signing

1. **Authenticode (Windows)** — `.msi` signed with the EV cert. SmartScreen trusts immediately.
2. **Tauri Ed25519** — `latest.json` manifest signed with separately-held Ed25519 key. Tauri verifies before downloading the `.msi`, guaranteeing the manifest came from Axon (not a compromised CDN cache).

**Manifest format:**

```json
{
  "version": "1.5.0",
  "notes": "Release notes shown in update dialog",
  "pub_date": "2026-04-20T15:30:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IG5vY2xlbnNlLW1z...",
      "url": "https://github.com/<axon-org>/noclense/releases/download/v1.5.0/noclense_1.5.0_x64_en-US.msi"
    }
  }
}
```

**Update flow:**

1. App launches. Tauri updater GETs the endpoint.
2. Newer version → validates manifest's Ed25519 signature against baked pubkey.
3. Dialog: "NocLense 1.5.0 available. Install?" with release notes.
4. On accept: downloads `.msi`, validates Authenticode, launches installer with `passive` flags.
5. Installer closes app, installs, relaunches.

Any validation failure → silent abort, CloudWatch log, no user prompt. Fails safe.

### 5.6 Window / WebView configuration details

- Window size persistence via `tauri-plugin-window-state`.
- DevTools force-disabled in release builds. No keyboard shortcut.
- `style-src 'unsafe-inline'` precautionary for Tailwind/emotion; audit in later hardening pass.

### 5.7 Build and CI

GitHub Actions workflow on tag push (`v*`):

```
1. Checkout + setup (Node 20, Rust stable, MSVC toolchain)
2. npm ci
3. npm run test:run                  # vitest + TS + ESLint must all pass
4. npm run tauri build               # signed .msi via cert thumbprint
5. tauri signer sign latest.json     # Ed25519 sign the manifest
6. gh release create <tag> <.msi> latest.json
```

**Required Actions secrets:**
- `TAURI_SIGNING_PRIVATE_KEY` — Ed25519 private key (base64)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — passphrase
- `WINDOWS_CERTIFICATE` — .pfx (base64) or Azure Key Vault reference
- `WINDOWS_CERTIFICATE_PASSWORD` — if password-protected

**Output artifacts:**
- `noclense_<version>_x64_en-US.msi`
- `latest.json`

Both published to GitHub Releases with tag name.

### 5.8 Migration shim — the transition layer

Between Phase 2 start and Phase 3 complete, both shells coexist. The shim at `src/shell/api.ts` hides shell detection behind a uniform API:

```ts
export interface ShellAPI {
  getCrashReports(limit?: number): Promise<CrashReport[]>;
  openCrashLogLocation(): Promise<void>;
  clearCrashReports(): Promise<number>;
  reportError(payload: ErrorReportPayload): Promise<void>;
}

// Detection at module load:
// - window.__TAURI__ present → Tauri implementation
// - window.electronAPI present → Electron implementation
// - Neither (web browser in dev) → no-op with warnings
export const shell: ShellAPI = detectShell();
```

Every call site imports `shell` from `'@/shell/api'` instead of reaching into `window.electronAPI` directly.

**Phase 3 retirement:** delete the Electron branch from the shim; keep Tauri only.

Net new code: ~150 lines of shim (TypeScript) + ~300 lines of Rust for the 4 custom commands.

### 5.9 What's intentionally not in the Rust layer

| Tempting to add | Why skipping | Upgrade path if needed |
|---|---|---|
| Native log file streaming | File API works in WebView2 | Add `fs:stream` only if real performance problem |
| Native PDF parser | `pdfjs-dist` works in WebView2 | Keep as-is |
| Native ZIP extraction | `jszip` works in WebView2 | Keep as-is |
| Background workers | Web Workers work in WebView2 | Keep as-is |
| Native notification center | `Notification` API works | Add `notification:default` only if UX demands it |
| Keyring plugin | Not needed in v1 | Add when SSO/per-user tokens enter scope |

---

## 6. Rollout and pilot plan

### 6.1 Pre-rollout prep (Day -14 to Day 0)

Hard prerequisites. Nothing starts without all green.

| Item | Owner | Verification |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager provisioned | fullstack-developer + IT | `curl https://noclense-proxy.axon.com/health` → 200 |
| 7 secrets populated in AWS Secrets Manager | Enrique (admin tokens) + fullstack-developer (HMAC, Ed25519) | AWS console shows all 7 |
| EV Authenticode cert issued; installed in CI secrets | Legal signatory + fullstack-developer | `signtool verify` passes on test `.msi` |
| Ed25519 keypair generated; pubkey baked; privkey in Actions secret | fullstack-developer | `tauri signer verify` passes on test `latest.json` |
| Subdomain `noclense-proxy.axon.com` provisioned | IT DNS admin | `dig` returns expected CNAME |
| CI produces signed `.msi` + signed `latest.json` to test Release | fullstack-developer | GitHub Release with both artifacts |
| Tauri build installable on 1 dev machine; auto-update cycle tested | fullstack-developer | Dev machine receives update successfully |
| Pilot participants identified and briefed | Enrique | Committed for 2-week soak |
| Pilot Slack channel created | Enrique | Channel active |

### 6.2 Token rotation choreography (Day 0, T+0 through T+60)

This is the single atomic window to kill old-binary blast radius. Schedule for off-peak NOC hours. Pilot group on standby.

| T+ | Step | Owner | Expected state |
|---|---|---|---|
| 0:00 | Snapshot current proxy secrets to sealed backup file | fullstack-developer | Backup exists |
| 0:05 | Generate new Unleashed token; install as `UNLEASH_TOKEN_NEW` in Secrets Manager | Enrique | Secret exists alongside old |
| 0:10 | Verify proxy endpoint works with new token | fullstack-developer | 200 OK |
| 0:15 | Rename `UNLEASH_TOKEN_NEW` → `UNLEASH_TOKEN`; delete old | fullstack-developer | Only new token |
| 0:20–0:40 | Repeat for Datadog, Zendesk, Confluence, Jira | Enrique + fullstack-developer | All 5 on new tokens |
| 0:45 | Revoke old tokens at each vendor | Enrique | Old tokens dead |
| 0:50 | Smoke test each proxy endpoint from Tauri dev build | fullstack-developer | All 5 return expected responses |
| 0:55 | Announce in pilot channel | Enrique | Message sent |
| 1:00 | Broader NOC team comms | Enrique | Sent |

### 6.3 Dual-build transition (Day 0 through Day +14)

| Environment | Electron | Tauri |
|---|---|---|
| Branch | `main` | `main` |
| Installer | `.exe` (NSIS) still built by CI | `.msi` (Tauri) for pilot |
| Distribution | Manual link | Auto-update + initial manual install |
| Integration | **Non-functional** after T+45 (tokens rotated) | Functional through proxy |

Pilot agents can keep Electron installed for reference but all live integration work moves to Tauri.

After Day +14, CI stops building Electron artifacts. Phase 3 begins.

### 6.4 Internal pilot program

| Dimension | Plan |
|---|---|
| Pilot group size | 3–5 NOC agents including Enrique |
| Selection criteria | Active NOC workload; diversity of ticket patterns |
| Duration | 14 calendar days from first pilot install |
| Cadence | Daily async in pilot channel; weekly 30-min retro |
| Installation | Manual MSI from GitHub Release; auto-update thereafter |

**Tracked metrics and bars:**

| Metric | Bar |
|---|---|
| Crash count | ≤ 1/agent/week |
| Memory footprint (4h steady state) | Median RSS ≤ 200MB |
| Cold start time | ≤ 2s on pilot hardware |
| Auto-update reach within 24h | ≥ 95% of pilot seats on latest |
| Investigation workflow completion | Yes for all agents; no regressions vs Electron |
| WebView2 rendering fidelity | No visible regressions vs Electron baseline |
| 200MB+ IndexedDB log load | Completes without quota errors |
| Proxy latency overhead | ≤ 150ms vs direct call |

### 6.5 GO/NO-GO gate (Day +14)

**All must pass for GO:**

1. Zero unresolved P0/P1 bugs.
2. Zero unresolved security-review findings.
3. All 8 pilot metrics met.
4. Auto-update cycle exercised at least once per pilot seat successfully.
5. Full test suite green on main.
6. IndexedDB 200MB+ log path verified on ≥2 pilot machines.
7. Pilot consensus: "this is better than Electron."
8. fullstack-developer greenlight on Phase 3 execution readiness.

**NO-GO triggers (any one):**
- P0/P1 bug with no known workaround.
- Auto-update failure rate >5%.
- Performance regression ≥20% on measured workflow.
- WebView2 rendering bug affecting investigation workflow.
- Unremediated security finding.

**On NO-GO:** Phase 2 reopens. Tauri pilot continues. No Electron retirement until re-GO.

**NO-GO decision:** Enrique + fullstack-developer jointly. Not a single-person call.

### 6.6 Phase 3 — Electron retirement (Day +14 to +17)

| Step | Owner | Duration |
|---|---|---|
| Delete `electron/` directory | fullstack-developer | 1 hour |
| Remove `electron-builder` config from `package.json` | fullstack-developer | 30 min |
| Remove Electron-only npm scripts | fullstack-developer | 30 min |
| Delete Electron branches from `src/shell/api.ts` | fullstack-developer | 1 hour |
| Strip `electron-builder` dependencies | fullstack-developer | 30 min |
| Update `CLAUDE.md` — Tauri-only architecture | Claude drafts, fullstack-developer reviews | 2 hours |
| Update `README.md` install instructions | Enrique + Claude | 1 hour |
| Archive last Electron NSIS to `frozen/` (90-day retention) | fullstack-developer | 30 min |
| Tag `v2.0.0` — first post-Electron release | fullstack-developer | 5 min |
| Announce broadly | Enrique | 10 min |

Total: ~1 business day.

### 6.7 Rollback plan

| Severity | Response | Time-to-restore |
|---|---|---|
| Minor bug | Hotfix Tauri, auto-update rolls out | ~4h |
| Major bug | Freeze auto-update at last-good; ship hotfix | ~4–8h |
| Catastrophic (security) | Rotate HMAC immediately (kills all Tauri until update); optionally re-issue frozen Electron with temp tokens | ~30m HMAC; ~4h Electron restore |

**Frozen Electron NSIS retention:** 90 days unless corporate compliance mandates different (confirm with Axon policy; match if stricter).

### 6.8 Post-cutover operations

**Ownership:**

| System | Primary | Backup |
|---|---|---|
| Proxy (Lambda + API Gateway) | fullstack-developer | Enrique |
| AWS Secrets Manager | Enrique | fullstack-developer |
| Tauri build + release | fullstack-developer | Enrique |
| Ed25519 signing key | fullstack-developer | Enrique (sealed backup) |
| EV Authenticode cert | Legal signatory + fullstack-developer | — |
| Datadog logs for proxy | Enrique | fullstack-developer |

**Recurring operations:**

| Cadence | Operation |
|---|---|
| Every major release | HMAC key rotation (48h window) |
| Annually | Rotate 5 vendor tokens; renew EV cert; audit IAM |
| As needed | Respond to proxy alerts; investigate 4xx/5xx spikes |
| Quarterly | Update Tauri + Rust deps; rebuild and re-pilot |

### 6.9 Runbooks to write (post-cutover)

Claude drafts from this spec as each phase completes, with fullstack-developer reviewing (lower overhead than drop-at-end):

1. "Rotating a vendor admin token"
2. "Rolling back to a previous Tauri release"
3. "Diagnosing a proxy outage"
4. "Responding to auto-update failures"
5. "HMAC key rotation playbook"
6. "EV cert annual renewal"

Location: `docs/runbooks/`. Linked from main README.

### 6.10 Documentation updates (Day +14 onward)

| File | Change type | Reviewer |
|---|---|---|
| `CLAUDE.md` | Major rewrite — remove "Electron / React Boundary"; add "Tauri Shell" | fullstack-developer |
| `README.md` | Replace "Desktop App (Electron)" with "Desktop App (Tauri)" | Enrique |
| `package.json` | Remove `electron`, `electron-builder`, `wait-on`, `concurrently`, `cross-env` | fullstack-developer |
| `vite.config.ts` | Keep as-is | — |
| `docs/superpowers/specs/2026-04-20-tauri-migration-design.md` | Mark as "Implemented" in frontmatter | Claude |
| `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` | Update sign-off checklist | Enrique |
| `docs/runbooks/` | Net-new directory + 6 runbooks | Claude drafts, fullstack-developer reviews |

---

## 7. Non-goals

Explicitly out of scope for this spec:

### 7.1 Per-user SSO authentication

HMAC shared-secret is proportionate for Axon NOC team size. SSO becomes worth the complexity when:
- Team exceeds ~100 agents.
- Compliance requires per-call user attribution.
- One-seat revocation becomes necessary.

Upgrade path: additive `Authorization: Bearer <jwt>` header alongside HMAC during transition; HMAC removed post-cutover. Clean incremental change, not a rewrite.

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

**External:**
- Tauri 2.x documentation: https://tauri.app/start/
- Tauri capability system: https://tauri.app/security/capabilities/
- Tauri updater plugin: https://tauri.app/plugin/updater/
- WebView2 runtime distribution modes: https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- AWS Lambda + API Gateway patterns: (existing Axon cloud-architecture docs if applicable)
- Authenticode signing: Microsoft docs on code signing best practices

---

## 9. Appendix A — Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | EV cert procurement delays (business verification slow) | Medium | Medium | Start procurement in Phase 0 in parallel with code work; use SSL.com or DigiCert for fastest turnaround |
| 2 | WebView2 version drift across NOC seats causes rendering regressions | Medium | Low | Document minimum supported WebView2 version in README; surface in CI tests; `embedBootstrapper` guarantees install |
| 3 | IndexedDB quota on WebView2 insufficient for 200MB+ logs | Low | Medium | Pre-flight `navigator.storage.estimate()` check; surface warning; tested in Phase 2g soak |
| 4 | Lambda cold start latency unacceptable for interactive use | Low | Medium | Measured in Phase 1 gate; if problematic, switch to provisioned concurrency or Fargate |
| 5 | Auto-updater misfires (infinite reboot loop on bad update) | Low | High | Validate signatures aggressively; fail safe to no-update on any error; last-good version stays installed |
| 6 | HMAC key leaks + proxy abuse before rotation | Medium | Low | Rate limits; Datadog alerts on anomalous 4xx spikes; rotation is a single-release fix |
| 7 | Codex migration introduces regressions not caught by tests | Medium | Medium | Phase 2g 2-week soak on real workflows; Codex self-assessment per commit; Claude overview review |
| 8 | fullstack-developer bandwidth insufficient for parallel UI redesign + Tauri | Medium | Medium | Sequential phase gates; UI redesign self-contained on its branch with frontend-developer; no true parallelism demanded |
| 9 | Axon domain/GitHub org transition incomplete at Phase 0 | Medium | Low | Verify domain availability before committing identifier; flag any naming ambiguity with IT early |
| 10 | Rollback to Electron needed but codebase has drifted | Low | Medium | 90-day frozen NSIS artifact retention; Electron code in git history; any resurrection is a project, not a checkout |

---

## 10. Appendix B — Budget

From `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`:

| Line item | One-time | Annual |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager + CloudWatch | — | $360 (upper bound) |
| EV Authenticode cert (SSL.com recommended) | — | $500 |
| Dev/staging AWS resources | — | $120 |
| DNS subdomain | — | $0 |
| GitHub Enterprise Releases | — | $0 |
| Datadog for proxy observability | — | $0 |
| **TOTAL** | **$0** | **~$980/yr** |

Budget ceiling to request: **$1,000/yr**.

---

**End of spec. Hard stop here. Ready for `/codex:review`.**
