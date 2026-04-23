# NocLense Tauri Migration — Design Spec

**Date:** 2026-04-20
**Version:** v4 (draft)
**Owner:** Enrique Velazquez, Network Engineer, SaaS Operations (Axon Enterprise / APEX)
**Status:** Draft v4 — awaiting third `/codex:adversarial-review` re-review before implementation begins
**Role split:** Claude designs and reviews; Codex implements commit-by-commit with self-assessment after each commit (per `feedback_codex_review_cycle.md`)

**Related specs:**
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` — UI polish redesign (parallel work on `redesign/ui-polish` branch; not blocked by this migration)
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` — Procurement / IT request (approvals checklist; companion to this spec)

---

## Revision history

| Version | Date | Summary of changes |
|---|---|---|
| v1 | 2026-04-20 | Initial draft. Shared HMAC baked; stateless proxy with generic passthrough; in-memory nonce cache; Electron cut at T+45. |
| v2 | 2026-04-20 | Per-device HMAC; DynamoDB nonce + idempotency store; path allowlists; Electron-via-proxy stays live. |
| v3 | 2026-04-20 | Ed25519 asymmetric signatures; idempotency state machine; drop response_body caching; operational Electron-via-proxy spec; enrollment abuse controls; zod validation. |
| **v4** | **2026-04-20** | **Post-third-adversarial-review amendments (14 refinements):** (1) Canonical message pinned to RFC 8785 JCS via `json-canonicalize` with test vectors. (2) `idempotency_key` included in signed canonical message. (3) Reservation token (`reservation_token`) on every idempotency reservation; terminal UpdateItems conditioned on token match to prevent clobber. (4) Two-phase idempotency commit with `upstream_initiated` flag; `idempotency_state_unknown` error on post-side-effect failure. (5) Polling backoff with jitter (500ms, 1s, 2s, 4s, ..., ±20% jitter). (6) Authenticated `GET /proxy/version-check` endpoint replaces public GitHub API version check. (7) Electron first-run enrollment auto-launches via bundled main-process window (not separate CLI); CLI relegated to recovery-only. (8) CI Electron build gate specified as GitHub Actions `inputs.include_electron` boolean. (9) Enrollment: per-IP raised to 20/15min; sliding window with explicit 5-min bucket algorithm; `TransactWriteItems` for atomic lockout; admin override CLI specified. (10) Allowlist `returns` metadata per op; proxy caches scalar identifier for create operations. (11) Two-step enrollment (`/proxy/enroll` → `/proxy/enroll/confirm`) prevents orphaned device records on client crash. (12) `enroll_device` takes public_key as explicit arg. (13) Appendix C populated with enumerated path allowlists from current service modules. (14) New error codes: `idempotency_state_unknown`, `enrollment_confirmation_expired`, `enrollment_confirmation_token_invalid`. |

---

## Executive Summary

NocLense is migrating from Electron + Vercel serverless proxies to a standalone Tauri 2.x desktop application backed by a dedicated integration proxy on AWS.

**Three independent failure domains replace today's single-point-of-failure:**

1. **Tauri client** — zero integration secrets in the distributed binary. Per-device Ed25519 keypair generated at first-run enrollment; private key stored in OS keyring; public key sent to proxy at enrollment. Revocable per seat via DynamoDB status flip.
2. **AWS-hosted integration proxy** — holds the 5 org admin credentials in AWS Secrets Manager; Lambda + API Gateway + DynamoDB for device public-key registry, nonces, and idempotency state machine with reservation tokens. Path-allowlisted per integration (see Appendix C).
3. **GitHub Enterprise Releases** — hosts signed `.msi` (Tauri) and `.exe` (Electron-via-proxy) binaries + Ed25519-signed Tauri update manifest. Version discovery via authenticated proxy endpoint.

**Timeline:** ~8–10 weeks engineering after approvals land. Procurement/approval work can run in parallel (~2–4 weeks).

**Budget:** ~$984/yr recurring; $0 one-time capex.

**Risk profile:** Low. Third adversarial review round closed at engineering-detail level; architecture unchanged since v2.

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
11. [Appendix C — Path allowlists (enumerated)](#11-appendix-c--path-allowlists-enumerated)

---

## 1. Context and motivation

(Unchanged from v3.)

### 1.1 Current state

NocLense is an internal NOC operational tool for the SaaS Operations team on the Axon APEX (formerly Carbyne APEX) NG911 platform. Core workflows: Zendesk ticket triage, Jira R&D escalations, Datadog log analysis, Confluence runbook lookup, Unleashed AI-assisted root-cause investigation.

Current deployment targets Electron (integration tokens baked in) + Vercel web (serverless proxies). Branching across 11 files; ~430 LOC Electron native code.

### 1.2 Triggering incidents

**2026-04-18: Vercel incident.** 36-hour outage. Surfaced credential-baking and single-failure-domain concerns.

**2024-09: Axon Enterprise acquisition of Carbyne.** Naming and legal entity shift.

### 1.3 Design goals (priority order)

1. Remove org integration credentials from the distributed client binary.
2. Proxy server holds no client-side secret material.
3. Eliminate single-point-of-failure coupling.
4. Enable per-seat revocation without fleet-wide coordination.
5. Write idempotency under concurrency must be atomic and correct.
6. Production-grade standalone desktop experience.
7. Preserve the UI polish redesign work.
8. Match Axon Enterprise naming conventions.

---

## 2. Architecture overview (end-state)

### 2.1 Three independent components

```
┌─────────────────────────────────────────────────────┐
│  NocLense Tauri app (installed on NOC seats)        │
│  - WebView2 on Windows                              │
│  - React 19 + Vite frontend                         │
│  - Rust main process (~750 LOC target)              │
│  - Zero integration secrets in binary               │
│  - Per-device Ed25519 keypair (private in keyring)  │
└─────────────────────────────────────────────────────┘
          │                              │
          │ Ed25519-signed HTTPS         │ Auth update poll
          ▼                              ▼
┌─────────────────────────────────────┐   ┌──────────────────────────┐
│  AWS integration proxy              │   │  GitHub Enterprise       │
│  Lambda + API Gateway               │   │  Releases                │
│                                     │   │  - Signed .msi (Tauri)   │
│  DynamoDB:                          │   │  - Signed .exe (Electron)│
│    - Device registry (pubkeys)      │   │  - latest.json manifest  │
│    - Nonce store (replay)           │   │    (Ed25519-signed)      │
│    - Idempotency state machine      │   └──────────────────────────┘
│      (with reservation_token)       │
│    - Enrollment codes               │
│    - Rate-limit buckets             │
│                                     │
│  Endpoints:                         │
│    - /proxy/enroll (two-step)       │
│    - /proxy/enroll/confirm          │
│    - /proxy/version-check (auth)    │
│    - /proxy/unleash                 │
│    - /proxy/datadog                 │
│    - /proxy/zendesk (allowlist C.1) │
│    - /proxy/confluence (allowl C.2) │
│    - /proxy/jira (allowlist C.3)    │
└─────────────────────────────────────┘
          │
          │ (credentials injected from AWS Secrets Manager)
          ▼
┌───────────────────────────────────────────────────┐
│  Unleashed AI / Datadog / Zendesk / Confluence /  │
│  Jira (Axon-held org accounts)                    │
└───────────────────────────────────────────────────┘
```

### 2.2 Client: Tauri 2.x standalone app

- **Runtime:** System WebView2 on Windows; WKWebView on macOS if extended.
- **Native process:** Rust, capability-scoped. ~750 LOC in `src-tauri/src/main.rs`.
- **Filesystem access:** scoped to `$APPDATA/NocLense/**`, `$DOCUMENTS/DailyNOC/**`, user-selected drops.
- **Cryptographic identity:** Per-device Ed25519 keypair. Private key in OS keyring via `tauri-plugin-keyring`. Public key at proxy, plaintext, non-sensitive.
- **Authentication:** Every request signed with private key; proxy verifies with stored public key. Zero server-side secret material.
- **Auto-update:** Tauri built-in updater with Ed25519 signature verification (separate keypair from device-identity keys).
- **Packaging:** Authenticode-signed `.msi`. Bundle identifier `com.axon.noclense`.

### 2.3 Proxy: hybrid service on AWS

- **Platform:** AWS Lambda + API Gateway + DynamoDB.
- **Endpoints (8):** `POST /proxy/enroll`, `POST /proxy/enroll/confirm`, `GET /proxy/version-check`, `POST /proxy/unleash`, `POST /proxy/datadog`, `POST /proxy/zendesk`, `POST /proxy/confluence`, `POST /proxy/jira`.
- **Credentials:** Org admin tokens in AWS Secrets Manager.
- **Authentication:** Ed25519 per-device; `X-Device-Id` header; proxy verifies with stored public key.
- **Replay prevention:** DynamoDB `noclense-proxy-nonces` with conditional put.
- **Idempotency:** DynamoDB state machine with reservation tokens; two-phase commit with `upstream_initiated` flag; `idempotency_state_unknown` on post-side-effect failure.
- **Path allowlists:** Per-integration named operations with zod payload validation. See Appendix C for enumerated list.
- **Payload validation:** zod schemas on all endpoints.
- **Observability:** Structured JSON logs to Axon Datadog.

### 2.4 Update manifest server: GitHub Enterprise Releases + authenticated version-check

- **Artifact hosting:** Release artifacts on GitHub Enterprise Releases (`.msi`, `.exe` during pilot, `latest.json`).
- **Version discovery:** Authenticated `GET /proxy/version-check` endpoint returns `{ latest_version, download_url, release_notes_excerpt }`. Client uses existing per-device auth. No assumption about public repo metadata.
- **Signatures:** Authenticode on `.msi` and `.exe`; Ed25519 on `latest.json` (verified by Tauri updater before download).
- **Signing keys:** Ed25519 updater private key in GitHub Actions secret; Authenticode cert in CI.

### 2.5 Data flow and failure domains

**Four independent failure domains:** (unchanged from v3)

| Failure | Impact |
|---|---|
| Proxy Lambda down | All integrations fail; app still runs; user sees per-surface "unavailable" messages |
| DynamoDB unavailable | Proxy fails-safe (401); no degraded bypass |
| Update server down | Existing installs keep working; no new updates |
| Vendor API down | That integration fails; others still work |

### 2.6 Token rotation and per-device revocation

(Unchanged from v3.)

Vendor admin tokens: rotated at Phase 1 close. Per-device credentials: revocable individually via DynamoDB `status = revoked` flip.

### 2.7 Naming conventions (Axon)

| Artifact | Value |
|---|---|
| Bundle identifier | `com.axon.noclense` |
| Cert legal entity | Axon Enterprise, Inc. |
| Proxy subdomain | `noclense-proxy.axon.com` (IT DNS confirmation pending) |
| GitHub Enterprise org | existing Axon Enterprise org |

---

## 3. Sequencing plan

### 3.1 Ordering rationale

(Unchanged from v3.) Proxy before Tauri; sequential execution; out-of-production window removes calendar pressure.

### 3.2 Phase 0 — Foundation prep (~3 days)

- [ ] Provision EV Authenticode cert (SSL.com recommended).
- [ ] Generate Ed25519 updater keypair. Private → Actions secret; public → `tauri.conf.json`.
- [ ] Confirm GitHub Enterprise Releases artifact path + Actions secret scope.
- [ ] Provision AWS: Lambda, API Gateway, Secrets Manager, CloudWatch, **five** DynamoDB tables (`noclense-proxy-devices`, `noclense-proxy-nonces`, `noclense-proxy-idempotency`, `noclense-proxy-enrollments`, `noclense-proxy-ratelimits`), IAM role.
- [ ] Allocate subdomain `noclense-proxy.axon.com`.
- [ ] Create CLI tooling: enrollment-code issuance, device revocation, rate-limit reset override, admin override.

### 3.3 Phase 1 — Proxy service + Electron-via-proxy productionization (~3 weeks)

#### 3.3.1 Phase 1a — Proxy service (~2 weeks, fullstack-developer)

- [ ] Node/TypeScript service (Node 20+).
- [ ] Eight endpoints as specified in §4.
- [ ] Ed25519 signature middleware using `@noble/ed25519`.
- [ ] Canonical message construction per §4.1.2 using `json-canonicalize` (RFC 8785).
- [ ] DynamoDB nonce store: conditional put with TTL.
- [ ] DynamoDB idempotency state machine with reservation tokens (§4.1.4); two-phase commit with `upstream_initiated` flag.
- [ ] Polling protocol with exponential backoff + jitter (§4.1.4).
- [ ] Path allowlists (Appendix C) with zod schema validation.
- [ ] `returns` metadata per op: proxy extracts scalar identifier from upstream response and caches in idempotency store.
- [ ] Two-step enrollment: `/proxy/enroll` creates `status: pending`; `/proxy/enroll/confirm` promotes to `active`.
- [ ] Enrollment abuse controls: DynamoDB sliding-window rate limiter (5-minute bucket scheme, §4.2.1); 3-strike atomic lockout via `TransactWriteItems`.
- [ ] Admin override endpoints: reset rate limit per IP, reset code lockout, force device revocation.
- [ ] Version-check endpoint reading latest release tag from GitHub API with Axon Enterprise bot token (or cached in Secrets Manager with periodic refresh).
- [ ] Structured JSON logging with `device_id`; Datadog alerts (§4.5).
- [ ] Secrets in AWS Secrets Manager.
- [ ] Health check endpoint.

#### 3.3.2 Phase 1b — Electron-via-proxy productionization (~1 week)

- [ ] Add `keytar` to Electron dependencies; expose `keyring:get/set/delete` IPC from main process to renderer-guarded preload.
- [ ] Electron main process startup: check keyring for `noclense.device_id` + `noclense.device_privkey`. **If missing, spawn bundled enrollment BrowserWindow** (not a separate CLI). The window is a minimal `enroll.html` with enrollment-code input, hostname auto-detected, keypair generation, call to `/proxy/enroll` + `/proxy/enroll/confirm`, keyring write. Same UX shape as Tauri first-run.
- [ ] Recovery CLI (`electron-enroll-recover.js`): bundled but **not auto-run**. User invokes manually via Start menu shortcut `NocLense Recovery` to force re-enrollment after revocation. Clears keyring + relaunches main process.
- [ ] Ed25519 signing path: private key reads happen on main process only via `keytar`; renderer requests signature via IPC; only signature crosses the boundary, never the private key.
- [ ] Replace `VITE_*` vendor tokens with empty strings in the Electron build. Any legacy direct-call path throws "no credential" error loudly.
- [ ] Update the 6 service wrappers: replace direct API calls with proxy-signed calls via main-process IPC.
- [ ] NSIS build step: sign `.exe` with same Authenticode cert as Tauri `.msi`.
- [ ] Version-check: call `/proxy/version-check` (authenticated) on startup. If newer available, modal with download link. No in-place auto-update for Electron.
- [ ] CI gating: GitHub Actions workflow has `inputs.include_electron: boolean` (default `false`). Electron build job `if: ${{ inputs.include_electron }}`. Post-Phase-3, delete the entire Electron build job block.
- [ ] Pilot distribution: CI publishes `.exe` to same GitHub Release as `.msi` when `include_electron` input is true.

**Gate before Phase 2:** proxy deployed with abuse controls tested; DynamoDB state machine verified under synthetic concurrency (see §6.1 verification); Electron-via-proxy functional end-to-end with bundled enrollment window; 24 hours uneventful operation.

**Token rotation event at end of Phase 1** — see §6.2.

### 3.4 Phase 2 — Tauri shell migration (~3–5 weeks)

Substages (unchanged from v3; 2a-2i):

- **2a.** Scaffold.
- **2b.** electronAPI compat shim + 7 custom commands + `ed25519-dalek` signing.
- **2c.** Enrollment flow UI (Tauri first-run).
- **2d.** Secret storage via keyring.
- **2e.** Request signing path.
- **2f.** Error-reporting webhook.
- **2g.** Auto-updater wiring.
- **2h.** CI/CD.
- **2i.** Dual-run validation (1–2 weeks calendar).

**Gate before Phase 3:** per v3 §3.4 gate.

### 3.5 Phase 3 — Cutover + Electron retirement

See §6.6. Both Electron variants retired at cutover after 14-day pilot GO-gate clears.

### 3.6 Parallel coordination with UI redesign

(Unchanged from v3.)

### 3.7 Agent ownership

(Unchanged from v3.)

---

## 4. Proxy service design

### 4.1 Request/response envelope and authentication

#### 4.1.1 Request envelope

```ts
interface ProxyRequest<TPayload> {
  timestamp: string;              // ISO-8601; rejected if >60s skew
  nonce: string;                  // UUIDv4 or 128-bit random; rejected if seen
  idempotency_key?: string;       // Required on POST/PUT/DELETE; UUIDv4
  payload: TPayload;              // Validated by zod schema per endpoint
}
```

**Headers:**
- `X-Device-Id: <uuid>` — from keyring
- `X-NocLense-Signature: <base64>` — Ed25519 signature of canonical message

#### 4.1.2 Canonical message construction (pinned contract)

The canonical message is:

```
canonical = timestamp + "." + nonce + "." + (idempotency_key ?? "") + "." + jcs(payload)
```

Where `jcs(payload)` is RFC 8785 JSON Canonicalization Scheme applied to the payload.

**Pinned libraries:**
- Rust (Tauri): `serde_jcs` crate
- Node/TypeScript (proxy + Electron): `json-canonicalize` npm package (v1.0.x)

**Sign:** `ed25519_sign(device_privkey, utf8_bytes(canonical))` → base64

**Verify:** `ed25519_verify(device_pubkey, utf8_bytes(canonical), signature)`

**Idempotency key sentinel:** When `idempotency_key` is absent (read-only request), use the empty string `""` in the canonical message. Client and proxy both agree on this sentinel.

**Test vectors (both sides MUST pass before integration):**

```
Vector 1 — Simple read
  timestamp: "2026-04-20T12:00:00Z"
  nonce: "00000000-0000-4000-8000-000000000001"
  idempotency_key: undefined (→ "")
  payload: { "method": "test" }
  canonical: 2026-04-20T12:00:00Z.00000000-0000-4000-8000-000000000001..{"method":"test"}

Vector 2 — Write with idempotency
  timestamp: "2026-04-20T12:00:01Z"
  nonce: "00000000-0000-4000-8000-000000000002"
  idempotency_key: "00000000-0000-4000-8000-000000000003"
  payload: { "op": "update-ticket", "params": { "ticketId": "42389" } }
  canonical: 2026-04-20T12:00:01Z.00000000-0000-4000-8000-000000000002.00000000-0000-4000-8000-000000000003.{"op":"update-ticket","params":{"ticketId":"42389"}}

Vector 3 — Key ordering
  payload: { "b": 2, "a": 1, "nested": { "z": 9, "y": 8 } }
  jcs(payload): {"a":1,"b":2,"nested":{"y":8,"z":9}}

Vector 4 — Number representation
  payload: { "count": 1.0 }
  jcs(payload): {"count":1}

Vector 5 — Unicode
  payload: { "msg": "héllo — 世界" }
  jcs(payload): {"msg":"héllo — 世界"}
  (no escape sequences; raw UTF-8 bytes)
```

Test vectors MUST be committed as fixtures in both the proxy repo and `src-tauri/tests/`. CI runs cross-verification (proxy signs + Tauri verifies, and vice versa) on every PR.

#### 4.1.3 Authentication flow (proxy side)

1. Extract `X-Device-Id`, `X-NocLense-Signature`. Reject 401 if missing.
2. Lookup device in `noclense-proxy-devices`:
   - Not found → 401 `device_not_enrolled`
   - `status == 'revoked'` → 401 `device_revoked`
   - `status == 'pending'` → 401 `device_not_confirmed`
   - `status != 'active'` → 401 `device_not_enrolled`
3. Reconstruct canonical message from request.
4. Verify Ed25519 signature using stored public key. If fails → 401 `signature_invalid`.
5. Check timestamp skew (`|now - timestamp| < 60s`). Exceeded → 401 `hmac_expired`.
6. Nonce conditional put on `noclense-proxy-nonces` (TTL = `timestamp + 70s`). Fails → 401 `replay_detected`.
7. Validate payload against endpoint zod schema. Fails → 400 `payload_invalid`.
8. If mutating: enter idempotency state machine (§4.1.4).
9. Forward to upstream; return response.

#### 4.1.4 Idempotency state machine (mutating requests only)

**DynamoDB `noclense-proxy-idempotency` table:**

- Partition key: `idempotency_key` (string)
- Attributes:
  - `request_hash` (string): SHA-256 of canonical payload (hex)
  - `reservation_token` (string): UUIDv4 generated at reservation
  - `state` (string): `IN_PROGRESS` | `COMPLETED` | `FAILED`
  - `upstream_initiated` (boolean): true once upstream call has been dispatched
  - `status_code` (number, terminal states only)
  - `response_hash` (string, COMPLETED only): SHA-256 of upstream response body (hex)
  - `cached_return_value` (string, COMPLETED only): extracted per-op identifier (see Appendix C `returns` metadata)
  - `started_at` (string, ISO-8601)
  - `completed_at` (string, ISO-8601, terminal states)
  - `reservation_expires_at` (number, epoch seconds): `started_at + 60s`
  - `expires_at` (number, epoch seconds): TTL — `started_at + 86400`

**State transition algorithm (proxy per mutating request):**

1. Compute `request_hash = SHA256(canonical_payload)`.
2. Generate fresh `my_reservation_token = UUIDv4()`.
3. Attempt `PutItem`:
   ```
   Item: { idempotency_key, request_hash, reservation_token: my_reservation_token,
           state: 'IN_PROGRESS', upstream_initiated: false,
           started_at: now, reservation_expires_at: now + 60,
           expires_at: now + 86400 }
   ConditionExpression: attribute_not_exists(idempotency_key)
     OR (state = 'IN_PROGRESS'
         AND reservation_expires_at < :now
         AND request_hash = :my_request_hash)
   ExpressionAttributeValues: { :now: <epoch>, :my_request_hash: <hex> }
   ```
   The `request_hash` match in the condition prevents a same-key-different-payload from stealing an expired reservation.

4. **If put fails with different `request_hash`:** another payload already occupies this key. Fetch item; return 409 `idempotency_conflict`.

5. **If put fails with same `request_hash` (existing completed or in-progress):** fetch item.
   - `state == 'COMPLETED'`: return `{ ok: true, result: { status_code, response_hash, cached_return_value (if any), note: 'cached' }, cached: true }`.
   - `state == 'FAILED'`: return cached error `{ ok: false, error: { code, status_code }, cached: true }`.
   - `state == 'IN_PROGRESS'` (not expired): enter polling protocol below.

6. **If put succeeds:** we hold reservation with `my_reservation_token`.

7. Pre-dispatch UpdateItem to mark upstream initiated:
   ```
   UpdateItem:
     Update: SET upstream_initiated = :true
     ConditionExpression: reservation_token = :my_token AND state = 'IN_PROGRESS'
   ```
   If this fails → another Lambda took over; abort without calling upstream.

8. Dispatch upstream call.

9. On upstream success:
   ```
   UpdateItem:
     Update: SET state = 'COMPLETED', status_code = :sc, response_hash = :rh,
                 cached_return_value = :crv (if op has 'returns' metadata),
                 completed_at = :now
     ConditionExpression: reservation_token = :my_token AND state = 'IN_PROGRESS'
   ```
   - Condition match → return `{ ok: true, result: upstream_response, cached: false }`.
   - Condition fail → another Lambda took over and completed. Return `{ ok: false, error: { code: 'idempotency_state_unknown', message: 'concurrent completion' } }`. **Client must NOT retry**; the upstream mutation happened but ownership was lost before state update landed. Application must query upstream to learn true state.

10. On upstream failure:
    ```
    UpdateItem:
      Update: SET state = 'FAILED', status_code = :sc, completed_at = :now
      ConditionExpression: reservation_token = :my_token AND state = 'IN_PROGRESS'
    ```
    - Condition match → return error to client.
    - Condition fail → another Lambda took over. Return `idempotency_state_unknown` (same reasoning).

**Polling protocol (step 5 `IN_PROGRESS` case):**

Exponential backoff with jitter. Wait times: 500ms, 1000ms, 2000ms, 4000ms, 4000ms, 4000ms, ... up to cumulative 30s. Each wait multiplied by `1 + uniform(-0.2, +0.2)` for jitter.

After each wait: fetch item.
- Terminal state → return per step 5 rules.
- Still `IN_PROGRESS` at cumulative 30s → return 409 `idempotency_in_progress`.

**Why this is safe:**

- **Race on reservation:** Two Lambdas concurrent: one succeeds PutItem, one fails. Failing one polls.
- **Clobber prevention:** Terminal UpdateItems condition on `reservation_token = my_token`. An old Lambda whose reservation expired cannot overwrite a new Lambda's completion.
- **Post-side-effect failure:** If UpdateItem to COMPLETED fails (ownership lost), client receives `idempotency_state_unknown` — fails safe, app must verify upstream state before retrying.
- **Same-key-different-payload during expired-IN_PROGRESS:** PutItem's ConditionExpression includes `request_hash = :my_request_hash`, rejecting the takeover; result is 409 `idempotency_conflict`.

**Trade-off accepted:** A post-side-effect failure (step 9 condition fails) leaves the upstream mutation performed but client uninformed of what happened. This is strictly safer than duplicate execution. Application code handling `idempotency_state_unknown` should implement a reconciliation query (e.g., "is there a comment on Zendesk ticket X with body matching my payload?") before retrying.

#### 4.1.5 Response envelope

```ts
type ProxyResponse<TResult> =
  | { ok: true; result: TResult; cached?: boolean }
  | { ok: false; error: { code: string; message: string; upstreamStatus?: number } };
```

### 4.2 Endpoint shapes

#### 4.2.1 Enrollment (two-step, no device signature — bootstrap)

**Step 1: `POST /proxy/enroll`**

Request: `{ device_id: string, device_public_key: string (base64 Ed25519 pubkey, 32 bytes decoded), enrollment_code: string, hostname: string }`

Response: `{ ok: true, confirmation_token: string, confirmation_expires_at: ISO8601 }` or error.

On success: writes device record `{ device_id, device_public_key, status: 'pending', confirmation_token, confirmation_expires_at: now + 10min, enrolled_at, hostname }` and flips enrollment code to `used`.

**Step 2: `POST /proxy/enroll/confirm`**

Request: `{ device_id: string, confirmation_token: string }` (no signature required for this call; the confirmation_token + device_id pair serves as proof the client holds the keypair written in step 1)

Response: `{ ok: true, enrolled_at: ISO8601 }` or error.

On success: flips device record `status: pending` → `status: active`; clears `confirmation_token`.

**Why two-step:** if step 1 succeeds (proxy writes record, code is consumed) but the client crashes before writing `device_id` to keyring, the device record stays in `pending` state indefinitely. It cannot sign any authenticated requests. It expires after `confirmation_expires_at` + 60min grace and is garbage-collected. Client can re-run the full enrollment flow with a new code. No orphaned `active` records.

**Error codes for enrollment:**
- `enrollment_code_invalid` (400) — not found, malformed
- `enrollment_code_expired` (400) — past 15min TTL
- `enrollment_code_used` (400) — already consumed
- `enrollment_code_locked` (400) — 3-strike lockout
- `enrollment_hostname_mismatch` (400) — bound_hostname didn't match
- `enrollment_rate_limited` (429) — per-IP or global limit
- `device_already_enrolled` (409) — device_id collision
- `public_key_malformed` (400) — not 32-byte Ed25519
- `enrollment_confirmation_token_invalid` (400) — wrong token or device mismatch
- `enrollment_confirmation_expired` (400) — past 10-min confirmation window

**Abuse controls (v4 revised):**

*Code entropy:* 24 base32 characters (120 bits, crypto RNG).

*Per-IP rate limit:* 20 attempts per 15 minutes. Algorithm:

```
Table: noclense-proxy-ratelimits
Partition key: <ip>#<5min-bucket-id>
Attributes: { count, expires_at: bucket-start + 15min }

On each enrollment attempt from <ip>:
  bucket_id = floor(now / 300)
  UpdateItem on partition key = <ip>#<bucket_id>:
    UpdateExpression: ADD count :one SET expires_at = :exp
    ExpressionAttributeValues: { :one: 1, :exp: bucket-start + 900 }

To check total for sliding window:
  Query partition keys for <ip>#<bucket_id>, <ip>#<bucket_id - 1>, <ip>#<bucket_id - 2>
  Sum counts.
  If > 20, return enrollment_rate_limited.
```

The bucket scheme is well-known and drift-free because each bucket has a fixed TTL independent of other buckets.

*Global rate limit:* 50 attempts per hour. Same algorithm with partition key `GLOBAL#<hour>`.

*3-strike lockout:* atomic via `TransactWriteItems`:

```
TransactWriteItems:
  1. UpdateItem on noclense-proxy-enrollments item = <code>:
       ADD failed_attempts :one
       Return ALL_NEW to read post-update failed_attempts
  2. (Conditional) UpdateItem on same item:
       SET status = 'locked'
       ConditionExpression: failed_attempts >= :three
```

Both operations atomic; no race where 4 attempts slip past the lockout threshold.

*Admin override:* CLI commands `noclense-admin reset-rate-limit <ip>` and `noclense-admin unlock-code <code>` directly manipulate DynamoDB, bypassing rate limits for recovery.

*Hostname binding:* optional at issuance; if set, `hostname` submitted at `/proxy/enroll` must match case-insensitive.

*Datadog alert:* `enrollment_code_invalid` rate >5/min OR `enrollment_rate_limited` rate >1/min triggers abuse alert.

#### 4.2.2 Version-check endpoint

**`GET /proxy/version-check`** (authenticated, Ed25519-signed like other endpoints)

Request: standard authenticated envelope with empty payload `{}`.

Response: `{ latest_version: "1.5.0", download_url: "https://github.com/...msi", release_notes_excerpt: "..." }`.

Proxy implementation: reads latest release tag from GitHub Enterprise via cached Secrets-Manager-stored bot token (scoped to `repo:read`). Refreshes cache every 5 minutes. No assumption about repo visibility.

#### 4.2.3 Authenticated integration endpoints

| Endpoint | Payload | Forwards to | Credentials injected |
|---|---|---|---|
| `POST /proxy/unleash` | zod-validated (see Appendix C.4) | `https://api.unleash.so/chats` | `Authorization: Bearer`, `X-Assistant-Id` |
| `POST /proxy/datadog` | zod-validated (see Appendix C.5) | `https://api.${DATADOG_SITE}/api/v2/logs/events/search` or similar per method | `DD-API-KEY`, `DD-APPLICATION-KEY` |
| `POST /proxy/zendesk` | `{ op: string, params: ... }` — see Appendix C.1 | per-op path | Zendesk Basic auth |
| `POST /proxy/confluence` | `{ op: string, params: ... }` — see Appendix C.2 | per-op path | Atlassian Basic auth |
| `POST /proxy/jira` | `{ op: string, params: ... }` — see Appendix C.3 | per-op path | Atlassian Basic auth |

Unknown `op` → 403 `path_not_allowed`.

### 4.3 Error handling taxonomy

| `error.code` | HTTP | Meaning |
|---|---|---|
| `signature_invalid` | 401 | Ed25519 verification failed |
| `hmac_expired` | 401 | Timestamp outside skew window (name retained for compat) |
| `device_revoked` | 401 | Device status is `revoked` |
| `device_not_confirmed` | 401 | Device status is `pending`; confirmation step not completed |
| `device_not_enrolled` | 401 | Device ID unknown |
| `replay_detected` | 401 | Nonce already seen |
| `enrollment_code_invalid` | 400 | Code not found or malformed |
| `enrollment_code_expired` | 400 | Past 15min TTL |
| `enrollment_code_used` | 400 | Already consumed |
| `enrollment_code_locked` | 400 | 3-strike lockout |
| `enrollment_hostname_mismatch` | 400 | Bound hostname didn't match |
| `enrollment_rate_limited` | 429 | Per-IP or global exceeded |
| `enrollment_confirmation_token_invalid` | 400 | Wrong confirmation token |
| `enrollment_confirmation_expired` | 400 | Past 10-min confirmation window |
| `device_already_enrolled` | 409 | Device ID collision |
| `public_key_malformed` | 400 | Invalid Ed25519 pubkey |
| `idempotency_conflict` | 409 | Same key, different payload |
| `idempotency_in_progress` | 409 | Another request with this key in flight |
| `idempotency_state_unknown` | 500 | Upstream called but terminal state not written; client must verify upstream |
| `payload_invalid` | 400 | Failed zod validation |
| `path_not_allowed` | 403 | `op` not in allowlist |
| `rate_limited` | 429 | Per-device or per-endpoint exhausted |
| `upstream_4xx` | 502 | Upstream 4xx |
| `upstream_5xx` | 502 | Upstream 5xx |
| `upstream_timeout` | 504 | Upstream >30s |
| `internal_error` | 500 | Proxy bug |

### 4.4 Rate limiting

(Per-device and per-endpoint limits unchanged from v3. Enrollment-specific limits in §4.2.1.)

### 4.5 Observability

(Unchanged structure from v3; new log fields include `reservation_token` on idempotent-write logs, and `state_transition` for state-machine transitions.)

Datadog monitors added in v4:
- `idempotency_state_unknown` rate > 0 over any 5-min window → ops investigation (real bug or real concurrency)
- `device_not_confirmed` rate > 5/hour → stuck enrollment flow investigation

### 4.6 Secret rotation flow

(Unchanged from v3.)

### 4.7 Non-goals for proxy v1

(Unchanged from v3.)

---

## 5. Tauri shell design

### 5.1 Tauri configuration (`src-tauri/tauri.conf.json`)

(Config structure unchanged from v3. CSP `connect-src` now includes `https://noclense-proxy.axon.com` only — removed `api.github.com` since version-check moves to proxy.)

```json
"security": {
  "csp": "default-src 'self'; connect-src 'self' https://noclense-proxy.axon.com; style-src 'self' 'unsafe-inline'; script-src 'self'"
}
```

### 5.2 Capability system

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

### 5.3 `invoke()` surface — seven custom commands

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `get_crash_reports` | `{ limit: u32 }` | `Vec<CrashReport>` | Crash reports |
| `open_crash_log_location` | `()` | `()` | Open log folder |
| `clear_crash_reports` | `()` | `u32` | Delete all |
| `report_error` | `{ payload }` | `()` | Error webhook |
| `generate_device_keypair` | `()` | `{ public_key: String }` (base64) | Generate Ed25519 keypair; store private in keyring; return public to TS |
| `enroll_device` | `{ enrollment_code: String, hostname: String, public_key: String }` | `{ device_id: String, confirmation_token: String, confirmation_expires_at: String }` | POST `/proxy/enroll`; client later calls `/proxy/enroll/confirm` from TS directly |
| `sign_request` | `{ canonical_message: Vec<u8> }` | `{ signature: String }` (base64) | Read private key from keyring; sign canonical bytes; return base64 |

**Note on enrollment/confirm split:** `enroll_device` does only step 1 of the two-step enrollment. Step 2 (`/proxy/enroll/confirm`) is a plain HTTP POST from TypeScript code once `device_id` is successfully written to keyring. This makes keyring-write the committing step: if it fails, confirm never happens, device record auto-expires.

### 5.4 Secret handling

(Storage layout and enrollment flow refined from v3.)

**Tauri first-run enrollment flow:**

1. Tauri checks keyring for `noclense.device_id`. Not present → enrollment UI.
2. UI calls `invoke('generate_device_keypair')`. Rust generates Ed25519 keypair, stores private key in keyring, returns public key (base64) to TS.
3. TS generates `device_id = UUIDv4()`.
4. TS calls `invoke('enroll_device', { enrollment_code, hostname, public_key })`. Rust POSTs to `/proxy/enroll`. Response: `{ device_id_echoed, confirmation_token, ... }`. Returns to TS.
5. **TS writes `device_id` to keyring via `invoke('keyring:set', ...)`**. If write fails, abort; the pending device record expires.
6. **TS POSTs to `/proxy/enroll/confirm`** with `{ device_id, confirmation_token }`.
7. Confirm response `{ ok: true, enrolled_at }` → UI transitions to normal app.
8. If confirm fails: keyring has `device_id` written but proxy doesn't recognize it yet. Retry once. If second retry fails, instruct user to re-enroll (clear keyring, fresh code).

**Per-request signing flow:** unchanged from v3.

### 5.5 Auto-updater

(Unchanged from v3.)

### 5.6 Window / WebView configuration

(Unchanged from v3.)

### 5.7 Build and CI

```yaml
# GitHub Actions workflow
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      include_electron:
        description: 'Build Electron .exe alongside Tauri .msi (pilot window only)'
        type: boolean
        default: false

jobs:
  build-tauri:
    runs-on: windows-latest
    steps:
      # ... standard tauri build steps ...

  build-electron:
    runs-on: windows-latest
    if: ${{ inputs.include_electron == true }}
    steps:
      # ... electron:build steps, signs with same cert ...

  publish-release:
    needs: [build-tauri, build-electron]
    # build-electron is conditionally skipped, not required
    steps:
      # gh release create with whichever artifacts exist
```

Post-Phase-3: delete `build-electron` job entirely; remove `inputs.include_electron`.

### 5.8 Migration shim

(Interface unchanged from v3. Implementation for Electron uses keytar via main-process IPC; Tauri uses plugin-keyring directly.)

### 5.9 What's intentionally not in the Rust layer

(Unchanged from v3.)

---

## 6. Rollout and pilot plan

### 6.1 Pre-rollout prep (Day -14 to Day 0)

(Checklist extended from v3 with the following additions:)

- [ ] **Idempotency state machine verification under synthetic concurrency:** fire 10 parallel identical mutating requests; verify exactly one upstream call fires; verify 9 receive cached result.
- [ ] **Idempotency state machine verification under reservation expiry:** simulate Lambda death after reservation + upstream call; verify second Lambda receives `idempotency_state_unknown`, NOT a successful duplicate.
- [ ] **Idempotency state machine verification under same-key-different-payload:** verify 409 `idempotency_conflict` returned.
- [ ] **Canonical message test vectors passed cross-platform:** Rust signs, Node verifies; Node signs, Rust verifies. All 5 vectors.
- [ ] **Enrollment two-step crash recovery:** simulate client crash between `/proxy/enroll` and keyring-write; verify device record expires and re-enrollment with fresh code succeeds.
- [ ] **Enrollment rate-limit accuracy:** fire 25 attempts from one IP across 10 minutes; verify exactly 5 after threshold are rejected.
- [ ] **Enrollment lockout atomicity:** fire 10 concurrent invalid submissions against same code; verify lockout fires after exactly 3 and subsequent attempts all rejected.
- [ ] **Admin override CLI tested:** reset-rate-limit and unlock-code both work and write Datadog audit logs.
- [ ] **Version-check endpoint:** returns latest release info; cache refreshes correctly; GitHub API failure returns last-known-good.

(Other prep items from v3 §6.1 unchanged.)

### 6.2 Token rotation choreography

(Unchanged from v3.)

### 6.3 Dual-build transition

(Unchanged from v3.)

### 6.4 Internal pilot program

(Unchanged from v3; metrics unchanged.)

### 6.5 GO/NO-GO gate

(Unchanged from v3; extended with idempotency state machine verification and enrollment confirmation flow verification.)

### 6.6 Phase 3 — Electron retirement

(Unchanged from v3.)

### 6.7 Rollback plan

(Unchanged from v3.)

### 6.8 Post-cutover operations

(Unchanged from v3.)

### 6.9 Runbooks

(Unchanged from v3; add "Investigating an `idempotency_state_unknown` incident" as runbook #11.)

### 6.10 Documentation updates

(Unchanged from v3.)

---

## 7. Non-goals

(Unchanged from v3.)

---

## 8. References

**Internal:**
- `CLAUDE.md`, `README.md`
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md`
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`

**External:**
- Tauri 2.x docs: https://tauri.app/start/
- Tauri capabilities: https://tauri.app/security/capabilities/
- Tauri updater: https://tauri.app/plugin/updater/
- Tauri keyring: https://tauri.app/plugin/keyring/
- WebView2: https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- DynamoDB TTL: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
- DynamoDB conditional writes: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html#WorkingWithItems.ConditionalUpdate
- DynamoDB TransactWriteItems: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
- Ed25519 (RFC 8032): https://datatracker.ietf.org/doc/html/rfc8032
- JSON Canonicalization (RFC 8785): https://datatracker.ietf.org/doc/html/rfc8785
- `ed25519-dalek` Rust crate: https://docs.rs/ed25519-dalek
- `@noble/ed25519` JS library: https://github.com/paulmillr/noble-ed25519
- `serde_jcs` Rust crate: https://docs.rs/serde_jcs
- `json-canonicalize` npm: https://github.com/cyberphone/json-canonicalization
- `keytar` Electron keyring: https://github.com/atom/node-keytar

---

## 9. Appendix A — Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | EV cert procurement delays | Medium | Medium | Start Phase 0 parallel with code work |
| 2 | WebView2 version drift | Medium | Low | `embedBootstrapper` guarantees install |
| 3 | IndexedDB quota insufficient for 200MB+ logs | Low | Medium | Pre-flight `StorageManager.estimate()`; tested Phase 2i |
| 4 | Lambda cold start latency | Low | Medium | Phase 1a measurement; provisioned concurrency fallback |
| 5 | Auto-updater misfires | Low | High | Signature validation; fail-safe to no-update |
| 6 | Enrollment flow friction | Medium | Low | Clear errors; 15-min TTL; admin override CLI |
| 7 | DynamoDB outage blocks proxy | Low | High | >99.99% SLA; fail-safe; degraded-mode UI |
| 8 | Codex migration introduces regressions | Medium | Medium | Phase 2i soak; commit-by-commit review |
| 9 | fullstack-developer bandwidth | Medium | Medium | Sequential gates; UI redesign isolated |
| 10 | Axon domain/GitHub org transition incomplete | Medium | Low | Verify at Phase 0 |
| 11 | Rollback to Electron needed but codebase drifted | Low | Medium | 90-day frozen NSIS |
| 12 | Path allowlist incomplete | Low | Low | Appendix C enumerated; CI test per op; PR review for additions |
| 13 | Idempotency state machine edge cases | Medium | Medium | Phase 1a synthetic concurrency tests (§6.1); reservation_token prevents clobber; `idempotency_state_unknown` handles post-side-effect failures |
| 14 | Enrollment code interception | Low | Low | Optional hostname binding; 15-min TTL; 3-strike lockout; immediate revocation |
| 15 | `keytar` / `tauri-plugin-keyring` binary incompatibility | Low | Medium | Tested Phase 2i; mature libs |
| 16 | Canonical message contract mismatch between client and proxy | Low | High | RFC 8785 pinned; test vectors enforced in CI |
| 17 | Post-side-effect idempotency state unknown requires app-level reconciliation | Medium | Low | Documented in integration patterns; narrow failure mode; client receives explicit `idempotency_state_unknown` |
| 18 | Two-step enrollment confirm step fails mid-flow | Medium | Low | Pending records auto-expire in 10min; user re-enrolls with new code |

---

## 10. Appendix B — Budget

| Line item | Annual |
|---|---|
| AWS Lambda + API Gateway + Secrets Manager + CloudWatch | $360 |
| AWS DynamoDB (5 tables — devices, nonces, idempotency, enrollments, ratelimits) | $4 |
| EV Authenticode cert (SSL.com) | $500 |
| Dev/staging AWS resources | $120 |
| DNS subdomain | $0 |
| GitHub Enterprise Releases | $0 |
| Datadog observability | $0 |
| **TOTAL** | **~$984/yr** |

Budget ceiling: $1,000/yr.

---

## 11. Appendix C — Path allowlists (enumerated)

Enumerated from current service modules (`src/services/zendeskService.ts`, `src/services/jiraService.ts`, `src/services/confluenceService.ts`, and AI provider code) as of 2026-04-20. Additions require PR review + CI test coverage per new `op`.

### C.1 Zendesk allowlist (`/proxy/zendesk`)

```ts
const ZENDESK_OPS = {
  'get-ticket': {
    method: 'GET',
    path: (p) => `/api/v2/tickets/${encodeURIComponent(p.ticketId)}.json`,
    schema: z.object({ ticketId: z.string().regex(/^\d+$/) }),
    returns: null,
  },
  'get-ticket-comments': {
    method: 'GET',
    path: (p) => `/api/v2/tickets/${encodeURIComponent(p.ticketId)}/comments.json`,
    schema: z.object({ ticketId: z.string().regex(/^\d+$/) }),
    returns: null,
  },
  'get-user': {
    method: 'GET',
    path: (p) => `/api/v2/users/${encodeURIComponent(p.userId)}.json`,
    schema: z.object({ userId: z.union([z.string().regex(/^\d+$/), z.number()]) }),
    returns: null,
  },
  'get-organization': {
    method: 'GET',
    path: (p) => `/api/v2/organizations/${encodeURIComponent(p.orgId)}.json`,
    schema: z.object({ orgId: z.union([z.string().regex(/^\d+$/), z.number()]) }),
    returns: null,
  },
  'search-tickets': {
    method: 'GET',
    path: (p) => `/api/v2/search.json?query=${encodeURIComponent(p.query)}&sort_by=${p.sortBy ?? 'created_at'}&sort_order=${p.sortOrder ?? 'desc'}&per_page=${p.perPage ?? 5}`,
    schema: z.object({
      query: z.string().min(1).max(500),
      sortBy: z.enum(['created_at', 'updated_at', 'priority', 'status']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      perPage: z.number().int().min(1).max(100).optional(),
    }),
    returns: null,
  },
  'create-ticket': {
    method: 'POST',
    path: () => `/api/v2/tickets.json`,
    schema: z.object({
      ticket: z.object({
        subject: z.string().min(1).max(500),
        comment: z.object({ body: z.string().min(1) }),
        requester: z.object({ email: z.string().email() }).optional(),
      }),
    }),
    returns: { field: 'ticket.id', type: 'number' },
  },
  'update-ticket': {
    method: 'PUT',
    path: (p) => `/api/v2/tickets/${encodeURIComponent(p.ticketId)}.json`,
    schema: z.object({
      ticketId: z.string().regex(/^\d+$/),
      ticket: z.object({
        comment: z.object({
          body: z.string().min(1),
          public: z.boolean().optional(),
          uploads: z.array(z.string()).optional(),
        }).optional(),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    }),
    returns: null,
  },
  'upload-attachment': {
    method: 'POST',
    path: (p) => `/api/v2/uploads.json?filename=${encodeURIComponent(p.filename)}`,
    schema: z.object({
      filename: z.string().min(1).max(255),
      binary_body: z.instanceof(Uint8Array),  // forwarded as octet-stream
    }),
    returns: { field: 'upload.token', type: 'string' },
  },
  'download-attachment': {
    method: 'GET',
    path: (p) => p.contentPath,  // validated to match Zendesk subdomain below
    schema: z.object({
      contentPath: z.string().regex(/^\/[\w\-\/\.]+$/),  // path-only, no scheme/host
    }),
    returns: null,
  },
};
```

### C.2 Confluence allowlist (`/proxy/confluence`)

```ts
const CONFLUENCE_OPS = {
  'create-page': {
    method: 'POST',
    path: () => `/wiki/api/v2/pages`,
    schema: z.object({
      spaceId: z.string(),
      parentId: z.string(),
      status: z.literal('current'),
      title: z.string().min(1).max(255),
      body: z.object({
        representation: z.literal('storage'),
        value: z.string(),
      }),
    }),
    returns: { field: 'id', type: 'string' },
  },
  'search-content': {
    method: 'GET',
    path: (p) => `/wiki/rest/api/content/search?cql=${encodeURIComponent(p.cql)}&limit=${p.limit}&expand=${p.expand ?? 'metadata.labels'}`,
    schema: z.object({
      cql: z.string().min(1).max(1000),
      limit: z.number().int().min(1).max(50),
      expand: z.string().optional(),
    }),
    returns: null,
  },
};
```

### C.3 Jira allowlist (`/proxy/jira`)

```ts
const JIRA_OPS = {
  'create-issue': {
    method: 'POST',
    path: () => `/rest/api/3/issue`,
    schema: z.object({
      fields: z.object({
        project: z.object({ key: z.string() }),
        summary: z.string().min(1).max(255),
        issuetype: z.object({ name: z.string() }),
        priority: z.object({ name: z.string() }).optional(),
        description: z.unknown(),  // ADF document; structural validation deferred
      }),
    }),
    returns: { field: 'key', type: 'string' },
  },
};
```

### C.4 Unleashed allowlist (`/proxy/unleash`)

```ts
const UNLEASH_SCHEMA = z.object({
  chatId: z.string().optional(),
  userEmail: z.string().email(),
  message: z.object({
    content: z.string().min(1).max(200_000),  // large context sends
    role: z.literal('user'),
  }),
  assistantId: z.string().optional(),  // overrides env default
  stream: z.boolean().optional(),
});
// Single named op: 'chat' (implicit; single endpoint)
```

Note: Unleashed has one endpoint upstream (`POST /chats`); no `op` switching, but zod schema validation still applies.

### C.5 Datadog allowlist (`/proxy/datadog`)

```ts
const DATADOG_OPS = {
  'search': {
    method: 'POST',
    path: () => `/api/v2/logs/events/search`,
    schema: z.object({
      filter: z.object({
        query: z.string(),
        from: z.string(),  // ISO8601 or 'now-15m' style
        to: z.string(),
      }),
      page: z.object({ limit: z.number().int().min(1).max(1000).optional() }).optional(),
      sort: z.string().optional(),
    }),
    returns: null,
  },
  'station-discover': {
    method: 'POST',
    path: () => `/api/v2/logs/events/search`,
    schema: z.object({
      filter: z.object({
        query: z.string().regex(/@log\.machineData\.callCenterName/),
        from: z.string(),
        to: z.string(),
      }),
      page: z.object({ limit: z.number().int().min(1).max(1000).optional() }).optional(),
    }),
    returns: null,
  },
  'test': {
    method: 'GET',
    path: () => `/api/v1/validate`,
    schema: z.object({}),
    returns: null,
  },
};
```

### C.6 Allowlist maintenance rules

- Every op addition requires a PR that includes:
  - Op name + method + path pattern + zod schema + returns metadata
  - CI test exercising the op against a mock upstream
  - Entry in this Appendix C
- Op removals are always safe (reject more, accept less).
- Schema changes to existing ops require compatibility review (can clients on older versions still pass validation?).
- No wildcard path expressions. No regex path construction from user input. Paths are pure template functions over validated params.

---

**End of spec v4. Hard stop here. Ready for third `/codex:adversarial-review` re-review.**
