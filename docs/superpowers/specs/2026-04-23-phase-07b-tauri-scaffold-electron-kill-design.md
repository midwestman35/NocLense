# Phase 07B — Tauri Scaffold + Electron Kill + Vercel Kill + v5.1 Keyring (slice plan, v1 draft)

**Parent:** `docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md` (v3)
**Keyring reference:** `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`
**Status:** v1 draft — pending Gemini pre-flight risk analysis.

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft. 10 slices covering scaffold + HTTP proxy swap (5 vendors) + file dialog + crash reporting + Electron removal + Vercel removal + smoke pass. No rollback window per user decision. |

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

**Crash reporting** (replace or retire in 07B.6):
- `src/components/CrashReportsPanel.tsx` — `getCrashReports`, `openCrashLogLocation`, `clearCrashReports`

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

### Slice 07B.1 — Tauri scaffold

**Commit:** `feat(phase-07b): ckpt 07B.1; scaffold src-tauri/ with Cargo + Tauri v2 config`
**Agent:** refactor | Support: code-review

- `npm install --save-dev @tauri-apps/cli` (Tauri v2)
- `npm install @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-http @tauri-apps/plugin-fs`
- Run `npx tauri init` — answers:
  - App name: `noclense`
  - Window title: `NocLense`
  - Web assets dir: `../dist`
  - Dev server URL: `http://localhost:5173`
  - Before-dev command: `npm run dev`
  - Before-build command: `npm run build`
- Adjust `src-tauri/tauri.conf.json`:
  - Window defaults: 1280×800 (per handoff `NocLense Standalone.html` CSS minimum-width)
  - Title bar: native for now (custom-chrome work lands in 07I)
  - Identifier: `com.axon.noclense` (verify with user)
- Add `tauri:dev`, `tauri:build` scripts to root `package.json`
- Keep Electron alongside for 07B.1 through 07B.6 — don't delete `electron/` yet. Tauri and Electron coexist during the migration slices; Electron kill happens at 07B.7.

**Gate:** `npm run build` green; `npm run tauri:build` green (produces an empty shell app); `npm run test:run` baseline-match; `npm run lint` ≤ baseline.

### Slice 07B.2 — Tauri dev boot + React mount verification

**Commit:** `feat(phase-07b): ckpt 07B.2; wire tauri:dev to Vite HMR; verify React renderer mounts`
**Agent:** refactor | Support: code-review

- Verify `npm run tauri:dev` boots Tauri window pointing at Vite dev server
- Confirm React app mounts (check DOM: `document.getElementById('root').children.length > 0`)
- Confirm HMR works (edit a component, see live update in Tauri window)
- Update `vite.config.ts` base path if Tauri plugin requires it
- Document any Tauri-specific Vite adjustments in commit message

**Manual user gate:** User launches `npm run tauri:dev` once; confirms app mounts and HMR works. Codex can't verify this headless; user gives GO before Codex proceeds to 07B.3.

**Automated gates:** build green, tests + lint at baseline.

### Slice 07B.3 — v5.1 local keyring

**Commit:** `feat(phase-07b): ckpt 07B.3; implement v5.1 local keyring via Tauri keyring crate + refactor apiKeyStorage.ts`
**Agent:** refactor | Support: code-review

Reference: `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`

- Add `keyring` crate to `src-tauri/Cargo.toml`
- Implement Tauri commands:
  - `keyring_get(service: String, key: String) -> Result<Option<String>, String>`
  - `keyring_set(service: String, key: String, value: String) -> Result<(), String>`
  - `keyring_delete(service: String, key: String) -> Result<(), String>`
  - `keyring_is_available() -> bool`
- Expose via `@tauri-apps/api/tauri` `invoke()` in TS
- Rewrite `src/store/apiKeyStorage.ts` to use keyring commands instead of `window.electronAPI?.getSecureStorage` etc. Behavior contract unchanged — consumer code in `AIContext` doesn't change.
- **Migration path:** on first launch, if keyring has no values but `localStorage` has legacy API keys, migrate them to keyring then delete from localStorage. Log the migration. One-way; no fallback back to localStorage.
- Add unit tests for the TS wrapper (mock the `invoke` calls).

**Gate:** build green; tests baseline + new keyring tests pass; lint baseline.

**Manual user gate:** User verifies round-trip — add API key, reboot Tauri, key is retrieved from OS keyring (Windows Credential Manager / macOS Keychain).

### Slice 07B.4 — HTTP proxy swap (5 vendors)

**Commit:** `feat(phase-07b): ckpt 07B.4; replace Electron IPC HTTP proxy with @tauri-apps/plugin-http in 5 vendors`
**Agent:** refactor | Support: code-review

Vendors (in order of test coverage — easiest to verify first):
1. `src/services/unleashService.ts` (primary; best test coverage)
2. `src/services/zendeskService.ts`
3. `src/services/datadogService.ts`
4. `src/services/confluenceService.ts`
5. `src/services/jiraService.ts`
6. `src/services/providers/UnleashProvider.ts` (isElectron guard)

**Pattern for each file:**

Before:
```ts
if (typeof window !== 'undefined' && (window as any).electronAPI) {
  const response = await window.electronAPI.proxyRequest({ url, method, headers, body });
}
```

After:
```ts
import { fetch } from '@tauri-apps/plugin-http';
const response = await fetch(url, { method, headers, body });
```

Tauri's `plugin-http` bypasses CORS at the OS level (same mechanism Electron's
main-process proxy used). No allowlist config needed for this phase; a later
hardening phase can narrow origin policy if required.

Remove the `isElectron` guards entirely. No runtime branching — Tauri is the
only runtime.

**Gate:** build green; test:run baseline + any vendor-service tests still pass; lint baseline. **No new lint introduced from removing `(window as any).electronAPI` — deliberately typed removal.**

### Slice 07B.5 — File dialog + FS access swap

**Commit:** `feat(phase-07b): ckpt 07B.5; swap Electron dialog for @tauri-apps/plugin-dialog + plugin-fs`
**Agent:** refactor | Support: code-review

Affected paths (audit-driven — enumerate during dispatch):
- Any `window.electronAPI.openFileDialog` → `@tauri-apps/plugin-dialog` `open()`
- Any `window.electronAPI.saveFileDialog` → `save()`
- Any `window.electronAPI.readFile` → `@tauri-apps/plugin-fs` `readFile()` / `readTextFile()`

Streaming reads for large files (50MB+): `src/utils/parser.ts` uses a 2MB
chunked read for the IndexedDB streaming path. Verify Tauri `plugin-fs` can
stream — if not, use a Rust command that emits chunks as events. Document
the chosen approach in the commit message.

**Gate:** build + tests + lint at baseline. **Manual user gate:** user opens a >50MB log file via the Import room; confirm streaming works and IndexedDB fills.

### Slice 07B.6 — Crash reporting decision

**Commit:** `feat(phase-07b): ckpt 07B.6; port or retire CrashReportsPanel`
**Agent:** refactor | Support: code-review

Two options — decide in 07B.6 slice dispatch:

**A. Port to Tauri** — implement crash capture via `panic::set_hook` in Rust, write to `app_local_data_dir`, expose read/clear/open via Tauri commands. Keep `CrashReportsPanel.tsx` with swapped backend.

**B. Retire** — delete `CrashReportsPanel.tsx`, the corresponding nav entry (if any), and the Electron-era crash log code. Restore later if Tauri's built-in crash reporting is insufficient.

**Recommendation:** B. Tauri has reasonable panic handling built in; the panel was added as an Electron-era debugging utility. Delete unless user flags a specific need during 07B.6 dispatch.

**Gate:** build + tests + lint at baseline.

### Slice 07B.7 — Kill Electron

**Commit:** `feat(phase-07b): ckpt 07B.7; remove Electron entirely`
**Agent:** refactor | Support: code-review

- `rm -rf electron/`
- Remove from root `package.json`:
  - `"main": "electron/main.js"` entry
  - Scripts: `electron:dev`, `electron:build`, `electron:pack`, `electron:dist`
  - Deps: `"electron"`, `"electron-builder"`
  - `files` array entry: `"electron/**/*"`
- Verify `concurrently`, `wait-on`, `cross-env` are either unused or needed by `tauri:dev` — keep if used, remove if orphaned
- Run `npm uninstall electron electron-builder` to sync `package-lock.json`
- Grep: zero remaining `window.electronAPI`, `electronAPI`, `safeStorage`, or `isElectron` references anywhere in `src/`. Halt if any remain.
- Update `src/types.ts` or `src/electron.d.ts` if they declared `electronAPI` on `Window` — delete those declarations

**Gate:** build green; test:run baseline (some Electron-specific tests may need retiring — list them in self-assessment); lint baseline. **Grep assertions** (commit checkpoint, not just gate):
```
grep -rn "electronAPI" src/           # expect 0 matches
grep -rn "safeStorage" src/           # expect 0 matches
grep -rn "window\.electron" src/      # expect 0 matches
grep -rn "@electron" package.json     # expect 0 matches (no @electron/* packages)
```

### Slice 07B.8 — Kill Vercel

**Commit:** `feat(phase-07b): ckpt 07B.8; remove Vercel + web-hosting config`
**Agent:** refactor | Support: code-review

Based on 07B.0 inventory:
- `rm vercel.json`
- `rm .vercelignore`
- `rm -rf .vercel/`
- `rm -rf api/` (if audit confirms Vercel-only)
- `rm wrangler.toml` (if audit confirms dead)
- Remove `base: './'` from `vite.config.ts` if it was Vercel-specific (Tauri may have its own base requirements — confirm in 07B.2 learnings)
- Remove any Vercel-specific `.github/workflows/` entries (audit during this slice)
- Grep: zero references to `vercel`, `VERCEL_`, `process.env.VERCEL*`, `wrangler` anywhere in `src/` + config files

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

## 8. Open questions (surface during Gemini pre-flight)

- **07B.1 Tauri v2 version pin** — latest stable at 2026-04-23?
- **Identifier naming** — `com.axon.noclense` for `tauri.conf.json`? Or different bundle ID?
- **Keyring service name** — `com.axon.noclense` or `NocLense`? Affects where Windows Credential Manager shows the entries.
- **CORS for plugin-http** — does Tauri v2 still require explicit `allowlist` entries in `tauri.conf.json` for HTTP origins? If so, enumerate required origins in 07B.4.
- **Streaming file read** — does `@tauri-apps/plugin-fs` support streaming, or do we need a custom Rust command emitting chunks as events?
- **Test environment** — vitest runs in jsdom. `@tauri-apps/api` calls fail in jsdom unless mocked. Need a test setup shim to stub `invoke()` for all Tauri commands.
- **Windows + macOS bundle signing** — out of scope for 07B (no release required), but flag as future work.
