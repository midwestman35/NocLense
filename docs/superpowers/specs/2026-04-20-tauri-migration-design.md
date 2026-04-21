# NocLense Tauri Migration — Design Spec

**Date:** 2026-04-20
**Version:** v3 (draft)
**Owner:** Enrique Velazquez, Network Engineer, SaaS Operations (Axon Enterprise / APEX)
**Status:** Draft v3 — awaiting second `/codex:adversarial-review` re-review before implementation begins
**Role split:** Claude designs and reviews; Codex implements commit-by-commit with self-assessment after each commit (per `feedback_codex_review_cycle.md`)

**Related specs:**
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` — UI polish redesign (parallel work on `redesign/ui-polish` branch; not blocked by this migration)
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md` — Procurement / IT request (approvals checklist; companion to this spec)

---

## Revision history

| Version | Date | Summary of changes |
|---|---|---|
| v1 | 2026-04-20 | Initial draft. Shared HMAC baked into Tauri binary; stateless proxy with generic passthrough for Zendesk/Confluence/Jira; in-memory nonce cache; Electron integrations cut at T+45 of token rotation. |
| v2 | 2026-04-20 | Post-adversarial-review amendments: per-device revocable credentials (HMAC); DynamoDB nonce + idempotency store; path allowlists; Electron-via-proxy stays live through pilot. |
| **v3** | **2026-04-20** | **Post-second-adversarial-review amendments (eight corrections):** (1) Ed25519 asymmetric signatures replace per-device HMAC — proxy stores only public keys, never secrets. (2) Idempotency state machine (IN_PROGRESS → COMPLETED/FAILED) with conditional reservation and 60s reservation timeout; fixes non-atomic TOCTOU race identified in v2. (3) Response bodies dropped from idempotency cache — only request_hash + status_code + response_hash stored for integrity verification. (4) Electron-via-proxy operationally specified — keytar-based keyring on Electron, bundled enrollment CLI, NSIS signed with same Authenticode cert, published to GitHub Releases alongside MSI, version-check via GitHub Releases API. (5) Enrollment abuse controls: per-IP and global rate limits, 3-strike code lockout, optional hostname binding, Datadog abuse alerts. (6) Payload schema validation via zod on Unleashed + Datadog endpoints. (7) Tauri config and invoke() surface updated for Ed25519 signing. (8) Budget unchanged (~$984/yr). |

---

## Executive Summary

NocLense is migrating from Electron + Vercel serverless proxies to a standalone Tauri 2.x desktop application backed by a dedicated integration proxy on AWS.

**Three independent failure domains replace today's single-point-of-failure:**

1. **Tauri client** — zero integration secrets in the distributed binary. Per-device Ed25519 keypair generated at first-run enrollment; private key stored in OS keyring; public key sent to proxy at enrollment. Revocable per seat via DynamoDB status flip.
2. **AWS-hosted integration proxy** — holds the 5 org admin credentials in AWS Secrets Manager; Lambda + API Gateway + DynamoDB for device public-key registry, nonces, and idempotency state. Path-allowlisted per integration.
3. **GitHub Enterprise Releases** — hosts signed `.msi` (Tauri) and `.exe` (Electron-via-proxy) binaries + Ed25519-signed Tauri update manifest.

**Timeline:** ~8–10 weeks engineering after approvals land. Procurement/approval work (AWS access, EV cert, security review) can run in parallel (~2–4 weeks).

**Budget:** ~$984/yr recurring (unchanged from v2; asymmetric crypto eliminates KMS need); $0 one-time capex. (Detail in `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`.)

**Risk profile:** Low. 95% of the React codebase is shell-agnostic and ports unchanged; the Electron native surface is ~430 LOC and maps to ~750 LOC of Rust (up from v2's ~700 due to Ed25519 signing primitives). The UI polish redesign on its parallel branch is not affected.

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
2. Proxy server holds no client-side secret material (no HMAC secrets, no symmetric keys). Compromise of DynamoDB device registry reveals only public keys.
3. Eliminate single-point-of-failure coupling. Integration failures should fail per-integration, not app-wide.
4. Enable per-seat revocation without fleet-wide coordination. One compromised device must be cut off without rotating every other seat.
5. Write idempotency under concurrency must be atomic and correct — duplicate requests must not double-apply mutations.
6. Establish production-grade standalone desktop experience: native packaging, code-signed installers, auto-updates, OS-integrated secret storage.
7. Preserve the UI polish redesign work already underway on a parallel branch. Shell migration must not require UI work to be redone.
8. Match Axon Enterprise naming/identity conventions throughout.

---

## 2. Architecture overview (end-state)

### 2.1 Three independent components

```
┌─────────────────────────────────────────────────────┐
│  NocLense Tauri app (installed on NOC seats)        │
│  - WebView2 on Windows (system-provided Chromium)   │
│  - React 19 + Vite frontend (unchanged from today)  │
│  - Rust main process (~750 LOC target)              │
│  - Zero integration secrets in binary               │
│  - Per-device Ed25519 keypair:                      │
│      - PRIVATE key in OS keyring (never leaves)     │
│      - PUBLIC key sent to proxy at enrollment       │
└─────────────────────────────────────────────────────┘
          │                              │
          │ Ed25519-signed HTTPS         │ Auto-update poll
          │ (private key signs)          │
          ▼                              ▼
┌─────────────────────────────────┐   ┌──────────────────────────┐
│  AWS integration proxy          │   │  GitHub Enterprise       │
│  Lambda + API Gateway           │   │  Releases                │
│                                 │   │  - Signed .msi (Tauri)   │
│  DynamoDB:                      │   │  - Signed .exe (Electron-│
│    - Device registry            │   │    via-proxy)            │
│      (public keys only)         │   │  - latest.json manifest  │
│    - Nonce store (replay)       │   │    (Ed25519-signed)      │
│    - Idempotency state machine  │   └──────────────────────────┘
│      (IN_PROGRESS/COMPLETED/    │
│      FAILED + request_hash)     │
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
- **Native process:** Rust, capability-scoped. Target ~750 LOC in `src-tauri/src/main.rs` (includes `ed25519-dalek` signing primitives).
- **Filesystem access:** scoped to `$APPDATA/NocLense/**`, `$DOCUMENTS/DailyNOC/**`, and user-selected drop files. No broad shell or arbitrary HTTP.
- **Cryptographic identity:** Per-device Ed25519 keypair generated at first-run. **Private key** stored in OS keyring via `tauri-plugin-keyring` (Windows Credential Manager, per-user scoped). **Public key** sent to proxy at enrollment; stored there as non-sensitive identity material.
- **Authentication:** Every request signed with private key; proxy verifies with stored public key. Server holds zero secret material related to device auth. Revocation is a DynamoDB status flip.
- **Auto-update:** Tauri's built-in updater with Ed25519 signature verification (separate keypair from device-identity keys).
- **Packaging:** Authenticode-signed `.msi` installer. Bundle identifier `com.axon.noclense`.

### 2.3 Proxy: hybrid service on AWS

- **Platform:** AWS Lambda + API Gateway + DynamoDB (low-QPS stateful proxy, folds into existing Axon AWS footprint).
- **Endpoints (6):** `POST /proxy/enroll` (first-run device registration), `POST /proxy/unleash`, `POST /proxy/datadog`, `POST /proxy/zendesk` (path-allowlisted), `POST /proxy/confluence` (path-allowlisted), `POST /proxy/jira` (path-allowlisted).
- **Credentials:** All org admin tokens in AWS Secrets Manager; Lambda reads on cold start via IAM role.
- **Authentication:** Per-device Ed25519 verification. `X-Device-Id` header identifies device; proxy looks up stored public key in DynamoDB and verifies the request signature. No secret material stored for device auth.
- **Replay prevention:** DynamoDB nonce store with conditional put (60s TTL + 10s grace) ensures global rejection of replayed signatures across all Lambda containers.
- **Idempotency state machine:** DynamoDB-backed `IN_PROGRESS` → `COMPLETED` | `FAILED` transitions with 60s reservation timeout. Stores `request_hash` (not body) for conflict detection. 24h entry TTL.
- **Path allowlists:** Zendesk, Confluence, Jira each have an explicit per-integration allowlist of named operations (`op` → method + path pattern) in proxy source code. Unmatched operations return 403.
- **Payload validation:** All endpoints validate incoming payload shape via zod schemas before forwarding. Malformed payloads return 400.
- **Observability:** structured JSON logs to existing Axon Datadog.

### 2.4 Update manifest server: GitHub Enterprise Releases

- **Hosting:** Release artifacts (`noclense_<version>_x64_en-US.msi` for Tauri; `noclense-electron_<version>.exe` for Electron-via-proxy during pilot) + `latest.json` manifest published under the Axon Enterprise GitHub org.
- **Signatures:** Two-layer for Tauri. (1) Authenticode on the `.msi` (Windows SmartScreen trusts immediately). (2) Ed25519 on the `latest.json` manifest (Tauri verifies before any download). Electron `.exe` signed with same Authenticode cert; no auto-update manifest (version-check via GitHub Releases API instead).
- **Signing keys:** Ed25519 private key in GitHub Actions secret (distinct from device-identity Ed25519 keys); Authenticode cert thumbprint (or Azure Key Vault reference) in CI.

### 2.5 Data flow and failure domains

**Four independent failure domains:**

| Failure | Impact |
|---|---|
| Proxy Lambda down | AI + Datadog + Zendesk + Confluence + Jira fail. App still runs; user sees "integration unavailable" messages per surface. Local investigation work continues. |
| DynamoDB unavailable (nonce/idempotency/device registry) | Proxy rejects all authenticated requests (fail-safe; no degraded bypass). Independent DynamoDB outages in AWS are rare (<4h/yr historical). |
| Update server down | Existing installs keep working; no new updates reach seats. |
| Vendor API down (e.g. Datadog) | That integration fails; other four still work through proxy. Matches today's vendor-outage behavior. |

### 2.6 Token rotation and per-device revocation

**Vendor admin tokens:** Before any Tauri build leaves dev, all 5 vendor admin tokens are rotated. This establishes a clean cryptographic baseline: any pre-Phase-1 Electron builds in the wild with baked tokens stop working against upstream vendors. Old integration capability dies at the rotation event, regardless of installer redistribution.

**Per-device revocation:** Each Tauri and Electron-via-proxy install has a unique `device_id` + Ed25519 keypair. Compromise of any single seat is resolved by setting that device's status to `revoked` in DynamoDB via AWS CLI. Next request from that device returns `device_revoked`. No fleet-wide rotation, no coordinated client update required. Compromise response time: seconds.

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
- [ ] Create CLI tooling for Enrique to issue one-time enrollment codes (AWS CLI wrapper or small Node script that writes a short-lived code into a dedicated `noclense-proxy-enrollments` DynamoDB table with `status=unused`, `expires_at`, optional `bound_hostname`).

**Output:** credentials, cert, hosting account, signing keys, DNS, DynamoDB tables, enrollment CLI. No app code.

### 3.3 Phase 1 — Proxy service + Electron-via-proxy productionization (~3 weeks, fullstack-developer)

Extended scope from v2 due to operational completeness for Electron path. Split into two sub-phases.

#### 3.3.1 Phase 1a — Proxy service (~2 weeks)

Build and deploy the 6-endpoint hybrid proxy.

- [ ] Node/TypeScript service (Node 20+, matching existing stack conventions).
- [ ] Six endpoints as specified in § 4.
- [ ] Ed25519 signature middleware: read `X-Device-Id` + `X-NocLense-Signature`, look up device public key in DynamoDB (reject if `status != active`), verify signature using `@noble/ed25519` or equivalent.
- [ ] DynamoDB nonce store: conditional put on every authenticated request; reject duplicates globally.
- [ ] DynamoDB idempotency state machine (see § 4.1.4 for full spec): required on POST/PUT/DELETE; conditional reservation + state transitions; request_hash for conflict detection.
- [ ] Path allowlists for Zendesk, Confluence, Jira — enumerated from current service modules during Phase 1a; added to spec as Appendix C upon completion.
- [ ] Zod schema validation on Unleashed + Datadog payload shapes; reject 400 on malformed.
- [ ] Enrollment endpoint: validate one-time code (not expired, not used, not locked); if `bound_hostname` set, verify submitted hostname matches; atomically flip enrollment code status `unused` → `used`; write device record with submitted public key and `status: active`.
- [ ] Enrollment abuse controls: per-IP rate limit (5 attempts / 15 min via DynamoDB atomic counter); global rate limit (50 attempts / hour); 3-strike code lockout (3 consecutive failures against same code → code marked `locked`, new code required).
- [ ] Structured JSON request/response logging to Datadog (includes `device_id` for attribution).
- [ ] Datadog alerts: `enrollment_code_invalid` rate >5/min triggers abuse detection alert; `device_revoked` or `signature_invalid` unusual spike alerts.
- [ ] Health check endpoint for API Gateway.
- [ ] Secrets in AWS Secrets Manager: `UNLEASH_TOKEN`, `UNLEASH_ASSISTANT_ID`, `DATADOG_API_KEY`, `DATADOG_APP_KEY`, `ZENDESK_EMAIL`, `ZENDESK_TOKEN`, `CONFLUENCE_EMAIL`, `CONFLUENCE_TOKEN`, `JIRA_EMAIL`, `JIRA_TOKEN`.

#### 3.3.2 Phase 1b — Electron-via-proxy productionization (~1 week)

Replace Electron's baked-secret integrations with proxy-signed calls.

- [ ] Add `keytar` (or `@napi-rs/keyring`) to Electron dependencies for OS keyring access on the main process.
- [ ] Electron main process: on startup, check keyring for `noclense.device_id` + `noclense.device_privkey`. If missing, spawn enrollment flow (see below).
- [ ] Build bundled enrollment CLI: a small Node script (`electron-enroll.js`) shipped in the NSIS installer. User runs it post-install; it prompts for enrollment code, generates Ed25519 keypair using `@noble/ed25519`, POSTs to `/proxy/enroll` with public key + code, stores `device_id` + `device_privkey` in keyring.
- [ ] Update the 6 service wrappers (`unleashService`, `zendeskService`, `jiraService`, `datadogService`, `confluenceService`, `UnleashProvider`): replace direct API calls with proxy-signed calls. Signing uses the keyring-stored private key via Electron main process (never exposed to renderer).
- [ ] Remove `VITE_*` vendor tokens from the Electron build. Set to empty strings so any legacy code path hitting them fails loudly rather than calling direct.
- [ ] NSIS build step: sign the `.exe` with the same Authenticode cert used for the Tauri `.msi`. Same timestamp URL, same digest algorithm.
- [ ] CI publishes Electron `.exe` to the same GitHub Release as the Tauri `.msi` (both artifacts on one release tag).
- [ ] Electron startup version-check: on launch, fetch `GET https://api.github.com/repos/<axon-org>/noclense/releases/latest` (unauthenticated — public repo metadata), compare `tag_name` to current version. If newer available, show modal with download link. No in-place auto-update for Electron — manual download and reinstall.

**Gate before Phase 2:** proxy deployed with all abuse controls; DynamoDB replay prevention verified (synthetic replay rejected); idempotency state machine verified under concurrency (two concurrent identical requests → exactly one upstream call); path allowlist catches unauthorized paths (synthetic 403 test); enrollment flow complete including abuse controls (rate limits trigger, lockouts enforce); all six endpoints reachable from Electron-via-proxy; 24 hours uneventful operation.

**Token rotation event at end of Phase 1** — see § 6.2. Old pre-Phase-1 Electron builds (baked tokens) stop working; Electron-via-proxy shim stays functional.

### 3.4 Phase 2 — Tauri shell migration (~3–5 weeks, fullstack-developer)

Substages:

**2a. Scaffold (1 day).** `npm create tauri-app@latest`, point at existing Vite `dist/`, verify React 19 loads in WebView2 window. First commit green. Include `tauri-plugin-keyring` and `tauri-plugin-window-state` from day 1. Add `ed25519-dalek` to `Cargo.toml`.

**2b. electronAPI compat shim (3–5 days).** Inventory the 11 files; write Tauri `#[tauri::command]` equivalents for the 4 crash/error operations plus 3 new enrollment/signing commands (`generate_device_keypair`, `enroll_device`, `sign_request` — detailed in § 5.3); write `src/shell/api.ts` that detects `window.__TAURI__` vs `window.electronAPI` and dispatches. Keep Electron still building during this work. ~250 lines of JS changes, ~550 lines of Rust.

**2c. Enrollment flow UI (2–3 days).** First-run onboarding: if no `device_id` in keyring, show enrollment screen. User pastes one-time code from admin. Tauri generates Ed25519 keypair via `generate_device_keypair` command, sends public key + code to `/proxy/enroll`, stores `device_id` + private key in keyring. If enrollment fails, show clear error with contact info. Successful enrollment transitions to normal app UI.

**2d. Secret storage via keyring (1–2 days).** `tauri-plugin-keyring` wrapper commands for `device_id` and `device_privkey` storage. User preferences still plaintext JSON in `$APPDATA/NocLense/preferences.json`. Delete `src/store/apiKeyStorage.ts` — integration tokens live entirely on proxy.

**2e. Request signing path (1 day).** Every outbound proxy call goes through a `sign_request` Rust command that: reads the private key from keyring, constructs the canonical message (`timestamp.nonce.payload`), signs with Ed25519, returns base64 signature. TypeScript caller appends `X-Device-Id` + `X-NocLense-Signature` headers.

**2f. Error-reporting webhook (0.5 day).** Move from `process.env.NOCLENSE_ERROR_REPORT_URL` in `electron/main.js` to Rust-side `reqwest` call via new `report_error` command.

**2g. Auto-updater wiring (1–2 days).** `@tauri-apps/plugin-updater` pointed at GitHub Releases manifest URL; Ed25519 pubkey (updater-specific, distinct from device-identity keys) baked; test full + delta update cycles.

**2h. CI/CD (2–3 days).** `tauri build` in GitHub Actions, Authenticode signing for `.msi`, Ed25519 signing of `latest.json`, publish artifacts to GitHub Releases.

**2i. Dual-run validation (1–2 weeks calendar).** Tauri build on internal dev seats alongside Electron-via-proxy. Soak on real NOC workflows. Fix WebView2-specific regressions (IndexedDB quota, font antialiasing, Motion edge cases). Verify per-device enrollment across different machines.

**Gate before Phase 3:** Tauri build passes full vitest suite in WebView2; 2+ weeks internal soak with no critical regressions; auto-update tested end-to-end; enrollment flow verified on ≥3 fresh machines.

### 3.5 Phase 3 — Cutover + Electron retirement (~0.5 day)

See § 6.6. Retires BOTH Electron variants (pre-Phase-1 baked-secret and Phase-1 shimmed-via-proxy) at cutover, after the 14-day pilot GO-gate (§ 6.5) clears.

### 3.6 Parallel coordination with UI redesign

The UI polish redesign runs on `redesign/ui-polish` branch owned by frontend-developer throughout all phases. It does not stop, pause, or slow for the shell migration.

**Coordination point:** when fullstack-developer merges the Phase 2 shim commit (touching `src/shell/api.ts` + the 11 electronAPI files), frontend-developer rebases the redesign branch. The changes are scoped to the top-of-file shell-detection helpers, not the API-interaction code that UI phases extend. Expected conflict: zero or minor.

A standing async ping at merge time is enough. No synchronous sync meetings required.

### 3.7 Agent ownership

| Phase | Owner | Claude's role |
|---|---|---|
| 0 (Foundation prep) | fullstack-developer + Enrique (procurement) | Review prep checklist; confirm approvals land |
| 1a (Proxy) | fullstack-developer | Review each commit's self-assessment per role-split cycle; design oversight; path allowlist enumeration sign-off |
| 1b (Electron-via-proxy) | fullstack-developer | Review each commit; verify keytar integration + signing path end-to-end |
| 2 (Tauri migration) | fullstack-developer | Review each commit; resolve design questions; coordinate with frontend-developer |
| 3 (Cutover) | fullstack-developer | Sign-off GO/NO-GO |
| UI redesign (ongoing) | frontend-developer | Separate track; unchanged review cadence |

---

## 4. Proxy service design

Hosting-agnostic by design — the code runs identically on AWS Lambda, a Fly.io VM, or a local Node process. AWS Lambda + DynamoDB is the assumed target.

### 4.1 Request/response envelope and authentication

All authenticated endpoints follow the same envelope pattern. (The `/proxy/enroll` endpoint has a different shape; see § 4.2.)

#### 4.1.1 Request envelope

```ts
interface ProxyRequest<TPayload> {
  /** ISO-8601 timestamp; rejected if >60s skew from server time */
  timestamp: string;
  /** Opaque random nonce (UUIDv4 or 128-bit random); rejected if previously seen in DynamoDB within 60s */
  nonce: string;
  /** Required on POST/PUT/DELETE; UUIDv4; idempotency state machine enforces at-most-once upstream execution */
  idempotency_key?: string;
  /** Scenario-specific payload; validated by zod schema per endpoint */
  payload: TPayload;
}
```

**Headers required on authenticated requests:**
- `X-Device-Id: <uuid>` — device identifier from keyring
- `X-NocLense-Signature: <base64>` — Ed25519 signature of the canonical message (see § 4.1.2)

#### 4.1.2 Canonical message construction

The canonical message signed by the client and verified by the proxy is a deterministic byte sequence:

```
canonical_message = utf8_bytes(timestamp + "." + nonce + "." + JSON.stringify(payload))
```

`JSON.stringify` must produce canonical output: sorted keys (lexicographic on Unicode codepoints), no insignificant whitespace, numbers in shortest-form representation. Both client and proxy use the same canonicalization library (e.g., `json-canonicalize` npm package on both sides) to avoid signature mismatches from whitespace or key ordering differences.

Client signs `canonical_message` with its Ed25519 private key; proxy verifies with the device's stored public key.

#### 4.1.3 Authentication flow (proxy side)

1. Extract `X-Device-Id` and `X-NocLense-Signature` headers. Reject 401 if missing.
2. Look up `device_id` in `noclense-proxy-devices` DynamoDB table.
   - If not found → 401 `device_not_enrolled`.
   - If `status == 'revoked'` → 401 `device_revoked`.
   - If `status != 'active'` → 401 `device_not_enrolled`.
3. Reconstruct canonical message from `timestamp`, `nonce`, `payload` in the request body.
4. Verify signature using stored `device_public_key` and `canonical_message`.
   - If verification fails → 401 `signature_invalid`.
5. Check timestamp skew (`|now - timestamp| < 60s`). If exceeded → 401 `hmac_expired` (name retained for client compatibility).
6. Attempt `PutItem` on `noclense-proxy-nonces` with `ConditionExpression: attribute_not_exists(nonce)` and TTL = `timestamp + 70s`. If conditional put fails → 401 `replay_detected`.
7. Validate payload against endpoint's zod schema. If invalid → 400 `payload_invalid`.
8. If request is mutating (POST/PUT/DELETE): verify `idempotency_key` present; enter state machine (§ 4.1.4).
9. If request is read-only or idempotency reservation succeeded: forward to upstream, return response.

**Server stores no secret material for device auth.** A full dump of `noclense-proxy-devices` reveals device IDs, public keys, and status flags — none of which enable impersonation.

#### 4.1.4 Idempotency state machine (mutating requests only)

DynamoDB table `noclense-proxy-idempotency`:

- Partition key: `idempotency_key` (string)
- Attributes:
  - `request_hash` (string): SHA-256 of canonical payload
  - `state` (string): `IN_PROGRESS` | `COMPLETED` | `FAILED`
  - `status_code` (number, set on terminal states)
  - `response_hash` (string, set on `COMPLETED`): SHA-256 of upstream response body (integrity check for client)
  - `started_at` (string, ISO-8601)
  - `completed_at` (string, ISO-8601, optional)
  - `reservation_expires_at` (number, epoch seconds): `started_at + 60s`; window during which another Lambda may not take over
  - `expires_at` (number, epoch seconds): TTL — `started_at + 24h`

**State transitions (proxy per request):**

1. Compute `request_hash = SHA256(canonical_payload)`.
2. Attempt `PutItem`:
   - `Item: { idempotency_key, request_hash, state: 'IN_PROGRESS', started_at: now, reservation_expires_at: now + 60s, expires_at: now + 86400 }`
   - `ConditionExpression: attribute_not_exists(idempotency_key) OR (state = 'IN_PROGRESS' AND reservation_expires_at < :now)`
   - `ExpressionAttributeValues: { :now: <current epoch seconds> }`
3. **If put succeeds:** we hold the reservation. Execute upstream.
   - On upstream success: `UpdateItem` → `state = 'COMPLETED'`, `status_code`, `response_hash`, `completed_at = now`. Return `{ ok: true, result: upstream_response, cached: false }`.
   - On upstream failure: `UpdateItem` → `state = 'FAILED'`, `status_code = upstream_status`, `completed_at = now`. Return `{ ok: false, error }`.
4. **If put fails:** another Lambda has the reservation or the request completed. Fetch the item.
   - If `state == 'COMPLETED'` AND `request_hash matches`: return `{ ok: true, result: { status_code, response_hash, note: 'cached_result — re-query upstream if content needed' }, cached: true }`. Client uses `response_hash` to verify integrity of any separately-fetched response.
   - If `state == 'COMPLETED'` AND `request_hash differs`: return 409 `idempotency_conflict`.
   - If `state == 'FAILED'` AND `request_hash matches`: return cached error response.
   - If `state == 'FAILED'` AND `request_hash differs`: return 409 `idempotency_conflict`.
   - If `state == 'IN_PROGRESS'`: poll item every 500ms for up to 30s waiting for terminal state. On transition: return per rules above. On timeout: return 409 `idempotency_in_progress` (client should retry later, not immediately).

**Why this is safe:**

- Conditional reservation is atomic. Two concurrent Lambdas either see no item (one reserves, other polls) or see IN_PROGRESS (both poll, one observes the terminal state).
- 60-second reservation timeout handles Lambda mid-flight death: after 60s with no state update, another Lambda can replace the reservation. Without this, a crashed Lambda would block the idempotency_key for 24h.
- `request_hash` prevents same-key-different-payload abuse (a common app bug).
- No response body stored — only hash. Retention exposure is minimized. Clients that need cached response bodies must re-request; upstream mutations are already idempotent-at-most-once by design.

#### 4.1.5 Response envelope

```ts
type ProxyResponse<TResult> =
  | { ok: true; result: TResult; cached?: boolean }  // cached: true on idempotency hit
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        upstreamStatus?: number;
      };
    };
```

### 4.2 Endpoint shapes

#### 4.2.1 Enrollment endpoint (no device signature — bootstrap)

| Endpoint | Request | Response |
|---|---|---|
| `POST /proxy/enroll` | `{ device_id: string, device_public_key: string (base64 Ed25519 public key), enrollment_code: string, hostname?: string }` | `{ ok: true, enrolled_at: ISO8601 }` or `{ ok: false, error: { code: string } }` |

**Error codes:**
- `enrollment_code_invalid` — not found, malformed, or already used
- `enrollment_code_expired` — past 15min TTL
- `enrollment_code_locked` — 3 consecutive invalid attempts against this code
- `enrollment_hostname_mismatch` — code was bound to a hostname; submitted hostname doesn't match
- `enrollment_rate_limited` — per-IP or global limit exceeded
- `device_already_enrolled` — device_id already in `noclense-proxy-devices`
- `public_key_malformed` — not a valid Ed25519 public key (32 bytes base64-decoded)

**Abuse controls:**

- Per-IP rate limit on `/proxy/enroll`: 5 attempts per 15 minutes (DynamoDB atomic counter, sliding window).
- Global rate limit: 50 enrollment attempts per hour across all IPs.
- Code lockout: 3 consecutive invalid submissions against the same enrollment code → code marked `locked`; admin must issue a new code.
- Optional hostname binding: admin CLI can set `bound_hostname` at code issuance; proxy rejects enrollment if submitted hostname doesn't match (case-insensitive). Recommended for sensitive seats.
- Code entropy: 24 base32 characters (120 bits of entropy) — generated from cryptographic RNG.

**Enrollment code lifecycle:** Admin runs CLI → writes `{ code, expires_at: now + 15min, status: 'unused', bound_hostname?, issued_at, issued_by }` to DynamoDB `noclense-proxy-enrollments` table. User enters code in client. Client generates Ed25519 keypair, submits public key + code to `/proxy/enroll`. Proxy validates code (not expired, `status == 'unused'`, not locked, rate limits OK, hostname matches if bound); atomically flips code status to `used`; writes device record `{ device_id, device_public_key, status: 'active', enrolled_at, hostname, issued_by (from code record) }`.

#### 4.2.2 Authenticated endpoints

| Endpoint | Payload | Forwards to | Credentials injected |
|---|---|---|---|
| `POST /proxy/unleash` | `{ chatId?, userEmail, message, ... }` validated by zod schema | `https://api.unleash.so/chats` | `Authorization: Bearer ${UNLEASH_TOKEN}`, `X-Assistant-Id: ${UNLEASH_ASSISTANT_ID}` |
| `POST /proxy/datadog` | `{ method: 'search' \| 'station-discover' \| 'test', query: string, timeRange: { from: ISO8601, to: ISO8601 }, limit?: number }` validated by zod schema | `https://api.${DATADOG_SITE}/api/v2/logs/events/search` or `/api/v1/metrics/search` depending on `method` | `DD-API-KEY: ${DATADOG_API_KEY}`, `DD-APPLICATION-KEY: ${DATADOG_APP_KEY}` |
| `POST /proxy/zendesk` | `{ op: string, params: ... }` — allowlisted operations, payload schema per op | Upstream path derived from `op` | Basic auth: `${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}` |
| `POST /proxy/confluence` | `{ op: string, params: ... }` — allowlisted operations | Upstream path derived from `op` | Basic auth |
| `POST /proxy/jira` | `{ op: string, params: ... }` — allowlisted operations | Upstream path derived from `op` | Basic auth |

**Path allowlist design:** Zendesk, Confluence, and Jira each expose a named `op` that maps to exactly one (method, path pattern, params schema) tuple in proxy source. Unknown `op` → reject 403 `path_not_allowed`. Allowlist enumerated from current service modules during Phase 1a; added to spec Appendix C when enumeration completes. Expanding the allowlist requires a proxy code change + PR review.

**Example Zendesk allowlist shape (illustrative; final list derived during Phase 1a):**

```ts
import { z } from 'zod';

const ZendeskGetTicket = z.object({
  op: z.literal('get-ticket'),
  params: z.object({ ticketId: z.string().regex(/^\d+$/) }),
});

const ZendeskUpdateTicket = z.object({
  op: z.literal('update-ticket'),
  params: z.object({
    ticketId: z.string().regex(/^\d+$/),
    body: z.record(z.unknown()),  // forwarded verbatim to Zendesk
  }),
});

// ... more schemas

const ZENDESK_OPS: Record<string, {
  method: 'GET' | 'POST' | 'PUT';
  schema: z.ZodSchema;
  path: (params: any) => string;
}> = {
  'get-ticket':    { method: 'GET',  schema: ZendeskGetTicket,    path: (p) => `/tickets/${encodeURIComponent(p.ticketId)}.json` },
  'update-ticket': { method: 'PUT',  schema: ZendeskUpdateTicket, path: (p) => `/tickets/${encodeURIComponent(p.ticketId)}.json` },
  // ... enumerated during Phase 1a from zendeskService.ts usage
};
```

Proxy flow per request: validate `op` is known → validate params against `schema` → construct path via `path(params)` → forward.

### 4.3 Error handling taxonomy

| `error.code` | HTTP | Meaning | Client action |
|---|---|---|---|
| `signature_invalid` | 401 | Ed25519 verification failed | Device key mismatch or tampering. Prompt user to re-enroll. |
| `hmac_expired` | 401 | Timestamp outside skew window (name retained for client compatibility) | Retry once with fresh timestamp; if still fails, surface clock-skew warning. |
| `device_revoked` | 401 | Device status is `revoked` in DynamoDB | Admin has revoked this seat. Show contact-admin message. No automatic recovery. |
| `device_not_enrolled` | 401 | Device ID unknown to proxy | Device was never enrolled. Prompt enrollment. |
| `replay_detected` | 401 | Nonce already seen in DynamoDB | Retry once with fresh nonce; if still fails, log and surface to user. |
| `enrollment_code_invalid` | 400 | Enrollment code not found or malformed | Ask admin for a fresh code. |
| `enrollment_code_expired` | 400 | Code expired (15min lifetime) | Ask admin for a fresh code. |
| `enrollment_code_locked` | 400 | 3 failed attempts against this code | Ask admin for a fresh code. |
| `enrollment_hostname_mismatch` | 400 | Bound-hostname code doesn't match submitted hostname | Ask admin to issue a code for this hostname, or an unbound code. |
| `enrollment_rate_limited` | 429 | Per-IP or global enrollment limit exceeded | Wait and retry later. Automated alerts notify admin. |
| `device_already_enrolled` | 409 | Same device_id already registered | Client should regenerate device_id and retry enrollment. |
| `public_key_malformed` | 400 | Invalid Ed25519 public key format | Client bug — regenerate keypair. |
| `idempotency_conflict` | 409 | Idempotency key seen with different payload | Client bug — same key reused for different operations. Regenerate key. |
| `idempotency_in_progress` | 409 | Another request with this key is still in progress | Wait 30s+, retry. |
| `payload_invalid` | 400 | Payload failed zod schema validation | Client bug. |
| `path_not_allowed` | 403 | Requested `op` not in allowlist for this integration | Client bug — proxy doesn't support this operation. File a ticket. |
| `rate_limited` | 429 | Per-device or per-endpoint bucket exhausted | Exponential backoff. Not expected in normal use. |
| `upstream_4xx` | 502 | Upstream vendor returned 4xx | Likely vendor-side config. Log INFO; surface generic "service unavailable" to user. |
| `upstream_5xx` | 502 | Upstream 5xx | Transient. Retry once; if persistent, degraded-mode UI. |
| `upstream_timeout` | 504 | Upstream request >30s | Unleashed long prompts may hit this. Show "taking longer than expected" after 10s client-side. |
| `internal_error` | 500 | Proxy bug | Client logs; surfaces "unexpected error." Should not fire in steady state. |

### 4.4 Rate limiting

DynamoDB-backed per-device rate limits (in addition to per-endpoint in-memory limits):

- **Per-device:** 300 req/min across all endpoints (rolling window via DynamoDB atomic counter). Prevents a single compromised device from exhausting shared upstream quotas.
- **Per-endpoint global:** Unleashed 20 req/min per container; Datadog 30 req/min; Zendesk/Confluence/Jira 60 req/min each.
- **Enrollment:** per-IP 5/15min; global 50/hour (see § 4.2.1).

### 4.5 Observability

Structured JSON logs per request, shipped to Axon Datadog:

```json
{
  "ts": "2026-04-20T15:30:45.123Z",
  "endpoint": "/proxy/unleash",
  "device_id": "a1b2c3d4-...",
  "hostname": "noc-laptop-03",
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

**NOT logged:** request payloads, response bodies, auth headers, cookies, user prompts, ticket text, device private keys, enrollment codes. Metadata only. `device_id` is a UUID; `hostname` comes from the device registry (not request) and is non-PII.

Datadog dashboards (set up in Phase 1a):
- Per-device request volume (detect anomalous spikes)
- Per-endpoint latency + error rate
- Enrollment attempts (success/failure/locked)
- Replay rejections (should be ~0 in steady state)
- Signature-invalid rate (alerts on spike — possible compromise attempt)

Datadog monitors (Phase 1a):
- `enrollment_code_invalid` rate > 5/min → abuse alert
- `signature_invalid` rate > 10/hour → possible compromise or build drift
- `device_revoked` rate > 1/hour → unexpected revocation signal
- DynamoDB throttling events on any of 3 tables → capacity alert

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

**Ed25519 device-identity keys:** Not rotated routinely. If a specific device is compromised, revoke per above; user re-enrolls with a fresh keypair.

**Ed25519 updater signing key** (distinct from device-identity keys): Infrequent. If private key is compromised:

1. Generate new Ed25519 keypair.
2. Ship new Tauri build with both old and new pubkeys (accept either signature for a transition window).
3. Sign new manifests with new key only. Wait for auto-update to propagate.
4. Ship third Tauri build with only new pubkey. Revoke old key.

### 4.7 Non-goals for proxy v1

- **Per-user auth (SSO, JWT, user identity).** Per-device is the identity model — each device attributable but not each user. Upgrade path to SSO exists via additive `Authorization: Bearer <jwt>` header alongside per-device signing if compliance demands it.
- **Cached response bodies in idempotency store.** Retention-minimizing design; clients retry with fresh upstream call if they need content.
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
      "csp": "default-src 'self'; connect-src 'self' https://noclense-proxy.axon.com https://api.github.com; style-src 'self' 'unsafe-inline'; script-src 'self'"
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
      "pubkey": "<base64 ed25519 updater-manifest public key — baked at build>",
      "dialog": true,
      "windows": { "installMode": "passive" }
    }
  }
}
```

**Required plugins (enumerated in `Cargo.toml`):**
- `tauri-plugin-keyring` — device private key + device_id storage
- `tauri-plugin-window-state` — window size/position persistence
- `tauri-plugin-updater` — auto-update
- `tauri-plugin-dialog` — file pickers
- `tauri-plugin-fs` — scoped filesystem access
- `ed25519-dalek` (Rust crate) — device-identity signing primitives

**Key decisions with rationale:**

- `withGlobalTauri: false` — no `window.__TAURI__` global pollution. Renderer uses `import { invoke } from '@tauri-apps/api/core'`. Forces explicit imports, easier to grep.
- CSP locks `connect-src` to the proxy domain + `api.github.com` (for Electron version-check reuse and Tauri-side release metadata if needed) + self.
- `webviewInstallMode: embedBootstrapper` ships the WebView2 bootstrapper in the MSI.
- `allowDowngrades: false` — auto-updater refuses older versions.

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
        { "url": "https://api.github.com/**" },
        { "url": "http://localhost:5173/**" }
      ]
    }
  ]
}
```

Keyring is scoped by convention to the `noclense.*` key prefix (client-side constant, not a Tauri-enforceable scope).

### 5.3 `invoke()` surface — seven custom commands

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `get_crash_reports` | `{ limit: u32 }` | `Vec<CrashReport>` | Replaces `window.electronAPI.getCrashReports` |
| `open_crash_log_location` | `()` | `()` | Replaces `window.electronAPI.openCrashLogLocation` |
| `clear_crash_reports` | `()` | `u32` (count deleted) | Replaces `window.electronAPI.clearCrashReports` |
| `report_error` | `{ payload: ErrorReportPayload }` | `()` | Replaces `app:report-error` IPC |
| `generate_device_keypair` | `()` | `{ public_key: String }` (base64) | Creates Ed25519 keypair; stores private key in keyring under `noclense.device_privkey`; returns public key to UI for submission to proxy |
| `enroll_device` | `{ enrollment_code: String, hostname: String }` | `{ device_id: String, enrolled_at: String }` | POSTs to `/proxy/enroll` with device_id (generated), public key (from keyring-associated keypair), code, hostname. On success stores device_id in keyring under `noclense.device_id` |
| `sign_request` | `{ canonical_message: Vec<u8> }` | `{ signature: String }` (base64) | Reads private key from keyring; signs canonical message with Ed25519; returns base64 signature. Called before every outbound proxy request |
| `get_device_status` | `()` | `{ enrolled: bool, device_id?: String }` | Check enrollment state at startup |

### 5.4 Secret handling

**v3 design: Ed25519 asymmetric keypair in OS keyring.**

| Secret | Where it lives | Why |
|---|---|---|
| 5 vendor integration tokens | AWS Secrets Manager (proxy) | Not on the client, period. |
| Device private key (Ed25519, 32 bytes) | OS keyring under `noclense.device_privkey` (Windows Credential Manager) | OS-level encryption; per-user scoped; never leaves the device. |
| Device ID (UUID) | OS keyring under `noclense.device_id` | Companion to private key; in keyring for atomicity of "enrolled state" |
| Device public key (sent to proxy) | DynamoDB `noclense-proxy-devices` table | **Not a secret.** Public keys are safe to store plaintext. |
| Enrollment code (ephemeral) | User's clipboard → input field → immediate use | Never stored; single-use; 15min TTL. |
| User preferences | `$APPDATA/NocLense/preferences.json` | Not secrets. Plaintext JSON. |
| Crash report correlation UUID | Same preferences.json | Not a secret. First-launch generated. |

**First-run enrollment flow:**

1. Tauri launches, checks keyring for `noclense.device_id`. Not present → enrollment UI.
2. UI: "Paste your one-time enrollment code from your NOC admin." Input field + Enroll button.
3. User pastes code. UI calls `invoke('generate_device_keypair')`. Rust command:
   - Generates Ed25519 keypair using `ed25519-dalek::SigningKey::generate(&mut OsRng)`.
   - Stores private key bytes in keyring under `noclense.device_privkey`.
   - Returns base64 public key to UI.
4. UI generates `device_id = UUIDv4()` in TS, calls `invoke('enroll_device', { enrollment_code, hostname: await os.hostname() })`. Rust command:
   - Reads public key back from associated storage (or takes as arg from TS).
   - POSTs to `/proxy/enroll` with `{ device_id, device_public_key, enrollment_code, hostname }`.
   - On success: stores `device_id` in keyring under `noclense.device_id`.
   - Returns `device_id` to UI.
5. UI transitions to normal app. Subsequent launches skip enrollment.

**Per-request signing flow:**

1. TS service wrapper wants to call `/proxy/unleash`.
2. Constructs `{ timestamp, nonce, idempotency_key?, payload }` request body.
3. Computes canonical message: `canonical = timestamp + "." + nonce + "." + jsonCanonicalize(payload)`.
4. Calls `invoke('sign_request', { canonical_message: utf8Bytes(canonical) })`. Rust reads private key from keyring, signs, returns base64.
5. Reads `device_id` from keyring (via `invoke('get_device_status')` or cached in memory).
6. Sends HTTP POST with headers `X-Device-Id: <uuid>` and `X-NocLense-Signature: <base64>`, body `{ timestamp, nonce, idempotency_key?, payload }`.

**Re-enrollment:** If proxy returns `device_revoked` or `signature_invalid` during normal operation, UI offers "Re-enroll?" — admin issues fresh code, keyring entries (`noclense.device_id`, `noclense.device_privkey`) are cleared via `keyring:allow-delete`, flow starts over.

**Design rationale — asymmetric over symmetric:**

Asymmetric (Ed25519) gives the proxy zero secret material for device auth. A full DynamoDB dump reveals only public keys, which are inherently safe to disclose. This is strictly stronger than the v2 HMAC design, eliminates the implementability issue v2 had (stored hash can't recompute HMAC), and aligns with modern best practice for distributed systems where the server holds keys for many clients.

### 5.5 Auto-updater — two-layer signing

(Unchanged from v2.)

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
5. tauri signer sign latest.json     # Ed25519 sign the manifest (updater key)
6. # Electron-via-proxy build (during pilot window only):
   npm run electron:build            # signed .exe via same cert thumbprint
7. gh release create <tag> <.msi> <.exe> latest.json
```

Electron `.exe` step runs only when a `--include-electron` flag is passed; disabled post-Phase-3.

### 5.8 Migration shim — the transition layer

```ts
export interface ShellAPI {
  getCrashReports(limit?: number): Promise<CrashReport[]>;
  openCrashLogLocation(): Promise<void>;
  clearCrashReports(): Promise<number>;
  reportError(payload: ErrorReportPayload): Promise<void>;

  // Device identity (both shells)
  generateDeviceKeypair(): Promise<{ publicKey: string }>;
  enrollDevice(enrollmentCode: string, hostname: string): Promise<{ deviceId: string }>;
  signRequest(canonicalMessage: Uint8Array): Promise<{ signature: string }>;
  getDeviceStatus(): Promise<{ enrolled: boolean; deviceId?: string }>;
}

export const shell: ShellAPI = detectShell();
```

**Electron implementation:** uses `keytar` on the main process for keyring access; IPC bridges the 4 device-identity methods to renderer. Private key never crosses the preload boundary — renderer only gets the signature, never the key material.

**Tauri implementation:** uses `tauri-plugin-keyring` and the 7 custom commands in § 5.3.

Every call site imports `shell` from `'@/shell/api'`. Phase 3 retirement deletes the Electron branch; keeps Tauri only.

Net new code: ~250 lines of shim (TypeScript) + ~550 lines of Rust + ~150 lines of Electron main-process keyring + signing bridge.

### 5.9 What's intentionally not in the Rust layer

| Tempting to add | Why skipping | Upgrade path if needed |
|---|---|---|
| Native log file streaming | File API works in WebView2 | Add `fs:stream` only if real performance problem |
| Native PDF parser | `pdfjs-dist` works in WebView2 | Keep as-is |
| Native ZIP extraction | `jszip` works in WebView2 | Keep as-is |
| Background workers | Web Workers work in WebView2 | Keep as-is |
| Native notification center | `Notification` API works | Add `notification:default` only if UX demands it |
| OAuth/SSO flow | Per-device enrollment is v1 identity | Add tauri-plugin-oauth when compliance requires |

---

## 6. Rollout and pilot plan

### 6.1 Pre-rollout prep (Day -14 to Day 0)

Hard prerequisites. Nothing starts without all green.

| Item | Owner | Verification |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager + 4 DynamoDB tables (devices, nonces, idempotency, enrollments) provisioned | fullstack-developer + IT | `curl https://noclense-proxy.axon.com/health` → 200; DynamoDB tables visible in console |
| 10 secrets populated in AWS Secrets Manager | Enrique (admin tokens) + fullstack-developer (Ed25519 updater key) | AWS console shows all entries |
| EV Authenticode cert issued; installed in CI secrets; verified signing both `.msi` and `.exe` | Legal signatory + fullstack-developer | `signtool verify` passes on test artifacts |
| Ed25519 updater keypair generated; pubkey baked in Tauri config; privkey in Actions secret | fullstack-developer | `tauri signer verify` passes on test `latest.json` |
| Subdomain `noclense-proxy.axon.com` provisioned | IT DNS admin | `dig` returns expected CNAME |
| CI produces signed `.msi` + signed `.exe` + signed `latest.json` to test Release | fullstack-developer | GitHub Release with all artifacts |
| Enrollment CLI tool tested by Enrique; produces valid codes with/without hostname binding | fullstack-developer + Enrique | Codes resolve; hostname binding enforced |
| Tauri build installable on 1 dev machine; enrollment completes; signed request verified by proxy; auto-update cycle tested | fullstack-developer | End-to-end pass |
| Electron-via-proxy build tested; enrolled via bundled CLI; all 6 integrations functional through proxy | fullstack-developer | End-to-end pass |
| Idempotency state machine verified under synthetic concurrency | fullstack-developer | Parallel duplicate POST results in exactly 1 upstream call |
| Enrollment abuse controls verified: rate limits trip; code lockout fires after 3 failures; hostname binding enforced | fullstack-developer | Per-test evidence in Datadog |
| Pilot participants identified and briefed | Enrique | Committed for 2-week soak |
| Pilot Slack channel created | Enrique | Channel active |

### 6.2 Token rotation choreography (Day 0, T+0 through T+60)

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
- Phase-1 Electron-via-proxy builds (signed requests): **fully functional**.
- Tauri builds: **fully functional**.

### 6.3 Dual-build transition (Day 0 through Day +14)

| Environment | Electron (baked) | Electron-via-proxy | Tauri |
|---|---|---|---|
| Build | Legacy NSIS, pre-Phase-1 | NSIS with proxy-signing (Ed25519) | Tauri MSI |
| Branch | (not built after Phase 1) | `main` | `main` |
| Distribution | Not rebuilt; existing installs non-functional post-rotation | GitHub Releases `.exe` alongside `.msi` | Manual MSI download for pilot; auto-update thereafter |
| Enrollment | N/A | Bundled CLI run post-install | Tauri first-run UI |
| Update delivery | N/A | Manual download via version-check modal (GitHub Releases API check) | Auto-update via Tauri updater |
| Integration | **Non-functional** after T+45 | **Functional through proxy** | **Functional through proxy** |
| Pilot status | Should be uninstalled | Non-pilot NOC seats during pilot window | Pilot seats only |

After Day +14 AND GO-gate clears, CI stops building both Electron variants. Phase 3 begins.

### 6.4 Internal pilot program

(Dimensions unchanged from v2; metrics updated below.)

| Dimension | Plan |
|---|---|
| Pilot group size | 3–5 NOC agents including Enrique |
| Duration | 14 calendar days |
| Cadence | Daily async; weekly 30-min retro |
| Installation | Manual MSI from GitHub Release; admin-issued enrollment code per agent; auto-update thereafter |
| Fallback | If pilot user hits a blocker, revert to Electron-via-proxy with a new enrollment code |

**Tracked metrics and bars:**

| Metric | Bar |
|---|---|
| Crash count | ≤ 1/agent/week |
| Memory footprint (4h steady state) | Median RSS ≤ 200MB |
| Cold start time | ≤ 2s on pilot hardware |
| Enrollment success rate | 100% on fresh machines (≥3 tested) |
| Auto-update reach within 24h | ≥ 95% of pilot seats on latest |
| Investigation workflow completion | Yes for all agents; no regressions vs Electron-via-proxy |
| WebView2 rendering fidelity | No visible regressions vs Electron-via-proxy baseline |
| 200MB+ IndexedDB log load | Completes without quota errors |
| Proxy latency overhead (Ed25519 + DynamoDB) | ≤ 200ms vs direct call |
| Idempotency-driven duplicate-write rate | 0 (synthetic test) |
| Enrollment abuse control efficacy | All rate limits trip on synthetic abuse |

### 6.5 GO/NO-GO gate (Day +14)

**All must pass for GO:**

1. Zero unresolved P0/P1 bugs.
2. Zero unresolved security-review findings.
3. All 11 pilot metrics met.
4. Auto-update cycle exercised at least once per pilot seat successfully.
5. Enrollment flow validated on ≥3 fresh machines.
6. Per-device revocation tested end-to-end.
7. Replay prevention tested (synthetic replay rejected).
8. Idempotency state machine tested under concurrency (zero duplicate upstream calls).
9. Enrollment abuse controls verified (rate limit, lockout, hostname binding).
10. Full test suite green on main.
11. IndexedDB 200MB+ log path verified on ≥2 pilot machines.
12. Pilot consensus: "this is better than Electron-via-proxy."
13. fullstack-developer greenlight on Phase 3 execution readiness.

**NO-GO triggers:** as v2, plus enrollment flow failure rate >10%, plus idempotency state machine shows any duplicate upstream calls.

**NO-GO decision:** Enrique + fullstack-developer jointly.

### 6.6 Phase 3 — Electron retirement (Day +14 to +17)

| Step | Owner | Duration |
|---|---|---|
| Delete `electron/` directory | fullstack-developer | 1 hour |
| Remove `electron-builder` config from `package.json` | fullstack-developer | 30 min |
| Remove `keytar` dependency | fullstack-developer | 15 min |
| Remove Electron-only npm scripts | fullstack-developer | 30 min |
| Delete Electron branches from `src/shell/api.ts` | fullstack-developer | 1 hour |
| Strip `electron-builder` + related dependencies | fullstack-developer | 30 min |
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

**Frozen Electron-via-proxy NSIS retention:** 90 days unless corporate compliance mandates different.

### 6.8 Post-cutover operations

**Ownership:**

| System | Primary | Backup |
|---|---|---|
| Proxy (Lambda + API Gateway + DynamoDB) | fullstack-developer | Enrique |
| AWS Secrets Manager | Enrique | fullstack-developer |
| DynamoDB device registry | Enrique (revocation authority) | fullstack-developer |
| Enrollment code issuance CLI | Enrique | fullstack-developer |
| Tauri build + release | fullstack-developer | Enrique |
| Ed25519 updater signing key | fullstack-developer | Enrique (sealed backup) |
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

1. "Rotating a vendor admin token"
2. "Rolling back to a previous Tauri release"
3. "Diagnosing a proxy outage"
4. "Responding to auto-update failures"
5. "Ed25519 updater signing key rotation playbook"
6. "EV cert annual renewal"
7. "Issuing enrollment codes for new seats"
8. "Revoking a device credential"
9. "Auditing DynamoDB device registry for stale entries"
10. "Debugging a signature_invalid or idempotency_conflict incident"

Location: `docs/runbooks/`. Linked from main README.

### 6.10 Documentation updates (Day +14 onward)

As v2 § 6.10; unchanged.

---

## 7. Non-goals

(As v2 § 7; unchanged. Codebase restructure still flagged as out-of-scope with Codex handoff note.)

### 7.1 Per-user SSO authentication

Per-device is the identity model. Upgrade path: additive `Authorization: Bearer <jwt>` header.

### 7.2 Case library / ML on resolved investigations

Separate spec, future phase.

### 7.3 NOC workbench vision expansion

Separate initiative.

### 7.4 Codebase restructure and documentation hygiene

As v2 § 7.4. Post-Phase-3 Codex initiative.

### 7.5 Changes to the UI polish redesign

Orthogonal; runs on its own branch and cadence.

### 7.6 Cached response bodies in idempotency store

Deliberately excluded from v3. Retention-minimizing design; clients re-request content on retry. Upstream writes are correctness-protected by the state machine; response content is not cached.

---

## 8. References

(As v2 § 8; plus references to Ed25519 crates and keytar.)

**Internal:**
- `CLAUDE.md`
- `README.md`
- `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md`
- `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`
- `~/.claude/projects/.../memory/feedback_codex_review_cycle.md`
- `~/.claude/projects/.../memory/feedback_codex_workflow.md`

**External:**
- Tauri 2.x: https://tauri.app/start/
- Tauri capability system: https://tauri.app/security/capabilities/
- Tauri updater: https://tauri.app/plugin/updater/
- Tauri keyring plugin: https://tauri.app/plugin/keyring/
- WebView2 runtime: https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- DynamoDB TTL: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
- DynamoDB conditional writes: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html#WorkingWithItems.ConditionalUpdate
- Ed25519 (RFC 8032): https://datatracker.ietf.org/doc/html/rfc8032
- `ed25519-dalek` Rust crate: https://docs.rs/ed25519-dalek
- `@noble/ed25519` JS library: https://github.com/paulmillr/noble-ed25519
- `keytar` Electron keyring: https://github.com/atom/node-keytar
- `json-canonicalize` (RFC 8785): https://github.com/cyberphone/json-canonicalization

---

## 9. Appendix A — Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | EV cert procurement delays | Medium | Medium | Start procurement in Phase 0 parallel with code work |
| 2 | WebView2 version drift across NOC seats | Medium | Low | Document minimum version; `embedBootstrapper` guarantees install |
| 3 | IndexedDB quota on WebView2 insufficient for 200MB+ logs | Low | Medium | Pre-flight `StorageManager.estimate()` check; tested in Phase 2i soak |
| 4 | Lambda cold start latency unacceptable (DynamoDB adds overhead) | Low | Medium | Measured in Phase 1a gate; provisioned concurrency fallback |
| 5 | Auto-updater misfires (reboot loop on bad update) | Low | High | Signature validation; fail-safe to no-update |
| 6 | Enrollment flow friction (wrong code, expiry, keyring failure) | Medium | Low | Clear UI errors; 15-min TTL is forgiving; abuse controls bounded; re-enrollment path exists |
| 7 | DynamoDB outage blocks all authenticated proxy requests | Low | High | DynamoDB 99.99%+ historical; fail-safe; degraded-mode UI |
| 8 | Codex migration introduces regressions not caught by tests | Medium | Medium | Phase 2i 2-week soak; Codex self-assessment per commit; Claude overview review |
| 9 | fullstack-developer bandwidth insufficient | Medium | Medium | Sequential phase gates; UI redesign self-contained |
| 10 | Axon domain/GitHub org transition incomplete at Phase 0 | Medium | Low | Verify availability before committing identifier |
| 11 | Rollback to Electron needed but codebase drifted | Low | Medium | 90-day frozen NSIS; Electron code in git history |
| 12 | Path allowlist incomplete — legitimate operation rejected | Medium | Low | Enumeration during Phase 1a; CI test per op; PR review for additions |
| 13 | Idempotency state machine race or reservation timeout edge case | Medium | Medium | Phase 1a concurrency test (synthetic parallel duplicates); 60s reservation timeout handles Lambda death; 24h TTL handles permanent failures |
| 14 | Enrollment code interception (admin hands code to wrong person, malicious insider) | Low | Low | Optional hostname binding + 15-min TTL + 3-strike lockout; revocation is 30-second AWS CLI op |
| 15 | `keytar` or `tauri-plugin-keyring` binary incompatibility across Windows versions | Low | Medium | Tested in Phase 2i soak; both libraries mature and widely deployed |

**Note:** Per-device HMAC leak risk from v2 removed in v3 — asymmetric crypto means server holds no secret material.

---

## 10. Appendix B — Budget

From `docs/ops/2026-04-20-it-request-tauri-production-readiness.md`:

| Line item | One-time | Annual |
|---|---|---|
| AWS Lambda + API Gateway + Secrets Manager + CloudWatch | — | $360 |
| AWS DynamoDB (4 tables — devices, nonces, idempotency, enrollments) | — | $4 |
| EV Authenticode cert (SSL.com recommended) | — | $500 |
| Dev/staging AWS resources | — | $120 |
| DNS subdomain | — | $0 |
| GitHub Enterprise Releases | — | $0 |
| Datadog for proxy observability | — | $0 |
| **TOTAL** | **$0** | **~$984/yr** |

Budget ceiling: **$1,000/yr** (unchanged from v1).

---

## Appendix C — Path allowlist (placeholder — enumerated during Phase 1a)

To be populated during Phase 1a from current service module usage. Expected structure:

```ts
const ZENDESK_OPS = { /* enumerated ops */ };
const CONFLUENCE_OPS = { /* enumerated ops */ };
const JIRA_OPS = { /* enumerated ops */ };
```

Allowlist additions post-Phase-1a require PR review + CI test covering each new op.

---

**End of spec v3. Hard stop here. Ready for second `/codex:adversarial-review` re-review.**
