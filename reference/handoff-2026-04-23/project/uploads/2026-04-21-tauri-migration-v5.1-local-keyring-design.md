# Tauri Migration — v5.1 Local Keyring Design

**Status:** Proposed (awaiting Codex adversarial review)
**Date:** 2026-04-21
**Supersedes:** `2026-04-20-tauri-migration-design.md` (v4, AWS-backed vault model)
**Implementation gate:** UI Redesign must reach its component lock before any Tauri work begins. This spec captures design intent only.
**Scope:** Thin MVP — prove the local-keyring architecture end-to-end in ~2 weeks on a single developer machine. Not shippable.

---

## 1 — Goals and constraints

### 1.1 What changed between v4 and v5.1

v4 proposed an AWS-backed credential vault (Lambda + API Gateway + Secrets Manager + DynamoDB + CloudWatch + IAM) to remove credentials from the client binary and enable per-seat revocation. That design stands up real cloud infrastructure before there is a real user population to justify it.

v5.1 removes the runtime backend entirely. Credentials live in each user's OS keyring (Windows Credential Manager, macOS Keychain, Linux Secret Service) and are distributed by human onboarding. The application does not call a vault service — it reads secrets from the platform keystore at startup and on rotation events.

The trade is explicit: we give up centralized revocation and audit in exchange for zero operational burden and zero monthly spend at current team size (1–2 engineers, all internal Axon staff).

### 1.2 Design goals (preserved from v4 §1.3, reprioritized)

1. **No credentials in the binary.** Static `VITE_*` environment-variable reads at build time are gone.
2. **No credentials in committed files.** `.env` is out of the loop entirely.
3. **Per-seat revocation is possible, not automatic.** A compromised seat is revoked by rotating the shared vendor token and re-distributing — manual, documented, acceptable at current scale.
4. **Preserve the in-flight UI Redesign.** Tauri migration must not fork or freeze Redesign work. The two tracks run in parallel workspaces and rebase.
5. **Production-grade standalone.** The distributable app (Phase 2) is signed, auto-updates, and leaves no process after uninstall.
6. **Skeleton for scale.** The credential-access layer is behind an interface so a future `RemoteVaultProvider` can be dropped in without touching vendor services.

### 1.3 Explicit non-goals

- **No AWS.** Not now, not as a prerequisite. AWS returns only if the kick-in criteria in §5.5 fire.
- **No central audit log.** We rely on vendor-side audit (Datadog, Zendesk, etc. all log token usage).
- **No automatic credential rotation.** Rotation is a human process documented in runbooks.
- **No SSO integration.** Out of scope at this size.

### 1.4 Constraints

- **Team size:** 1–2 engineers for the foreseeable future. Design must not require a second headcount to operate.
- **User population:** Axon-internal only. No external users planned. No anonymous auth model required.
- **Existing codebase:** Electron + React + TypeScript. Vendor services already abstracted into `src/services/*Service.ts`. Migration replaces the shell, not the app.
- **Budget:** Thin MVP = $0. Phase 2 (Production-Ready) = ~$980/yr, deferred until kick-in.

---

## 2 — Architecture

### 2.1 Component map

```
┌──────────────────────────────────────────────────────────────┐
│ React renderer (unchanged UI, refactored service layer)      │
│                                                              │
│   FirstRunWizard ──┐                                         │
│                    ├─→ credentials() ──→ CredentialsProvider │
│   SettingsPanel  ──┤                          (interface)    │
│                    │                              │          │
│   vendorService ◄──┘                              ▼          │
│   (unleash/datadog/                      LocalKeyringProvider│
│    zendesk/confluence/                            │          │
│    jira)                                          ▼          │
│                                           invoke('keyring_*')│
│                                                   │          │
├───────────────────────────────────────────────────┼──────────┤
│ Tauri IPC boundary                                │          │
├───────────────────────────────────────────────────┼──────────┤
│ Rust core                                         ▼          │
│                                       src-tauri/src/commands/│
│                                               keyring.rs     │
│                                                   │          │
│                                                   ▼          │
│                                           `keyring` crate    │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    ▼
                          OS keystore (Credential Manager / Keychain /
                          Secret Service) — service name: com.axon.noclense
```

### 2.2 The `CredentialsProvider` interface

This is the load-bearing abstraction. Everything else in the design depends on it staying stable.

```typescript
// src/services/credentials/types.ts

export type VendorCredentialKey =
  | 'unleash_bearer'
  | 'unleash_assistant_id'
  | 'datadog_api_key'
  | 'datadog_app_key'
  | 'zendesk_admin_token'
  | 'confluence_admin_token'
  | 'jira_admin_token'
  | 'github_pat';  // used only if Phase 2 auto-update is enabled

export interface CredentialsProvider {
  get(key: VendorCredentialKey): Promise<string>;
  set(key: VendorCredentialKey, value: string): Promise<void>;
  delete(key: VendorCredentialKey): Promise<void>;
  list(): Promise<VendorCredentialKey[]>;
  onChange(cb: (key: VendorCredentialKey) => void): () => void;
}

export class CredentialNotFoundError extends Error {
  constructor(public key: VendorCredentialKey) {
    super(`Credential not found: ${key}`);
    this.name = 'CredentialNotFoundError';
  }
}

export class CredentialInvalidError extends Error {
  constructor(public key: VendorCredentialKey, public statusCode?: number) {
    super(`Credential invalid: ${key}${statusCode ? ` (HTTP ${statusCode})` : ''}`);
    this.name = 'CredentialInvalidError';
  }
}
```

**Why these choices:**

- **Union type for keys, not strings.** A typo becomes a TypeScript error, not a silent miss.
- **`get` returns `Promise<string>` — never `Promise<string | undefined>`.** Missing credentials throw `CredentialNotFoundError`. This forces every call site to decide: wizard redirect, settings-panel highlight, or error toast. An `undefined` return would let call sites quietly pass empty strings to vendor APIs.
- **Typed errors.** `CredentialNotFoundError` drives "open the settings panel." `CredentialInvalidError` drives "prompt for rotation." Callers branch on error class, not string parsing.
- **`onChange` subscription.** When the user rotates a token in Settings, in-flight vendor clients receive the new value on the next call without an app restart.
- **Singleton access pattern** (`credentials()` function in `index.ts`) over React context for vendor services. Services are module-level; they can't use hooks. The singleton keeps the access pattern uniform regardless of caller context.

### 2.3 `LocalKeyringProvider` (the MVP implementation)

```typescript
// src/services/credentials/LocalKeyringProvider.ts

import { invoke } from '@tauri-apps/api/core';
import {
  CredentialsProvider,
  VendorCredentialKey,
  CredentialNotFoundError,
} from './types';

export class LocalKeyringProvider implements CredentialsProvider {
  private static readonly SERVICE = 'com.axon.noclense';
  private cache = new Map<VendorCredentialKey, string>();
  private listeners = new Set<(k: VendorCredentialKey) => void>();

  async get(key: VendorCredentialKey): Promise<string> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const value = await invoke<string | null>('keyring_get', {
      service: LocalKeyringProvider.SERVICE,
      key,
    });
    if (value === null) throw new CredentialNotFoundError(key);

    this.cache.set(key, value);
    return value;
  }

  async set(key: VendorCredentialKey, value: string): Promise<void> {
    await invoke('keyring_set', {
      service: LocalKeyringProvider.SERVICE,
      key,
      value,
    });
    this.cache.set(key, value);
    this.notify(key);
  }

  async delete(key: VendorCredentialKey): Promise<void> {
    await invoke('keyring_delete', {
      service: LocalKeyringProvider.SERVICE,
      key,
    });
    this.cache.delete(key);
    this.notify(key);
  }

  async list(): Promise<VendorCredentialKey[]> {
    return invoke<VendorCredentialKey[]>('keyring_list', {
      service: LocalKeyringProvider.SERVICE,
    });
  }

  onChange(cb: (key: VendorCredentialKey) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(key: VendorCredentialKey): void {
    this.listeners.forEach((cb) => cb(key));
  }
}
```

**Cache notes:** The in-memory cache is populated on first read and invalidated on `set`/`delete`. It exists because keyring reads cross the IPC boundary and we call `get` on every vendor request. Cache lifetime = app process lifetime. There is no persistence layer — restarts re-read from the keystore.

### 2.4 Singleton init

```typescript
// src/services/credentials/index.ts

import type { CredentialsProvider } from './types';

let _provider: CredentialsProvider | null = null;

export function initCredentials(provider: CredentialsProvider): void {
  if (_provider) throw new Error('Credentials already initialized');
  _provider = provider;
}

export function credentials(): CredentialsProvider {
  if (!_provider) throw new Error('Credentials not initialized — call initCredentials first');
  return _provider;
}

export * from './types';
```

Init happens once in `src/main.tsx` before `createRoot(...).render(...)`.

### 2.5 Rust backend

```rust
// src-tauri/src/commands/keyring.rs

use keyring::Entry;
use tauri::command;

#[command]
pub fn keyring_get(service: String, key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
pub fn keyring_set(service: String, key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[command]
pub fn keyring_delete(service: String, key: String) -> Result<(), String> {
    let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),  // idempotent
        Err(e) => Err(e.to_string()),
    }
}

// `keyring_list` note: the `keyring` crate does not expose enumeration on Windows
// Credential Manager. Implementation approach: maintain an index entry at
// `com.axon.noclense::__index__` whose value is a JSON array of keys we've written.
// Update it on every set/delete. This is the Thin MVP approach; Phase 2 can revisit.
```

**Why `keyring` crate (not `tauri-plugin-keyring`):** Direct dependency on the well-maintained Rust `keyring` crate gives us tighter control and avoids a plugin abstraction we don't need. Four commands, ~40 LOC.

### 2.6 Vendor service refactor pattern

Before (Electron + Vite build-time env):

```typescript
const bearer = import.meta.env.VITE_UNLEASH_BEARER;
```

After (Tauri + runtime keyring):

```typescript
import { credentials, CredentialNotFoundError } from '@/services/credentials';

try {
  const bearer = await credentials().get('unleash_bearer');
  // ...use bearer
} catch (err) {
  if (err instanceof CredentialNotFoundError) {
    throw new Error('Unleashed AI credentials not configured. Open Settings → Credentials.');
  }
  throw err;
}
```

All five vendor services (`unleashService`, `datadogService`, `zendeskService`, `confluenceService`, `jiraService`) get ~10 LOC of change each. Thin MVP refactors only `unleashService`; the other four follow in Phase 2.

---

## 3 — UX surfaces (Phase 2, documented for completeness)

Thin MVP uses a dev-only debug harness (§4.1 commit 4). The real UX surfaces below are **not** built in MVP — they are documented here so the design is complete and Codex can review the full shape.

### 3.1 First-run wizard (Phase 2)

Location: `src/components/onboarding/FirstRunWizard.tsx`

Trigger: On app launch, if `credentials().list()` returns an empty array.

Form: Seven required text inputs (one per `VendorCredentialKey`, excluding `github_pat` which is optional and explained below), each with paste-from-clipboard affordance and a "show/hide" toggle. Submit writes all values via `credentials().set(...)` in parallel, then closes and lets the normal app flow continue.

No validation beyond "not empty" — vendor-side validity is discovered on first call, surfaced as `CredentialInvalidError`, and routed to the Settings panel for rotation.

### 3.2 Settings panel (Phase 2)

Location: `src/components/settings/CredentialsPanel.tsx`

Three columns: key name, status indicator (`●` green = set + last-known-good, `●` yellow = set + never-tested, `●` red = set + last call returned 401/403, `○` grey = not set), action buttons (Rotate, Delete).

"Rotate" opens a single-field dialog. On save, calls `credentials().set(...)`, which fires `onChange` listeners; in-flight vendor clients pick up the new value on next request.

Status derivation: the 401/403 signal comes from each vendor service catching auth failures and calling a shared `markCredentialInvalid(key)` helper that updates the panel's state via a small Zustand store (or context — decision deferred to implementation).

### 3.3 Auto-update prompt (Phase 2, Hybrid mode)

On update available:

1. Default path (Hybrid): if `github_pat` is set in the keyring, `tauri-plugin-updater` downloads from the private GitHub Enterprise Release using the PAT as the `Authorization: Bearer` header. Ed25519 signature on `latest.json` is verified before install.
2. Fallback path (Manual): if `github_pat` is missing or the update fetch returns 401/404, show a toast — "Update available. Download from Slack #noclense-releases." — and link to the installer in pinned channel messages.

---

## 4 — Threat model and what we accept

### 4.1 In scope

| Threat | Mitigation |
|---|---|
| Credentials in source control | Keyring-only storage; no `.env`, no `VITE_*` token reads at runtime. |
| Credentials in binary | Binary reads keyring at runtime; no baked-in secrets. |
| Credentials in process memory dump | OS-level — we rely on Windows/macOS/Linux keystore protection. Not a differentiator between v4 and v5.1. |
| Unauthorized update install (supply chain) | Ed25519 signature on `latest.json` (Phase 2). Private key lives on a single maintainer machine, offline backup. |
| Stolen laptop with app installed | OS lock screen + keyring-at-rest encryption (same threat model as SSH keys on that machine). Vendor tokens revoked on report. |

### 4.2 Accepted

| Risk | Why accepted |
|---|---|
| No per-seat credential isolation | 1–2 engineers, all internal. Shared tokens rotated on compromise. Kick-in #2/#3 triggers a move to per-seat. |
| No central audit of token usage | Vendor-side logs (Datadog, Zendesk audit) are sufficient at current scale. |
| Manual onboarding (person-to-person token handoff) | Fewer moving parts than automated provisioning. Breaks at ~5 engineers — documented as kick-in #2. |
| `keyring_list` implemented via index entry | Windows keystore doesn't natively support enumeration. The index is consistent because writes go through this same layer. Edge case: external tools modifying the keystore are not detected — acceptable, nobody else writes to `com.axon.noclense`. |

---

## 5 — Sequencing, procurement, timeline (Thin MVP scope)

### 5.1 Phase plan

Seven commits. Each stands alone, each reviewable by Codex. All land on the `tauri-migration` branch in the `NocLense-Tauri` workspace.

| # | Commit prefix | Scope | Est LOC |
|---|---|---|---|
| 1 | `phase-01(tauri): ckpt 1.1; scaffold Tauri 2.x shell over existing Vite/React` | `src-tauri/` directory, minimal `tauri.conf.json` (no updater, no signing), `Cargo.toml`, main window loads existing React app. `npm run tauri dev` launches. | ~40 Rust, ~10 JSON |
| 2 | `phase-01(tauri): ckpt 1.2; add keyring crate + Rust commands` | Add `keyring` to `Cargo.toml`, implement `keyring_get/set/delete/list` in `src-tauri/src/commands/keyring.rs`, register in `lib.rs`. Rust unit test writes/reads/deletes a dummy entry. | ~60 Rust |
| 3 | `phase-01(tauri): ckpt 1.3; CredentialsProvider interface + LocalKeyringProvider` | `src/services/credentials/types.ts`, `LocalKeyringProvider.ts`, `index.ts`. Vitest suite with mocked `invoke`. | ~120 TS, ~80 TS tests |
| 4 | `phase-01(tauri): ckpt 1.4; dev-only credentials harness` | Route `/dev/credentials` — plain form with key dropdown + value input + Save/Load/Delete buttons. Gated behind `import.meta.env.DEV`. No styling beyond existing Tailwind primitives. | ~80 TS |
| 5 | `phase-01(tauri): ckpt 1.5; refactor unleashService to use credentials()` | Replace `import.meta.env.VITE_UNLEASH_*` with `await credentials().get(...)`. Handle `CredentialNotFoundError` with user-facing message. Other vendor services untouched. | ~10 TS delta |
| 6 | `phase-01(tauri): ckpt 1.6; end-to-end AI call demo docs` | `docs/dev/tauri-mvp-demo.md`: launch → `/dev/credentials` → paste Unleashed bearer + assistant ID → AI panel → submit prompt → observe response. Screenshot-ready. | docs only |
| 7 | `phase-01(tauri): ckpt 1.7; demo polish + cleanup` | Remove stray logs, verify dev-only gate, short README section on running MVP. | ~20 TS |

### 5.2 Out of scope for Thin MVP

Explicitly called out so scope doesn't creep during implementation:

- First-run wizard UI (§3.1)
- Real Settings panel (§3.2)
- Auto-update / `tauri-plugin-updater` configuration (§3.3)
- Datadog/Zendesk/Confluence/Jira service refactor
- Authenticode code-signing
- Ed25519 update signing
- Installer build (NSIS / DMG)
- Hot credential rotation UI
- Onboarding docs for new engineers

### 5.3 Timeline

| Week | Deliverable |
|---|---|
| Week 1 (days 1–5) | Commits 1–4. Provider works, Windows Credential Manager shows entries under `com.axon.noclense::*`, harness can round-trip any `VendorCredentialKey`. |
| Week 2 (days 6–10) | Commits 5–7 + demo prep. Screen recording of end-to-end Unleashed call posted to Slack. |

Gating on UI Redesign: **no Tauri commit lands until Redesign is component-locked** so the service refactor in commit 5 targets stable interfaces.

### 5.4 Procurement

**Thin MVP: $0.** Nothing to buy.

- No code-signing cert (not distributing).
- No GitHub Releases wiring (not auto-updating).
- No AWS (nothing to host).
- Tauri, the `keyring` crate, `tauri-plugin-updater` are OSS.

The existing IT request (`docs/ops/2026-04-20-it-request-tauri-production-readiness.md`, ~$980/yr) is deferred to Phase 2. That doc should be renamed to include `phase-2` in the filename so it is not mistakenly acted on before kick-in.

### 5.5 Phase 2 kick-in criteria

The $980/yr procurement conversation starts when **any one** of the following fires:

1. **Demo accepted by management** as a direction. Signals intent to distribute beyond the implementer's machine.
2. **A second engineer joins the tool.** Validates the credential-distribution model at >1 seat; manual handoff is still fine at 2.
3. **Any non-Axon user needs access.** Changes the trust model — external users cannot receive shared tokens.
4. **First credential-compromise report.** Even a single incident invalidates "rotate via Slack DM" as a sustainable model.

None of these have fired on 2026-04-21.

### 5.6 Branch strategy

- `tauri-migration` branch, off `main`, lives in the `NocLense-Tauri` workspace.
- Weekly rebase of `origin/main` to absorb UI Redesign progress.
- **No merge to `main` during Thin MVP.** The branch is a prototype.
- If the demo is accepted and Phase 2 greenlit, merge strategy planned at that time (likely: squash-merge behind a feature flag, rollout behind an internal toggle).

---

## 6 — Implementation gate

**This spec is not a license to start coding.** Implementation is blocked on:

1. Codex adversarial review of this design completes and findings are addressed.
2. UI Redesign reaches component-lock (current status as of 2026-04-21: mid-Phase 02b.1; Phase 03 evidence exports in progress).
3. User approves the implementation plan produced by the `writing-plans` skill (not yet invoked).

Only after all three does Phase 01 commit 1.1 get written.

---

## 7 — Open questions for adversarial review

Flagged for Codex to poke at:

1. **`keyring_list` index approach** — is the "write an index entry" workaround durable, or will it drift out of sync with the real keystore under edge cases (app crash mid-write, user editing Credential Manager by hand)?
2. **Cache invalidation** — the in-memory cache in `LocalKeyringProvider` trusts its own writes. If a second app instance on the same machine modifies a credential, instance 1's cache is stale. Is that a real scenario we care about? Current answer: no (single-instance app), but worth naming explicitly.
3. **`initCredentials` singleton pattern vs. React context** — vendor services are module-level and cannot use hooks, so a singleton is natural. But test isolation is harder (global state). Is there a better pattern?
4. **Union type vs. enum for `VendorCredentialKey`** — string-literal union gives TypeScript narrowing without runtime cost but doesn't survive into Rust. Rust side uses `String` and trusts the frontend. Acceptable given we own both sides?
5. **Error class discrimination** — `CredentialInvalidError` is thrown from vendor services on 401/403, not from the provider itself. Does that split-responsibility model hold up, or does it belong centralized?

---

## 8 — Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | Drop AWS from the design entirely (v4 → v5.1) | At 1–2 engineer scale, ops cost of AWS outweighs security benefit. Kick-in criteria make the reversal explicit. |
| 2026-04-21 | Thin MVP scope: one vendor (Unleashed), dev-only harness, no wizard/Settings | Proves architecture in ~2 weeks. Any larger scope blocks on Redesign which is not done. |
| 2026-04-21 | Hybrid update mode (GitHub Releases + PAT, Slack fallback) | Reserved for Phase 2. Thin MVP has no distribution mechanism. |
| 2026-04-21 | Long-lived `tauri-migration` branch in separate workspace | Prevents fork of Redesign work; weekly rebase keeps drift bounded. |
