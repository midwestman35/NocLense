# Phase 07 — Tauri Port + Redesign — Master Plan (v3)

**Owner:** Enrique Velazquez
**Plan date:** 2026-04-22 (v1) → 2026-04-23 (v3)
**Base branch:** `april-redesign` (Phase 06C shipped; merge to `main` at end of 07I)
**Role:** Master plan. Each sub-phase gets its own slice plan under this directory.

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-22 | Initial: 07A tokens → 07G Electron archive. Built against `NocLense Standalone.zip` deck (15-slide pre-Tauri lock-in). |
| v2 | 2026-04-22 | Phase loop locked (Gemini pre-flight → Claude finalize → Codex build → Claude review → Gemini audit + docs). |
| v3 | 2026-04-23 | Full re-sequence after user correction. New primary design source is the Claude Design handoff bundle at `reference/handoff-2026-04-23/` (JSX component files, not a deck). Four rooms (Import / Setup / Investigate / Submit) + Auth + Dashboard top-level screens, all greenfield. Tauri scaffold + Electron kill + Vercel kill compressed into 07B (same phase, no rollback window per user direction C6:i). 07A.4–07A.7 reverted (reskin on doomed components); 07A pre-work split reverted (file is deleted during port). 07A now stops at 07A.3. |
| **v4** | **2026-04-23** | **Insert 07J — UI Review + Testing Runbooks + Claude Code Automation.** Sequenced between 07H and 07I at user direction. Triggered by focus-shift: once the full surface (Auth + Dashboard + 4 rooms) is ported at end of 07H, build a reusable QA + automation layer before final chrome/docs. 07J deliverables: (a) standalone-ship inventory, (b) manual runbooks per screen, (c) broad Claude Code automation — Playwright-Tauri harness, slash commands, settings.json hooks, agent workflows, MCP surface, and asset-driven navigation so Claude can drive the entire app without human babysitting. 07I scope unchanged; batch map re-cut accordingly (see omnibus dispatch doc). |
| **v5** | **2026-04-23** | **Design pivot: auth descoped.** SSO not approved; distribution is closed (package hand-delivered to selected users). No credentials, no identity provider, no session tokens. 07C.1 Auth screen gets reworked into a minimalist premium splash (logo + tagline + single Continue CTA) under new slice **07C.2 Splash rework**, inserted between Batch C close and Batch D (07J) kickoff. §8 and §9 updated to reflect the descope. 07J.1 inventory row for real auth identity provider integration is removed from carry-forward (nothing to defer). |

## 1. Context

NocLense today is Electron 40 + Vite/React + Vercel web preview + mixed
credential storage (env vars, localStorage, Electron safeStorage). The
2026-04-23 Claude Design handoff set a new direction: **exclusively
standalone desktop, no web hosting, built on Tauri v2 with local keyring.**
The existing `src/components/` tree is replaced wholesale; `src/services/`,
`src/contexts/`, `src/utils/` survive as business-logic infrastructure.

Authoritative design source: `reference/handoff-2026-04-23/project/` —
`NocLense Standalone.html` (CSS + shell) plus `app.jsx`, `auth.jsx`,
`dashboard.jsx`, `primitives.jsx`, `design-canvas.jsx`, `rooms-shared.jsx`,
and `room-{import,setup,investigate,submit}.jsx`. Per handoff README, match
visual output, do not copy internal structure unless it fits our stack.

The `gx-*.jsx` + `DESIGN.md` variant (NocLense GX / Material 3 / Plus Jakarta
Sans) is NOT the primary direction and will be ignored unless we explicitly
revisit.

Keyring architecture: v5.1 local-only (per
`2026-04-21-tauri-migration-v5.1-local-keyring-design.md`), **not** the v4
AWS proxy. Zero backend, $0 recurring.

## 2. Sub-phase map (v3)

| # | Scope | Status |
|---|---|---|
| **07A** | Tokens + fonts + Tailwind v4 `@theme` infra (obsidian + phosphor, dark-only) | SHIPPED. 4 commits kept (`4631955`, `c09155e`, `8c0e17c`, `ab84d7e`). `07A.4–07A.7` + pre-work split reverted at `b0246d5`. |
| **07B** | **Tauri scaffold + Electron kill + Vercel kill + v5.1 keyring** | Next. No rollback — delete Electron + Vercel files Day 1 of 07B, fix Tauri incrementally. |
| **07C** | Port **Auth screen** from `reference/handoff-2026-04-23/project/auth.jsx`, then rework to premium splash | 07C.0 primitives rebuild SHIPPED (`7d3b379`). 07C.1 Auth port SHIPPED (`42f3718`). **07C.2 Splash rework NEXT** — auth descoped per v5 revision; screen becomes logo + tagline + Continue CTA (closed distribution, no credentials). |
| **07D** | Port **Dashboard** from `dashboard.jsx` | Greenfield. Reads existing Case Library + recent investigations. |
| **07E** | Port **Import Room** from `room-import.jsx` | Replaces existing Import Room; rewires to existing `parser.ts` + `indexedDB.ts`. |
| **07F** | Port **Setup Room** from `room-setup.jsx` | NEW 4th room — Investigation Setup is promoted from modal to room. Rewires to Zendesk/Datadog/attachment services. |
| **07G** | Port **Investigate Room** from `room-investigate.jsx` | Full feature parity: virtualized log stream, correlation graph (G6), AI assistant, evidence panel, similar-tickets, citation jump, filter chips. Replaces `NewWorkspaceLayout` investigate bucket. |
| **07H** | Port **Submit Room** from `room-submit.jsx` | Full feature parity: closure note + evidence summary + handoff. Replaces existing Submit. Phase dots restructured 3→4. |
| **07J** | **UI Review + Testing Runbooks + Claude Code Automation** (v4 insert) | Focus-shift sub-phase. Inventory standalone-ship remainder; author manual runbooks per screen; build a broad, asset-driven Claude Code automation harness so Claude can drive the entire app. Slice plan: `docs/superpowers/specs/2026-04-23-phase-07j-review-and-test-infra-design.md`. |
| **07I** | Final native chrome + Electron archive + README/docs rewrite (Gemini primary) | End of phase. Merge to `main`. |

## 3. Agent responsibilities (per HANDOFF.md role framing, locked 2026-04-22)

- **Claude — CEO / Architect.** Writes master plan; writes each slice plan; integrates Gemini pre-flight; adversarial-reviews Codex commits; gives final GO / NO-GO. Never implements. Owns direction + correctness.
- **Codex — CTO / Executor.** Executes finalized slice plans; commits incrementally; runs build / test / lint; reports status + per-slice self-assessment. Owns implementation + delivery.
- **Gemini — Research + Audit.** Pre-flight risk analysis before each sub-phase. Post-phase audit + docs rewrite after Claude GO. At 07I: Electron archive removal + README rewrite.

**Phase loop (per sub-phase):** `Gemini pre-flight → Claude finalize → Codex build → Claude review → Gemini audit + docs`

`codex:rescue` remains forbidden per HANDOFF.md.

## 4. What survives from the current codebase

**KEPT** (business-logic infrastructure, per user decision A1):
- `src/services/**` — `parser.ts`, `indexedDB.ts`, `unleashService.ts`, `logContextBuilder.ts`, `promptTemplates.ts`, `caseRepository.ts`, `caseLibraryService.ts`, `embeddingService.ts`, all provider stubs, `zendeskService.ts`, `datadogService.ts`, `confluenceService.ts`, `jiraService.ts`, `investigationExporter.ts`, `redactor.ts`, `messageCleanup.ts`
- `src/contexts/**` — `LogContext`, `AIContext`, `EvidenceContext`, `CaseContext` (store), `RoomLiveStateContext`. May be refactored during room ports but not rewritten.
- `src/utils/**` — `anime.ts`, `theme.ts`, `errorReporting.ts`, `indexedDB` helpers, hooks. Kept; individual helpers may be retired if the new components don't need them.
- `src/types.ts` — `LogEntry` interface + related. Canonical data contract.
- `src/styles/tokens.css` + `src/styles/index.css` — 07A shipped state stays.
- `src/hooks/**` — kept.

**REPLACED** in 07C–07H (greenfield against handoff JSX):
- `src/components/**` — EVERYTHING below `src/components/` gets rebuilt except legitimate primitives we choose to keep (TBD per port slice). `ui/*` primitives will likely be rebuilt entirely since the handoff's `primitives.jsx` is the new design system.

**DELETED** in 07B (no rollback):
- `electron/**` — main process, preload, builder config. Gone.
- `package.json` scripts: `electron:dev`, `electron:build`, `electron:dist`.
- `@electron/*` and `electron-*` dependencies from `package.json`.
- `vercel.json`, `.vercelignore`, `.vercel/`, `api/` (if Vercel-only), any Vercel-specific config.
- `wrangler.toml` (if Cloudflare worker is also dead — check with user during 07B dispatch).

## 5. 07B scope in detail

Combined scaffold + kill phase. Slices TBD in 07B slice plan but roughly:

| Slice | Scope |
|---|---|
| 07B.0 pre-work | Move `docs/USAGE_GUIDE.md` Electron references to archive; ensure no undocumented dependencies on `electron/main.js` from `src/` |
| 07B.1 | `npm run tauri init` → scaffold `src-tauri/` with Cargo, basic window config, dev-server wiring to Vite |
| 07B.2 | Wire `tauri dev` command; verify Vite HMR works inside Tauri webview; confirm React app mounts |
| 07B.3 | Implement v5.1 local keyring (Tauri `keyring` crate) + TypeScript bindings; swap out `safeStorage` calls in `src/services/` |
| 07B.4 | Port file-picker from Electron IPC to Tauri `@tauri-apps/api/dialog`; update `parser.ts` stream handling if needed |
| 07B.5 | Remove Electron — delete `electron/`, remove `electron:*` scripts, uninstall `electron*` deps, remove references from Vite config |
| 07B.6 | Remove Vercel — delete `vercel.json`, `.vercelignore`, `.vercel/`, `api/`, `wrangler.toml` (if applicable). Update `vite.config.ts` base path if it was Vercel-specific. |
| 07B.7 | Smoke pass: `tauri dev` launches; Import room loads; keyring round-trip works; no dead Electron imports anywhere |

Gates per slice: `npm run build`, `npm run test:run` baseline-match (18 pre-existing failures from Phase 06), `npm run lint` ≤ baseline, `npm run tauri build` green once 07B.1 lands.

## 6. 07C–07H scope — port pattern

Each port slice follows this pattern:

1. **Read the target JSX file in full** (`reference/handoff-2026-04-23/project/<name>.jsx`). Codex uses it as visual + structural spec.
2. **Read the surrounding JSX files** it imports from (`primitives.jsx`, `rooms-shared.jsx`, `design-canvas.jsx`).
3. **Identify which existing services/contexts feed the screen** (e.g., `room-investigate.jsx` wires to LogContext, AIContext, CaseContext, EvidenceContext).
4. **Re-implement in our stack** — React 19 + TypeScript strict + Tailwind v4 + our existing services. Use handoff JSX as reference for layout, motion, copy, data shape. Do NOT copy its file structure (no Babel standalone, no CDN React, no inline JSX files).
5. **Unit + integration tests** where the component has behavior to verify.
6. **Visual smoke pass** (user-driven, `npm run tauri dev` by 07C onward since Tauri landed in 07B).

Handoff constraint: *"Match visual output; don't copy internal structure unless it happens to fit."*

## 7. 07I — Final cleanup (Gemini primary)

- Rewrite `README.md` to reflect Tauri-only, standalone-only posture
- Rewrite `docs/USAGE_GUIDE.md` for the new 4-room flow
- Rewrite `docs/DEVELOPER_HANDOFF.md` for Tauri dev workflow
- Archive historical Electron-era docs under `docs/archive/electron-era/`
- Final folder hygiene pass
- Merge `april-redesign` → `main`

## 8. Out of scope for Phase 07

- Rust log-parsing perf port (keep TypeScript parser; revisit only if 100k-entry render stutters in Tauri)
- Tauri auto-updater (defer to Phase 08 or later)
- Mobile / Linux builds (Windows + macOS only)
- Telemetry / analytics wiring (separate phase)
- **Auth / identity provider integration — DESCOPED ENTIRELY (v5, 2026-04-23).** Distribution is closed: the Tauri bundle is hand-delivered to selected users. No login, no credentials, no session tokens, no SSO. The auth screen from 07C.1 is reworked in 07C.2 into a minimalist premium splash (logo + tagline + Continue CTA). Nothing to carry forward to Phase 08.

The remaining four items are catalogued + prioritized in **07J.1 Standalone inventory** so they carry forward with a known disposition (deferred / next-phase / post-merge). 07J.1 also captures YELLOWs accumulated during 07B–07H and any ports/features deliberately descoped mid-stream.

## 9. Open questions (resolve during sub-phase dispatches)

- ~~**07C Auth flow:** real identity provider (OIDC? local credentials hashed + stored via keyring?) or UI stub that always succeeds?~~ **Resolved v5 (2026-04-23): descoped entirely.** Closed distribution → no auth layer. 07C.2 reworks the screen into a premium splash.
- **07D Dashboard data:** does it surface existing Case Library cases, recent investigations, neither, or something new? Read `dashboard.jsx` during 07D dispatch.
- **Keep or replace `ui/*` primitives:** the handoff has its own `primitives.jsx` (Button, Input, Card, Chip, Tag, Kbd, Field). Decision: discard our current `src/components/ui/*` wholesale and rebuild from handoff — OR keep the API, re-skin the internals. Settle at 07C dispatch when we first need primitives.
- **Phase 06C Case Library format:** does it carry forward unchanged? Check IndexedDB schema against Dashboard's data expectations at 07D.

## 10. Per-sub-phase workflow (phase loop locked 2026-04-22)

For each of 07B–07I:

1. **Claude** drafts slice plan → `docs/superpowers/specs/2026-MM-DD-phase-07X-<topic>-design.md`
2. **Gemini pre-flight.** Reads the draft. Returns top risks, blind spots, optional improvements.
3. **Claude finalizes.** Integrates Gemini findings + runs one adversarial probe + bumps revision.
4. **User** feeds the finalized plan to Codex in a separate CLI session.
5. **Codex builds.** Commit-by-commit. Runs build / test / lint after each. Halts on any regression. Includes gate tails in self-assessment.
6. **User** pastes Codex diffs + self-assessment back to Claude.
7. **Claude reviews.** Deep review at phase close. YELLOWs logged as known-limitations; only NO-GO blocks.
8. **Gemini audit + docs.** On GO: runs post-phase audit + rewrites affected docs.
9. Sub-phase merges into `april-redesign`. Next sub-phase begins at step 1.

## 11. Commit labeling conventions

- Planning docs: `docs(phase-07X): ...`
- Sub-phase amendments: `docs(phase-07X): vN.M — <summary>`
- Codex implementation: `feat(phase-07X): ckpt 07X.N; <imperative summary>`
- Pre-work (tech debt, baseline fixes): `fix(phase-07X-prep): ...` or `refactor(phase-07X-prep): ...`
- Port commits specifically: `feat(phase-07X): port <screen/room> from handoff`

## 12. Exit criteria for Phase 07 (merge to main)

- `electron/` does not exist in the repo
- `vercel.json`, `.vercel/`, and Vercel CI hooks do not exist
- `src-tauri/` exists and `npm run tauri dev` + `npm run tauri build` both succeed on Windows and macOS
- All 4 rooms + Auth + Dashboard render against new design
- Existing Phase 06 services + contexts + utils are wired to new UI without feature regressions
- `npm run test:run` at new baseline (some Phase 06 tests may be retired during ports; new tests added for new components)
- `npm run lint` at ≤ current error budget
- README + USAGE_GUIDE + DEVELOPER_HANDOFF rewritten by Gemini and reflect the shipped state
- No live references to Electron APIs, `electronAPI`, or Vercel anywhere in `src/`
- **07J deliverables landed (v4):** standalone-ship inventory exists at `docs/testing/standalone-inventory.md`; runbooks exist at `docs/testing/runbooks/` for Auth, Dashboard, Import, Setup, Investigate, Submit, and cross-cutting (keyring, theme, resize, HMR); Claude Code automation harness exists at `docs/testing/automation/` + `tools/claude-automation/` and can drive the full app end-to-end from asset input without human intervention; `/smoke-tauri` slash command green against current HEAD.
