# Phase 07B — Tauri Scaffold + Electron Kill + Vercel Kill + v5.1 Keyring (slice plan, v1 draft)

**Parent:** `docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md` (v3)
**Keyring reference:** `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`
**Status:** v1 draft — pending Gemini pre-flight risk analysis.

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft. 10 slices covering scaffold + HTTP proxy swap (5 vendors) + file dialog + crash reporting + Electron removal + Vercel removal + smoke pass. No rollback window per user decision. |
| **v2** | **2026-04-23** | **Integrate Gemini pre-flight findings: (1) Tauri v2 capabilities/allowlist config is REQUIRED for plugin-http — added to 07B.1 scaffold; (2) vitest global mocks for `@tauri-apps/*` imports — added as 07B.2 first action to protect baseline 643 passing tests; (3) `resolveUrl()` + `import.meta.env.DEV` branching must be purged alongside `electronAPI` removal — hardcode absolute URLs; new 07B.3 slice extracts into `apiConfig.ts` before vendor swap; (4) plugin-fs readFile loads entire file into JS — explicit Rust streaming command via Tauri channels added to 07B.5 scope for >50MB files; (5) coupling: `src/utils/errorReporting.ts` added to crash-reporting scope; `src/types/electron.d.ts` added to Electron kill; (6) Vite proxy config removal pulled forward from 07B.8 to 07B.3 (prevents dev-server traffic leaking through after plugin-http lands); (7) 07B.1 + 07B.2 merged (scaffold + dev boot are coupled). Slice count stays at 10 but order/content restructured.** |

## 1. Scope

Phase 07B ends the Electron + Vercel era. On its close, `src-tauri/` is the
only runtime, credentials live in the OS keyring via Tauri's `keyring` crate,
all vendor HTTP calls bypass CORS via Tauri's HTTP plugin (not Electron IPC),
and the repo contains zero references to `electron`, `electronAPI`,
`vercel`, or `wrangler`.

**No rollback window** (user decision C6:i). `electron/` and `vercel.json`
are deleted inside this phase. If Tauri has an issue, we fix Tauri in place,
not retreat to Electron.

## 2. Current Electron / Vercel surface inventory (observed on `april-redesign` HEAD 2026-04-23)

### 2.1 `electron/` directory

```
electron/
├── CLAUDE.md       (module docs)
├── main.js         (Electron main process)
├── package.json    (Electron-scoped package.json)
└── preload.js      (preload bridge exposing window.electronAPI)
```

### 2.2 `package.json` references

- `"main": "electron/main.js"` entry point
- Scripts: `electron:dev`, `electron:build`, `electron:pack`, `electron:dist`
- Deps: `"electron": "^40.8.0"`, `"electron-builder": "^26.8.1"`
- Files array: `"electron/**/*"` pattern
- Likely unused-post-Tauri dev utilities: `concurrently`, `wait-on`, `cross-env` (keep if `tauri dev` script needs them; drop if not)

### 2.3 `src/` references to `electronAPI` (22+ call sites)

**Keyring-critical** (replace first, in 07B.3):
- `src/store/apiKeyStorage.ts` — `safeStorage` API-key persistence (load, save, migrate)

**HTTP proxy / CORS-bypass** (replace in 07B.4):
- `src/services/confluenceService.ts`
- `src/services/datadogService.ts`
- `src/services/jiraService.ts`
- `src/services/unleashService.ts`
- `src/services/zendeskService.ts` (2 call sites)
- `src/services/providers/UnleashProvider.ts`

**Dev-mode URL branching** (v2 addition — same vendor files, independent of Electron):
- All of the above ALSO contain `import.meta.env.DEV` branches that resolve to relative proxy paths (`/ai-proxy`, `/zendesk-proxy`, `/confluence-proxy`, `/datadog-proxy`, `/jira-proxy`). `@tauri-apps/plugin-http` requires **absolute URLs**. These branches must be purged when the Electron IPC path is removed.
- Centralize all resolved URLs in new `src/services/apiConfig.ts` (07B.3) before the vendor HTTP swap lands in 07B.4 — prevents hunting branching logic across 5 files.

**Crash reporting** (replace or retire in 07B.6):
- `src/components/CrashReportsPanel.tsx` — `getCrashReports`, `openCrashLogLocation`, `clearCrashReports`
- **`src/utils/errorReporting.ts:28–35` (v2 addition; missed in v1)** — `window.electronAPI?.reportError` call from the global error handler. Must be rewired to a Tauri command OR to a no-op that logs to `console.error` + appends to app local data dir.

**TypeScript declarations** (delete in 07B.7):
- **`src/types/electron.d.ts` (v2 addition)** — declares `electronAPI` on `Window`. File must be deleted when 07B.7 removes the last consumer.

### 2.4 Vercel / web-hosting surface

- `vercel.json`
- `.vercelignore`
- `.vercel/` local config dir
- `api/` (likely Vercel serverless function directory — verify contents during 07B.8)
- `wrangler.toml` (Cloudflare Workers config — verify contents; may be unrelated to Vercel)

### 2.5 `vite.config.ts`

- `base: './'` comment says "Important for Electron - use relative paths"
- Need to audit whether Tauri has the same relative-path requirement. The `@tauri-apps/vite-plugin` may set this automatically; confirm during 07B.1.

## 3. Slice breakdown (10 slices)

### Slice 07B.0 — pre-work: survey + doc archive

**Commit:** `chore(phase-07b-prep): archive Electron-era CLAUDE.md + inventory Electron/Vercel removal targets`

- Move `electron/CLAUDE.md` → `docs/archive/electron-era/electron-module-docs.md`
- Create `docs/archive/electron-era/` directory
- Survey `api/` contents — write a one-line note in the slice plan about each file's purpose so 07B.8 knows what it's deleting (some `api/` files may be cached Unleashed proxy routes; others may already be dead)
- Survey `wrangler.toml` — note whether it's actively used for Cloudflare Worker deploy or residue
- Don't delete anything yet. This slice is inventory only.

**Gate:** `npm run build` green (docs move shouldn't touch anything).

### Slice 07B.1 — Tauri scaffold + dev boot + capabilities config (v2 merged)

**Commit:** `feat(phase-07b): ckpt 07B.1; scaffold src-tauri/ + wire tauri:dev + configure plugin-http capabilities`
**Agent:** refactor | Support: code-review

v2: merges old 07B.1 (scaffold) + 07B.2 (boot verification) into one slice
since they're coupled and add **critical Tauri v2 capabilities config**
that v1 missed.

Setup:
- `npm install --save-dev @tauri-apps/cli` (Tauri v2 stable)
- `npm install @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-http @tauri-apps/plugin-fs`
- Run `npx tauri init` — answers:
  - App name: `noclense`
  - Window title: `NocLense`
  - Web assets dir: `../dist`
  - Dev server URL: `http://localhost:5173`
  - Before-dev command: `npm run dev`
  - Before-build command: `npm run build`

`src-tauri/tauri.conf.json`:
- Window defaults: 1280×800 (per handoff `NocLense Standalone.html` CSS minimum-width)
- Title bar: native for now (custom-chrome work lands in 07I)
- **Identifier: `com.axon.noclense`** — MUST match the `service` string used by the keyring crate in 07B.2 to ensure per-app OS keystore isolation
- Minimum size: 1100×700

**`src-tauri/capabilities/default.json` (v2 — REQUIRED, was missing in v1):**

Tauri v2 enforces an explicit outbound request allowlist for `plugin-http`.
Without capabilities config, all `fetch()` calls are silently blocked at OS
level. Add default capability with explicit vendor domains:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-read-text-file",
    "http:default",
    {
      "identifier": "http:allow-fetch",
      "allow": [
        {"url": "https://**.unleash.axon.com/**"},
        {"url": "https://**.zendesk.com/**"},
        {"url": "https://**.datadoghq.com/**"},
        {"url": "https://**.atlassian.net/**"},
        {"url": "https://generativelanguage.googleapis.com/**"}
      ]
    }
  ]
}
```

(Exact domain patterns confirmed during 07B.4 vendor audit. Starting allowlist
shown above — may need additions.)

Dev boot verification:
- Verify `npm run tauri:dev` boots Tauri window pointing at Vite dev server
- Confirm React app mounts (DOM check: `document.getElementById('root').children.length > 0`)
- Confirm HMR works (edit a component, see live update in Tauri window)
- Update `vite.config.ts` base path if Tauri plugin requires it (may conflict with the existing `base: './'` Electron comment; Tauri v2 prefers absolute base for dev — confirm and document)

`tauri:dev` + `tauri:build` scripts added to root `package.json`.

Electron stays alongside through 07B.1 → 07B.6. Kill at 07B.7.

**Automated gates:** `npm run build` green; `npm run tauri:build` green (produces an empty shell app); `npm run test:run` baseline-match; `npm run lint` ≤ baseline.

**Manual user gate:** user runs `npm run tauri:dev` once; confirms Tauri window appears, React app mounts, HMR edit loop works. GO before 07B.2.

### Slice 07B.2 — Vitest Tauri mocks + v5.1 keyring (v2 restructured)

**Commit:** `feat(phase-07b): ckpt 07B.2; add vitest Tauri mocks + implement v5.1 local keyring`
**Agent:** refactor | Support: code-review

Reference: `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`

v2 additions (Gemini pre-flight Risk #2): baseline 643 passing tests will
crash in jsdom the moment any service imports `@tauri-apps/api/core` or
`@tauri-apps/plugin-*`. Protect tests FIRST, then introduce keyring code.

**Step A — Vitest global mocks.** Append to `src/test/setup.ts`:

```ts
import { vi } from 'vitest';

// Phase 07B: Tauri IPC bridge + plugins aren't available in jsdom.
// Stub globally so component tests that import vendor services don't crash.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  readTextFile: vi.fn(),
}));
```

**Step B — Keyring implementation.**

- Add `keyring` crate to `src-tauri/Cargo.toml`
- Implement Tauri commands (Rust side):
  - `keyring_get(service: String, key: String) -> Result<Option<String>, String>`
  - `keyring_set(service: String, key: String, value: String) -> Result<(), String>`
  - `keyring_delete(service: String, key: String) -> Result<(), String>`
  - `keyring_is_available() -> bool`
- **Service string MUST equal `tauri.conf.json` identifier** (`com.axon.noclense`) for OS keystore isolation. Gemini flagged this.
- Expose via `@tauri-apps/api/core` `invoke()` in TS
- Create `src/services/credentials.ts` — singleton wrapper over the keyring commands (aligned with v5.1 spec naming)
- Rewrite `src/store/apiKeyStorage.ts` to use `credentials()` singleton instead of `window.electronAPI?.getSecureStorage` etc. Consumer code in `AIContext` unchanged.
- **Migration path:** on first launch, if keyring has no values but `localStorage` has legacy API keys, migrate them then delete from localStorage. One-way. Log the migration.
- **Windows keyring gotcha** (Gemini pre-flight): Windows Credential Manager does not support enumerating keys. The v5.1 `__index__` workaround stays — keep a comma-separated key list at key `__index__` so we can iterate. Document in commit.
- Unit tests for the TS wrapper mock `invoke` calls (the global mock from Step A is used).
- Extend `src/test/setup.ts` with a `credentials()` singleton mock so component tests that pull in `AIContext` don't crash:

```ts
vi.mock('@/services/credentials', () => ({
  credentials: () => ({
    get: vi.fn(), set: vi.fn(), list: vi.fn(),
    delete: vi.fn(), onChange: vi.fn(),
  }),
  CredentialNotFoundError: class extends Error {},
  CredentialInvalidError: class extends Error {},
}));
```

**Gate:** build green; test:run baseline + any net-new keyring tests pass; lint baseline.

**Manual user gate:** User verifies round-trip — add an API key via the app UI, reboot Tauri, key is retrieved from OS keyring (Windows Credential Manager / macOS Keychain entry visible).

### Slice 07B.3 — Centralized API config + Vite proxy removal (v2 NEW)

**Commit:** `feat(phase-07b): ckpt 07B.3; add apiConfig.ts + remove dev-mode Vite proxy blocks`
**Agent:** refactor | Support: code-review

v2 addition (Gemini pre-flight Risk #1 + Optional Improvement #2 + #3). Must
land BEFORE 07B.4 so the vendor HTTP swap has clean absolute URLs to consume
and no dev-server routes to accidentally use.

**Step A — Create `src/services/apiConfig.ts`.**

Export absolute base URLs for each vendor. No env-based branching. Examples:

```ts
// src/services/apiConfig.ts
export const UNLEASH_BASE = 'https://unleash.axon.com/api';
export const ZENDESK_BASE = (subdomain: string) => `https://${subdomain}.zendesk.com/api/v2`;
export const DATADOG_BASE = 'https://api.datadoghq.com/api/v1';
export const CONFLUENCE_BASE = 'https://axon.atlassian.net/wiki/api/v2';
export const JIRA_BASE = 'https://axon.atlassian.net/rest/api/3';
// …additional endpoints as needed per vendor
```

Exact URLs confirmed during dispatch by reading each vendor service's
production URL path. The five files to mine: `unleashService.ts`,
`zendeskService.ts`, `datadogService.ts`, `confluenceService.ts`,
`jiraService.ts`. (Values are already present in those files — just lifted.)

**Step B — Replace every `if (import.meta.env.DEV) return '/*-proxy'` branch.**

Purge in these locations:
- `src/services/confluenceService.ts:30`
- `src/services/datadogService.ts:33`
- `src/services/jiraService.ts:19, :119`
- `src/services/providers/UnleashProvider.ts:214`
- `src/services/unleashService.ts:48-49, :83`
- `src/services/zendeskService.ts:40, :295`

Each replaced with `import { VENDOR_BASE } from './apiConfig'` and a
straightforward absolute URL. The Electron IPC path stays until 07B.4 — this
slice keeps the `isElectron` branch intact and only drops the `DEV` branch.

**Step C — Remove Vite dev-server proxy blocks.**

`vite.config.ts` currently has `/ai-proxy`, `/jira-proxy`, `/confluence-proxy`,
`/datadog-proxy`, `/zendesk-proxy` configured for dev-mode HTTPS CORS bypass.
With absolute URLs in apiConfig and Tauri plugin-http handling CORS in
production, these proxy blocks are dead. Delete them.

After 07B.3: `npm run dev` + browser no longer works for vendor calls (CORS
will block). That's acceptable — `npm run tauri:dev` is the supported dev
runtime from this point forward. `npm run dev` + browser remains valid for
non-vendor UI work.

**Gate:** build green; test:run baseline + apiConfig smoke tests pass; lint baseline.

### Slice 07B.4 — HTTP proxy swap (5 vendors) — v2 updated

**Commit:** `feat(phase-07b): ckpt 07B.4; replace Electron IPC HTTP proxy with @tauri-apps/plugin-http in 5 vendors`
**Agent:** refactor | Support: code-review

Vendors (in order of test coverage — easiest to verify first):
1. `src/services/unleashService.ts` (primary; best test coverage)
2. `src/services/zendeskService.ts`
3. `src/services/datadogService.ts`
4. `src/services/confluenceService.ts`
5. `src/services/jiraService.ts`
6. `src/services/providers/UnleashProvider.ts` (`isElectron` guard)

**Pattern (v2 updated):**

Before (post-07B.3 state — still has electronAPI branch, already uses apiConfig):
```ts
import { UNLEASH_BASE } from './apiConfig';
const url = `${UNLEASH_BASE}/chats`;
if (typeof window !== 'undefined' && (window as any).electronAPI) {
  const response = await window.electronAPI.proxyRequest({ url, method, headers, body });
}
```

After:
```ts
import { fetch } from '@tauri-apps/plugin-http';
import { UNLEASH_BASE } from './apiConfig';
const url = `${UNLEASH_BASE}/chats`;
const response = await fetch(url, { method, headers, body });
```

Drop `isElectron` guards entirely. No runtime branching.

**Capability allowlist check (v2 addition):** before commit, verify every
domain referenced in vendor services appears in `src-tauri/capabilities/default.json`
`http:allow-fetch` list. If any vendor URL isn't covered, add it. Halt if
audit isn't performed — silent OS-level blocks are the failure mode.

**Gate:** build green; test:run baseline + any vendor-service tests still pass (vitest mocks from 07B.2 Step A intercept `fetch()`); lint baseline.

### Slice 07B.5 — File dialog + FS access + Rust streaming command (v2 updated)

**Commit:** `feat(phase-07b): ckpt 07B.5; swap Electron dialog/fs for Tauri plugins + add Rust streaming read command`
**Agent:** refactor | Support: code-review

v2 explicit scope expansion (Gemini Risk #4): `@tauri-apps/plugin-fs`
`readFile` loads the entire file into a JS `Uint8Array`. For 50MB–1GB log
files this causes massive IPC bottleneck or OOM. `src/utils/parser.ts` uses a
2MB chunked stream → IndexedDB path specifically to avoid this. We need a
Rust streaming command.

**Step A — Standard dialog swap.**

- Any `window.electronAPI.openFileDialog` → `@tauri-apps/plugin-dialog` `open()`
- Any `window.electronAPI.saveFileDialog` → `save()`
- For files ≤ 50MB: `@tauri-apps/plugin-fs` `readFile()` or `readTextFile()`

**Step B — Rust streaming command for large files.**

Add a Rust command `stream_file_chunks(path: String, chunk_size_kb: u32)` that:
- Opens the file with `BufReader`
- Emits `file-chunk` events via Tauri's event system with `{ offset, bytes_base64, is_last }` payloads
- Returns total file size up front so UI can show progress

TS side uses `listen('file-chunk', handler)` from `@tauri-apps/api/event`.
Integrate into `src/utils/parser.ts`'s streaming path — replace the Electron
`readFileChunk` IPC calls with the Tauri event-based stream.

Document the chunk size (2 MB matches current Electron path). Backpressure:
UI sends an ack event after each chunk; Rust waits for ack before emitting
next chunk to prevent flooding.

**Gate:** build + tests + lint at baseline. **Manual user gate:** user imports a >100MB log file via Import room; confirms streaming works and IndexedDB fills without memory spike in Task Manager.

### Slice 07B.6 — Crash reporting + errorReporting.ts (v2 added coupling)

**Commit:** `feat(phase-07b): ckpt 07B.6; retire CrashReportsPanel + rewire errorReporting.ts`
**Agent:** refactor | Support: code-review

Two call-sites to handle (v2 added errorReporting.ts):

**A. `src/components/CrashReportsPanel.tsx`** — delete. (Recommended per v1
rationale — Tauri panic handler is adequate; panel was Electron-era debug tool.)

**B. `src/utils/errorReporting.ts:28-35`** — `window.electronAPI?.reportError` call from the global error handler. Two options:

  - **B.i (recommended):** replace with a Tauri command `report_runtime_error` that writes to `app_local_data_dir/crash-reports/<timestamp>.json`. Minimal Rust; no UI needed.
  - **B.ii:** strip the bridge entirely; let the global error boundary just `console.error` and log to the browser's IndexedDB. Zero Rust changes; loses cross-session crash trail.

Default to B.i unless user flags otherwise during 07B.6 dispatch. Keeps crash reports available even without the deleted panel.

Nav-menu entry or router reference for `CrashReportsPanel` — grep and remove if present.

**Gate:** build + tests + lint at baseline.

### Slice 07B.7 — Kill Electron (v2 added type-declaration cleanup)

**Commit:** `feat(phase-07b): ckpt 07B.7; remove Electron entirely`
**Agent:** refactor | Support: code-review

- `rm -rf electron/`
- **`rm src/types/electron.d.ts`** (v2 addition — Gemini coupling find)
- Remove from root `package.json`:
  - `"main": "electron/main.js"` entry
  - Scripts: `electron:dev`, `electron:build`, `electron:pack`, `electron:dist`
  - Deps: `"electron"`, `"electron-builder"`
  - `files` array entry: `"electron/**/*"`
- Verify `concurrently`, `wait-on`, `cross-env` are either unused or needed by `tauri:dev` — keep if used, remove if orphaned
- Run `npm uninstall electron electron-builder` to sync `package-lock.json`
- Grep assertions — halt if any match:

```
grep -rn "electronAPI" src/           # expect 0 matches
grep -rn "safeStorage" src/           # expect 0 matches
grep -rn "window\.electron" src/      # expect 0 matches
grep -rn "@electron" package.json     # expect 0 matches
```

**Gate:** build green; test:run baseline (Electron-specific tests retired — list in self-assessment); lint baseline.

### Slice 07B.8 — Kill Vercel (v2 — Vite proxy already dropped in 07B.3)

**Commit:** `feat(phase-07b): ckpt 07B.8; remove Vercel + web-hosting config`
**Agent:** refactor | Support: code-review

Based on 07B.0 inventory:
- `rm vercel.json`
- `rm .vercelignore`
- `rm -rf .vercel/`
- `rm -rf api/` (if audit confirms Vercel-only)
- `rm wrangler.toml` (if audit confirms dead)
- Remove `base: './'` from `vite.config.ts` if it was Vercel-specific (Tauri requirements confirmed in 07B.1)
- Remove any Vercel-specific `.github/workflows/` entries (audit during this slice)
- Note: Vite dev-server proxy blocks were already deleted in 07B.3 — this slice does not touch them again.
- Grep: zero references to `vercel`, `VERCEL_`, `process.env.VERCEL*`, `wrangler`, `CF_` anywhere in `src/` + config files.

**Gate:** build + test:run baseline + lint baseline. **Grep assertions:**
```
grep -rn "vercel" src/ vite.config.ts .github/ 2>/dev/null   # expect 0
grep -rn "wrangler\|CF_" src/ 2>/dev/null                    # expect 0
```

### Slice 07B.9 — Final smoke pass + self-assessment

**Commit:** `feat(phase-07b): ckpt 07B.9; phase close smoke + README update for Tauri-only`
**Agent:** refactor | Support: code-review

- Run `npm run tauri:build` clean — produces a shippable binary for the host platform
- Update `README.md`:
  - Replace `npm run electron:dev` with `npm run tauri:dev` in the "getting started" section
  - Replace Electron build instructions with Tauri build
  - Remove all Vercel / web-preview references
  - Note: this is a partial update; full README rewrite happens in 07I (Gemini)
- Update `CLAUDE.md` "Commands" section equivalently
- Per-slice self-assessment MUST include:
  - `tauri:dev` boot time
  - Keyring round-trip manual verification result (user-provided)
  - Large-file import manual verification result (user-provided)
  - Electron reference count: 0 (grep-verified)
  - Vercel reference count: 0 (grep-verified)
  - Gate tails: build, test:run, lint

**Manual user gates before 07B close:**
1. `tauri:dev` boots and renders the app
2. Import a file; confirms parse + IndexedDB works
3. Save an API key; reboot Tauri; key retrieved
4. No crashes during 10-minute walkthrough

## 4. Files that must NOT change in 07B

Per user decision A1 — keep business-logic infrastructure untouched except for the specific `electronAPI` swaps in 07B.3/4/5:

- `src/services/parser.ts` — keep parsing logic; swap only `readFile` backend in 07B.5
- `src/services/indexedDB.ts` — untouched
- `src/services/logContextBuilder.ts` — untouched
- `src/services/promptTemplates.ts` — untouched
- `src/services/caseRepository.ts` + `caseLibraryService.ts` + `embeddingService.ts` — untouched
- `src/services/redactor.ts` + `messageCleanup.ts` + `investigationExporter.ts` — untouched
- `src/contexts/**` — untouched (may have minor `apiKeyStorage` import adjustment in 07B.3, nothing else)
- `src/utils/**` except the `electronAPI` touch-points — untouched
- `src/types.ts` — untouched except `electron.d.ts` declaration cleanup in 07B.7
- `src/styles/**` — untouched (07A tokens/fonts/@theme intact)
- `src/components/**` — **UNTOUCHED in 07B.** Component rewrites start in 07C. Exception: `CrashReportsPanel.tsx` may be deleted in 07B.6.

## 5. Gates (apply to every slice)

- `npm run build` → strictly green
- `npm run test:run` → matches documented baseline (18 pre-existing failures in `EvidenceContext.test.tsx` + `caseContext.test.tsx`, no new)
- `npm run lint` → ≤ 404 errors / ≤ 15 warnings (documented baseline from 07A prep)
- `npm run tauri:build` → green (from 07B.1 onward)
- Per-slice self-assessment includes gate tails (v2.2 requirement)

## 6. Halt rules

- Any gate regression beyond baseline → halt, surface to Claude
- Any need to touch a do-not-touch path → stop, propose scope change, Claude re-plans
- Any manual user-gate failure (keyring round-trip, file import, Tauri boot) → halt, surface
- `codex:rescue` forbidden per HANDOFF policy

## 7. After 07B.9 commits

- Phase build is complete. Do NOT merge to `main` yet.
- Claude runs deep review of all 10 slices.
- On GO: Gemini runs post-phase audit + rewrites `README.md`, `docs/USAGE_GUIDE.md` sections touched by Tauri switch.
- Phase 07B merges to `april-redesign`.
- Phase 07C (port Auth) begins.

## 8. Open questions (most resolved by v2 Gemini pre-flight)

Resolved:
- ~~CORS for plugin-http~~ → **capabilities/default.json required with explicit allow-fetch list** (07B.1 Step addresses)
- ~~Streaming file read~~ → **custom Rust command with Tauri event channel** (07B.5 Step B)
- ~~Vitest / jsdom~~ → **global mocks added to `src/test/setup.ts`** (07B.2 Step A)
- ~~Keyring service name~~ → **must equal tauri.conf.json identifier `com.axon.noclense`** (07B.2)
- ~~Identifier~~ → **`com.axon.noclense`** (confirm with user at 07B.1 dispatch)

Still open (confirm during 07B.1 dispatch):
- **Tauri v2 version pin** — latest stable (check `@tauri-apps/cli` on npm at dispatch time; pin exact version so downstream sub-phases don't drift).
- **Exact vendor domain patterns** — v2 lists starting patterns in 07B.1 capabilities config; audit each vendor's production URL during 07B.4 and expand allowlist if needed.
- **Windows + macOS bundle signing** — out of scope for 07B (no release required). Flag as future work; may be Phase 08.
- **`api/` folder contents** — 07B.0 survey enumerates; if not Vercel-only (e.g., contains internal helpers), determine disposition during 07B.8.
- **`wrangler.toml` purpose** — 07B.0 survey determines whether it's an active Cloudflare deploy config or residue.
