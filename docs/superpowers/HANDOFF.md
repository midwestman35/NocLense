# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (Phase 06C closed; Phase 07 planning starts next week)
**Branch:** `april-redesign`
**Current HEAD:** `505e698` — `feat(phase-06c): Slice 3; similar cases surface + bootstrap`

> Single source of truth for resuming the current planning/review cycle in
> a fresh Claude session on any device. Read this first, then act on the
> "Immediate next step" section.

---

## Role framing

Three-agent team:

| Agent | Role | Scope |
|---|---|---|
| **Claude** (Claude Code) | CTO / Project Lead | Plans, reviews, steers architecture, approves merges |
| **Codex** (OpenAI Codex CLI) | Principal Engineer | Implements from approved plans, writes tests, commits code |
| **Gemini** (Google Gemini CLI) | Support Staff / Doc Engineer | Maintains README, USAGE_GUIDE, DEVELOPER_HANDOFF, folder hygiene |

Claude plans → Codex implements → Claude reviews → Gemini updates docs.

**Review policy (as of 2026-04-22, lightweight):**
- One adversarial probe per plan (not iterative rounds).
- Per-slice self-assessment at end of slice (not per-commit).
- Deep review at phase close-out, not mid-phase.
- YELLOWs logged as known-limitations; only NO-GO blocks.
- Security-critical slices retain the rigorous cadence (exception).

**Never:**
- Use the `codex:rescue` skill or any `/codex:*` dispatch slash-skill.
- Implement source code yourself. Claude plans + reviews; Codex implements.
- Dispatch Codex without naming a primary agent per the slice-archetype
  convention (see `docs/superpowers/feedback_codex_agent_assignments.md`).

---

## Completed phases

| Phase | What shipped | Close commit |
|---|---|---|
| 04.5 | Direction C token base, Button + WorkspaceCard curves | `d0e45c9` |
| 05 | §4.2 transition-all sweep, citation-jump, reduced-motion audit | `cefc12e` |
| 06A | Spinner primitive, anime.js guards, MotionConfig wiring, Direction C transitions, room parity, audit consolidation | `78a1e22` |
| 06B | Correlation Graph card — G6 renderer, click-to-filter, keyboard a11y, large-graph performance (WebGL threshold, clustering, zoom controls) | `1783df1` |
| 06C | Case Library — IndexedDB CaseRepository + lifecycle persistence, CaseLibraryService (Gemini embedding index + cosine similarity), SimilarCasesSection inside existing Similar card, noclense auto-indexing | `505e698` |

Phase 06A survived 7 adversarial review rounds (v1→v8 GO). Phase 06B
shipped under the new lightweight-review policy in 5 commits + 1
folder-cleanup commit. Phase 06C shipped under the same policy in
3 slice commits + 1 v2 amendment commit after round-1 Codex probe.

---

## Current state — between phases

Phase 06C shipped 2026-04-22. Phase 07 (Electron → Tauri migration)
planning starts the following week per user direction. Until then,
there is no in-flight implementation work.

**Phase 06C technical-debt carried forward:**

1. **Case-close/resolve lifecycle indexing in `caseContext`** — Slice 3
   explicitly punted this as an optional extension. Cases currently
   enter the library via `.noclense` import OR explicit
   `caseLibraryService.indexCase(case)` calls. In-app resolve
   transitions do not auto-index. This is a real gap in the
   "library fills as you resolve investigations" UX promise but is
   non-blocking for v1. A follow-up commit wiring `caseContext`
   state transitions to fire `indexCase` on `'resolved'` is the
   clean resolution.
2. **File-size convention violations** — carried forward from Phase
   06B and extended by Phase 06C:
   - `src/components/correlation-graph/CorrelationGraph.tsx` — 601 lines
   - `src/components/correlation-graph/graphPresentation.tsx` — 517 lines
   - `src/components/workspace/NewWorkspaceLayout.tsx` — 504 lines (new)
   A bundled workspace-file split commit is appropriate before Phase
   07 touches NewWorkspaceLayout for the Tauri migration.
3. **Manual in-app smoke** — create → resolve → confirm indexing
   (pending case-close extension), import → confirm appears in Past
   cases. Not run from CLI during Phase 06C; recommended
   out-of-band user check before Phase 07 dispatch.

---

## Immediate next step — plan Phase 07 (Electron → Tauri migration)

Per user direction (2026-04-22), Phase 07 planning starts the week
following Phase 06C close. No Codex dispatch until the plan lands.

**Phase 07 readiness contracts (from Phase 06C sign-off):**

1. **IndexedDB persistence across Electron → Tauri.** Phase 06C
   shipped a new `cases` object store. Tauri uses a different
   user-data-dir convention than Electron by default; Phase 07
   plan must verify the data survives migration or design a
   one-shot export/import step.
2. **Env-var injection seam.**
   `src/services/caseLibraryBootstrap.ts` reads
   `import.meta.env.VITE_GEMINI_EMBEDDING_KEY` directly. Vite
   handles this identically for Tauri builds, but `tauri.conf.json`
   adds its own env-var surface — verify on a spike that the
   bootstrap still fires.
3. **`safeStorage` replacement.** `electron/main.js` uses
   `safeStorage.encryptString` for credentials. Tauri has no direct
   equivalent; plan for `tauri-plugin-stronghold` or the `keyring`
   Rust crate behind an adapter that preserves `aiSettings.ts`'s
   layered resolution contract.
4. **IPC surface inventory.** `window.electronAPI` (from
   `electron/preload.js`) is the sole Electron bridge. Open Phase
   07 plan with a grep for `window.electronAPI` call sites and map
   each to a Tauri `invoke()` command name.
5. **Reduced-motion audit preservation.** `docs/perf/reduced-motion-
   audit.md` is the canonical record; Tauri's WKWebView (macOS) and
   WebView2 (Windows) both respect `prefers-reduced-motion` but
   the audit's claims should be re-verified on a Tauri test build.

**Agent assignments (expected, per decision table):**

- `rust-engineer` — primary for backend port slices (Tauri command
  handlers, OS integrations, credential storage)
- `typescript-pro` — primary for renderer adapter slices (IPC
  shim, env-var shim, build-config)
- `electron-pro` — secondary reviewer on "did we preserve Electron
  behavior" checks
- `data-engineer` — secondary on the IndexedDB migration slice

**Prerequisites before Phase 07 planning:**

- macOS engineering sample (IT request drafted 2026-04-22; pending
  approval). Phase 07 is blocked on this for signing/notarization
  and native-build verification.
- `rustup` toolchain installed on both dev machines.
- Xcode CLI tools on macOS; MSVC build tools + WebView2 runtime on
  Windows.

---

## After Phase 06C — Phase 07 (Tauri migration)

**Timing:** Planning starts next week per user direction (2026-04-22).

Until then, Phase 06C is the only in-flight work.

---

## Gemini documentation status

- `README.md`, `docs/USAGE_GUIDE.md`, `docs/DEVELOPER_HANDOFF.md`
  last rewritten by Gemini at `191069a` (round 2, 2026-04-22).
- Folder cleanup manifest executed at `143169d` (same day).
- Next Gemini engagement: end of Phase 06C or Phase 07 close-out
  for doc refresh.

---

## Pre-existing tech debt (not ours)

- `tsc` red on `src/contexts/logContextObject.ts` +
  `src/services/investigationExporter.ts` (pre-existing; not touched
  by Phase 06B).
- `vitest` red on `src/contexts/__tests__/EvidenceContext.test.tsx`
  and `.worktrees/ui-overhaul*/llmService.test.ts` (pre-existing).
- `act()` warnings in `src/components/__tests__/AIButton.test.tsx`
  (cosmetic).

## Phase 06B technical-debt backlog (surfaced at close-out)

- `src/components/correlation-graph/CorrelationGraph.tsx` at 601
  lines (+20% over 500-line cap); recommended split before Phase
  06C/07 extends the graph.
- `src/components/correlation-graph/graphPresentation.tsx` at 517
  lines; minor overage.
- Manual NVDA / VoiceOver smoke on Electron runtime — out-of-band
  a11y verification still pending.

---

## Posture

Tight, diagnostic, no fluff. Assume continuity — don't restart from
zero. Trust the lightweight review policy: one probe, per-slice
self-assessment, deep review at close-out.
