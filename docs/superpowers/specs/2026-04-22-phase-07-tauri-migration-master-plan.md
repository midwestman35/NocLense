# Phase 07 — Electron → Tauri v5.1 Migration + UI Redesign — Master Plan

**Owner:** Enrique Velazquez
**Plan date:** 2026-04-22
**Base branch:** `april-redesign` (Phase 06C just shipped; merge to `main` at end of 07G)
**Role:** Master plan. Each sub-phase gets its own slice plan under this directory.
**Supersedes for execution:** `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md` (v5.1 local-keyring design) — that doc remains the canonical architectural reference for the credential system; this master plan sequences its execution alongside the UI redesign.

---

## 1. Context and why this plan exists

NocLense today is Electron 40 + Vite/React + Vercel web preview. Credentials are
baked into the binary via `import.meta.env.VITE_*` reads at build time or held in
`localStorage`. A Vercel outage on 2026-04-18 exposed both a credential-baking
concern and a single-point-of-failure.

Two prior specs exist:

- **v4** (`docs/superpowers/specs/2026-04-20-tauri-migration-design.md`) — proposed a full AWS proxy vault (~$984/yr, 8–10 weeks).
- **v5.1** (`docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`) — explicitly supersedes v4. Credentials in OS keyring (Windows Credential Manager / macOS Keychain). $0. Fits 1–2 engineer team.

A design-language bundle (`NocLense Standalone.zip` → `design_handoff_noclense_v5_tauri/`)
lands a finalized v5.1 UI redesign (obsidian + phosphor tokens, six screens, custom
chrome) paired with the Tauri migration.

Phase 07 executes **v5.1 local keyring + v5.1 UI redesign + Electron retirement** as
a single coordinated program, sliced into 7 sub-phases (07A–07G). Rust log-parser
perf port (Phase 3 of zip) and auto-updater are **out of scope** for Phase 07 and
remain documented future work.

## 2. Decisions (confirmed with Enrique 2026-04-22)

| Decision | Resolution |
|---|---|
| Architecture | v5.1 local keyring (no AWS) |
| Scope | Tauri shell + keyring + UI redesign. NO Rust perf port, NO auto-updater. |
| Platforms | Windows + macOS |
| Staging | 7 sub-phases (07A–07G) with per-phase review gate |
| Branch | Continue on `april-redesign`; merge to `main` at end of 07G |
| Codex dispatch | User-driven Codex CLI per HANDOFF policy; Claude never executes code |
| Vercel | Kill entirely — remove `api/*`, `server/*`, `@vercel/analytics`, `@vercel/blob` |
| Gemini cadence | After each phase merge; 07G is Gemini's archive + cleanup phase |

## 3. Agent responsibilities (per HANDOFF.md role framing)

- **Claude** — writes this master plan; writes each slice plan; adversarial-reviews Codex commits per lightweight policy (one probe per plan, self-assessment per slice, deep review at phase close); approves merges. **Never implements.**
- **Codex** — receives slice plan from user; implements commit-by-commit; runs per-slice self-assessment at slice end; user pastes diffs/output back for Claude review.
- **Gemini** — after each sub-phase merges: rewrites `README.md`, `docs/USAGE_GUIDE.md`, `docs/DEVELOPER_HANDOFF.md` to reflect shipped state. At 07G: archives + removes all Electron code.

`codex:rescue` remains forbidden per HANDOFF.md.

## 4. Phase 07 readiness contracts (carried from Phase 06C sign-off)

Each must be addressed before the relevant sub-phase closes:

1. **IndexedDB persistence across Electron → Tauri.** Verify `cases` object store survives in Tauri user-data dir, or add one-shot export/import. Addressed in 07D.
2. **Env-var injection seam.** `caseLibraryBootstrap.ts` reads `VITE_GEMINI_EMBEDDING_KEY` directly. Verify Vite handling still works under Tauri; migrate to `credentials()` in 07E.
3. **`safeStorage` replacement.** Replaced by `LocalKeyringProvider` via `keyring` crate; one-shot migrator in 07D preserves existing encrypted creds.
4. **IPC surface inventory.** 16 files reference `window.electronAPI`; 07D maps each to a Tauri `invoke()` command.
5. **Reduced-motion audit preservation.** `docs/perf/reduced-motion-audit.md` claims re-verified in 07F on a Tauri build before Electron is retired.

## 5. Pre-work (before 07A starts)

Per HANDOFF.md §"Phase 06C technical-debt carried forward," three files violate
the 500-line convention and will be heavily touched by 07A. Split them first as
a **bundled pre-work commit** on `april-redesign`, titled `refactor(phase-07-prep)`:

- `src/components/correlation-graph/CorrelationGraph.tsx` — 601 lines
- `src/components/correlation-graph/graphPresentation.tsx` — 517 lines
- `src/components/workspace/NewWorkspaceLayout.tsx` — 504 lines

Scope: split by responsibility, no logic changes. Target <500 lines per file.
Dispatched to Codex as a standalone slice; not part of any sub-phase.

## 6. Phase map

```
pre-work  File-size split (CorrelationGraph, graphPresentation, NewWorkspaceLayout)
07A       Tokens + Fonts + Global Reskin             → visual foundation (dark only)
07B       Auth + Dashboard (greenfield)              → two new screens
07C       Import + Investigation Setup               → expand existing screens
07D       Tauri scaffold + Keyring + Unleashed       → v5.1 thin-MVP architecture proof
07E       Port 4 remaining vendors + wizard          → credentials system complete
07F       Custom chrome + titlebar + kill Vercel     → Tauri-only UX
07G       Electron archive (Gemini primary)          → clean Tauri-only repo
```

Each sub-phase produces its own slice plan in this `specs/` directory before any
code lands. Each sub-phase commits land on `april-redesign`.

---

## 7. Sub-phase 07A — Tokens + Fonts + Global Reskin

**Why first:** Every visual later builds on this. Doing the token swap once up
front is cheaper than token churn through each later phase.

**Scope**

- Install `@fontsource/inter-tight`, `@fontsource/geist-mono`, `@fontsource/instrument-serif`. Remove `@fontsource/dm-sans`, `@fontsource/jetbrains-mono`.
- Rewrite `src/styles/tokens.css` with obsidian + phosphor palette from zip README §Design-Tokens.
- Remove light-mode theming. App is dark only.
- Wire `tailwind.config.js` `theme.extend.colors` / `fontFamily` / `borderRadius` to CSS variables.
- Token-swap the zip "reskin" bucket (see §Repo-sweep in zip README): `LogViewer.tsx`, `LogRow.tsx`, `LogStreamHeader.tsx`, `LogTabs.tsx`, `CorrelationSidebar.tsx`, `AIButton.tsx`, `ai/AiPanel.tsx`, `ai/AiSettingsModal.tsx`, `log/*`, `correlation-graph/*`, `evidence/*`, `filter/*`, `case/*`, `timeline/*`, `zendesk/*`, `workspace/*`. No logic changes.
- Reskin Investigate Room + Submit Room (already match target layout).
- Update snapshot tests; update hex-color assertions.

**Gate** — `npm run build` green on Electron. `npm run test:run` green. Visual diff approved. Smoke test no regressions.

**Slice plan:** `docs/superpowers/specs/2026-04-22-phase-07a-tokens-reskin-design.md`

## 8. Sub-phase 07B — Auth + Dashboard (greenfield)

**Scope**

- **Auth** (zip slide 03): daemon-log bg 0.18 opacity, 420px glass card, 120px radar SVG (4s sweep + 3 blips; static under reduced-motion), Instrument-Serif welcome copy, mint "Continue as…" CTA, integration-chip row with live dots, four corner readouts. Uses existing Unleashed token flow; `secureStore` reads from Electron `safeStorage` until 07D swaps backend.
- **Dashboard** (zip slide 04): 40px titlebar spacer + 220px sidebar + main. Sidebar nav (Home/Import/Investigate/Submit) with ⌘1–4 shortcuts. Integrations list with status dots. Inter-Tight + Instrument-Serif greeting. Continue-where-left-off hero (~180px). Open investigations table (severity, sparklines, AI chips, assignee). Footer strip.
- `App.tsx` rewrite to the zip's 3-route shell: `/auth`, `/workspace`, `/case/:id`.
- Command palette (⌘K) stubbed.
- ⌘1–4 room-nav wired in workspace layout.

**Gate** — Both screens render under Electron with new tokens. ⌘K stub + ⌘1–4 work. Reduced-motion respected. Navigation tests green.

## 9. Sub-phase 07C — Import + Investigation Setup

**Scope**

- **Import Room** (zip slide 05): rebuild `WorkspaceImportPanel.tsx`. Dual card (Upload files | Paste logs), 2×2 source grid (APEX / Datadog / AWS Console / Unknown), Zendesk ticket URL row with violet CTA, 200px drop zone with drag-over glow, staged-files list.
- **Investigation Setup modal** (zip slide 06): 520px glass sheet. TICKET LOADED banner, attachments picker, customer timezone dropdown, collapsible Datadog Enrichment block (toggle, Test Connection, CNC with Discover Stations, stations/hosts input, query/filter, time-window slider with expand chips, indexes). Correlation-type multi-select chips. Initial AI context textarea.

**Gate** — All 6 screens visually complete in Electron build. File upload + Zendesk URL flows functional. Datadog actions hit current proxied endpoints.

## 10. Sub-phase 07D — Tauri scaffold + Keyring + Unleashed refactor

Executes v5.1 spec §5.1 checkpoint sequence 1.1–1.7 within this sub-phase.

**Scope**

- Scaffold `src-tauri/`: `Cargo.toml`, `src/main.rs`, `src/lib.rs`, `tauri.conf.json`. Main window loads existing React build.
- Add `keyring = "3.6"` crate (features `apple-native`, `windows-native`). Implement `src-tauri/src/commands/keyring.rs` with four commands; register in `lib.rs`. Index-entry workaround for Windows Credential Manager enumeration.
- `src/services/credentials/types.ts` — `CredentialsProvider` interface, `VendorCredentialKey` union, `CredentialNotFoundError`, `CredentialInvalidError` per v5.1 §2.2.
- `src/services/credentials/LocalKeyringProvider.ts` per v5.1 §2.3.
- `src/services/credentials/index.ts` — `initCredentials` + `credentials()` singleton. Init in `src/main.tsx` before `createRoot`.
- `src/platform/secureStore.ts` — single platform adapter; detects `window.__TAURI_INTERNALS__`; the only file importing `@tauri-apps/api`.
- Dev-only `/dev/credentials` harness (`import.meta.env.DEV` gated).
- Refactor `src/services/unleashService.ts` to use `credentials().get('unleash_bearer')` and `'unleash_assistant_id'`.
- One-shot migrator: read Electron `safeStorage` keys → write to keyring → wipe safeStorage. Marker in keyring under `__migration__v5.1__`.
- Map the 16 `window.electronAPI` call sites to Tauri `invoke()` commands: `get_crash_reports`, `open_crash_log_location`, `clear_crash_reports`, `report_error`, plus the four keyring commands. `window.electronAPI` shim preserved in `platform/` for the Electron parity path.
- Verify IndexedDB `cases` store accessible from Tauri context with an existing 100k-row fixture (Phase 07 readiness contract #1).
- npm scripts: `tauri:dev`, `tauri:build`. Keep `electron:*` scripts alive for parity.

**Gate** — v5.1 thin-MVP demo: Tauri window → `/dev/credentials` → paste Unleashed creds → live AI response in sample log. Windows Credential Manager shows `com.axon.noclense::*` entries. Electron build still works. Rust + Vitest units green.

## 11. Sub-phase 07E — Remaining vendors + FirstRunWizard + Settings

**Scope**

- Refactor `datadogService.ts`, `zendeskService.ts`, `confluenceService.ts`, `jiraService.ts`, `caseLibraryService.ts` to `credentials().get(...)`. Each gets `CredentialNotFoundError` + `CredentialInvalidError` handling.
- `src/components/onboarding/FirstRunWizard.tsx` — per v5.1 §3.1. Triggered when `credentials().list()` returns empty on boot.
- `src/components/settings/CredentialsPanel.tsx` — per v5.1 §3.2. Status dots, Rotate/Delete. Rotate uses `onChange` for in-flight pickup.
- Shared `markCredentialInvalid(key)` helper (Zustand store or context). Wired to all vendor 401/403 handlers.
- Remove all `import.meta.env.VITE_*` credential reads. Add CI grep-gate to fail future additions.
- Expand one-shot migrator for all 10 historical keys.

**Gate** — Cold Tauri boot with empty keyring → FirstRunWizard → paste all → every vendor works end-to-end. Rotation without restart. Grep asserts zero `VITE_*` credential reads.

## 12. Sub-phase 07F — Custom chrome + titlebar + Vercel removal

**Scope**

- `tauri.conf.json` window: `decorations: false`, `titleBarStyle: "Overlay"`, `hiddenTitle: true`, default 1440×900, min 1120×720.
- `src/chrome/Titlebar.tsx` — 40px, `data-tauri-drag-region`, centered title + mint pulse dot, right-side ⌘K kbd hint + user email in Geist Mono.
- `src/chrome/MacLights.tsx` — 78px spacer for native traffic lights.
- `src/chrome/WinControls.tsx` — 40×40 min/max/close with Win11 hover states.
- `src/platform/platform.ts` — `isDesktop`, `os`, `osVersion` via `@tauri-apps/plugin-os`.
- **Kill Vercel:** delete `src/api/`, `src/server/` (if present as frontend adapters), remove `@vercel/analytics` + `@vercel/blob` deps, strip Vercel analytics init calls, remove Vercel env vars from `vite.config.ts`.
- Remove Electron-specific branches from `secureStore`, `main.tsx`. (Electron directory itself retained until 07G.)
- Re-verify `docs/perf/reduced-motion-audit.md` claims on a Tauri build (readiness contract #5).

**Gate** — macOS shows native lights in correct position. Windows shows custom chrome with Win11 hover. No `@vercel/*` imports remain. No `window.electronAPI` refs outside the single platform-adapter shim. Reduced-motion audit passes.

## 13. Sub-phase 07G — Electron archive (Gemini primary)

**Scope** — Gemini executes documentation rewrites + mechanical file removal; Codex assists only if any cleanup blocks.

- Delete `electron/main.js`, `electron/preload.js`, `electron/CLAUDE.md` (default) or move to `archive/electron/` (if Enrique prefers history accessible in-tree — decide at 07G start).
- Remove `electron`, `electron-builder`, `concurrently`, `wait-on`, `cross-env` from `package.json` devDeps.
- Remove `electron:*` npm scripts.
- Remove `"main": "electron/main.js"` and the `build` block from `package.json`.
- Gemini full rewrite: README, USAGE_GUIDE, DEVELOPER_HANDOFF. Tauri-only story; no Vercel, no Electron.
- Gemini writes migration note in HANDOFF.md documenting the retirement.
- Final merge `april-redesign` → `main`. Tag `v3.0.0-tauri`.

**Gate** — `grep -ri electron .` returns zero non-archive hits. `npm install && npm run tauri:build` succeeds on both platforms. Docs read as if Electron never existed (outside one historical note).

---

## 14. Risks + mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | 07A token swap breaks ~80 files visually / in snapshots | Codex swaps tokens mechanically; Claude reviews visual diffs; tests updated same phase |
| 2 | 07B screens built before keyring exists → `secureStore` is stub | Platform adapter handles both; 07B uses Electron `safeStorage`; 07D swaps backend transparently |
| 3 | Windows Credential Manager lacks native enumeration | v5.1 §2.5 index-entry approach; documented limitation |
| 4 | `@fontsource/instrument-serif` availability | Verify at 07A start; fall back to Google Fonts `<link>` |
| 5 | IndexedDB for >50MB logs on Tauri | WebView2 supports IndexedDB; 07D verifies with 100k-row fixture |
| 6 | One-shot migrator loses creds on failure | Idempotent; safeStorage wipe only after successful keyring write; completion marker prevents re-loop |
| 7 | Tauri + Vite config differs from Electron | 07D adds Tauri branch to `vite.config.ts` |
| 8 | Electron parity during 07D–07F | `electron:*` scripts kept alive until 07G |
| 9 | 16 `window.electronAPI` refs need migration targets | 07D maps each to a Tauri command; inventory checklist in 07D slice plan |
| 10 | Vercel kill may remove shipped features silently | 07F slice plan enumerates every `api/`, `server/`, `@vercel/*` use before deletion |
| 11 | `NewWorkspaceLayout.tsx` already >500 lines; 07A reskin makes it worse | Pre-work file-size split commit addresses before 07A starts |
| 12 | Phase 06C tech-debt (case-close/resolve auto-indexing) | Not in 07 scope; tracked in HANDOFF.md for future follow-up |

---

## 15. Per-sub-phase workflow (per HANDOFF.md review policy)

For each of 07A–07G:

1. **Claude** writes slice plan → `docs/superpowers/specs/2026-MM-DD-phase-07X-<topic>-design.md`.
2. **Claude** runs one adversarial probe on the slice plan (lightweight policy).
3. **User** feeds slice plan to Codex in separate CLI session.
4. **Codex** implements commit-by-commit; runs per-slice self-assessment at slice end.
5. **User** pastes diffs/self-assessment to Claude.
6. **Claude** deep-reviews at phase close-out; YELLOWs logged as known-limitations; only NO-GO blocks.
7. On GO: Claude signs off → **Gemini** rewrites docs → slice merges to `april-redesign`.
8. Next sub-phase begins.

---

## 16. Verification strategy

- **Per sub-phase:** unit tests green; smoke test per gate; Claude deep review at phase close.
- **After 07D:** v5.1 spec §5.1 demo — Tauri window → `/dev/credentials` → Unleashed bearer → live AI response streamed on sample log.
- **After 07E:** cold-boot Tauri with empty keyring → FirstRunWizard → exercise every vendor (Unleashed, Datadog, Zendesk, Confluence, Jira) end-to-end.
- **After 07F:** signed Tauri build deployed to a test Windows seat + test Mac seat; verify chrome, no Vercel, no Electron leftovers. Reduced-motion audit re-verified.
- **After 07G:** fresh `git clone` → `npm install` → `npm run tauri:build` produces shipping artifacts on both platforms. Zero Electron refs anywhere.

---

## 17. Reuse targets — ship unchanged

Per zip README §Repo-sweep "Port as-is":

- `src/services/*Service.ts` — interfaces unchanged; only credentials line refactored in 07D/07E
- `src/contexts/{LogContext,AIContext,CaseContext,ToastContext,EvidenceContext}.tsx`
- `src/utils/parser.ts`, `src/utils/indexedDB.ts`, `src/utils/anime.ts`
- `src/components/log/LogViewer.tsx` (virtualization)
- `src/services/{logContextBuilder,promptTemplates,caseLibraryService,caseRepository,embeddingService}.ts`
- `src/components/correlation-graph/*` (Phase 06B product — reskin only in 07A)
- `src/components/case/*` (Phase 06C product — reskin only in 07A)

## 18. Out of scope (documented for future work)

- Rust log-parser perf port (Phase 3 of zip README)
- `tauri-plugin-updater` auto-update + Ed25519 signature
- EV Authenticode code-signing certificate
- Command palette (⌘K) real contents — stubbed in 07B
- Light mode — zip spec is dark-only
- AWS `RemoteVaultProvider` — reserved for v5.1 Phase-2 kick-in criteria (§5.5 of v5.1 spec)

---

**End of master plan.** Slice plans for 07A–07G land in this directory as each sub-phase begins. First write: `2026-04-22-phase-07a-tokens-reskin-design.md`.
