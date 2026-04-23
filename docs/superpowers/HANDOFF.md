# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (Phase 06C closed; work continuing on personal Mac for prototyping)
**Branch:** `april-redesign`
**Current HEAD:** `93f6f42` — `docs(superpowers): close Phase 06C + point to Phase 07 Tauri migration`

> **If you are picking this up on a fresh machine (especially the
> Mac that's now being onboarded):** read the "Machine hop — Mac
> prototyping session" block below before anything else. Claude
> memory does NOT travel between machines — the conventions stored
> in `~/.claude/projects/.../memory/` on Windows are not visible
> on Mac. This handoff is the cross-machine source of truth.

> Single source of truth for resuming the current planning/review cycle in
> a fresh Claude session on any device. Read this first, then act on the
> "Immediate next step" section.

---

## Role framing (locked 2026-04-22)

Three-agent team:

| Agent | Role | Owns |
|---|---|---|
| **Claude** (Claude Code) | **CEO / Architect** | direction + correctness. Writes phase + slice plans; integrates Gemini insights; enforces scope + architecture; reviews Codex output; gives final GO / NO-GO. |
| **Codex** (OpenAI Codex CLI) | **CTO / Executor** | implementation + delivery. Executes slice plans exactly; commits incrementally; runs build / test / lint; reports status + self-assessment. |
| **Gemini** (Google Gemini CLI) | **Research + Audit** | blind-spot surfacing + documentation. Runs pre-flight risk analysis before build; runs post-phase audit + docs after review. |

## Phase loop

```
Gemini (pre-flight)  →  Claude (finalize plan)  →  Codex (build)
                                                        │
                                                        ▼
                 Gemini (audit + docs)  ←  Claude (review)
```

Each phase and each sub-phase goes through this full loop. Pre-flight
surfaces risks before Claude commits to a plan; audit happens after
Claude green-lights the work so Gemini can both validate and document
the shipped state.

**Review policy (as of 2026-04-22, lightweight):**
- One adversarial probe per plan (not iterative rounds).
- Per-slice self-assessment at end of slice (not per-commit).
- Deep review at phase close-out, not mid-phase.
- YELLOWs logged as known-limitations; only NO-GO blocks.
- Security-critical slices retain the rigorous cadence (exception).

**Never:**
- Use the `codex:rescue` skill or any `/codex:*` dispatch slash-skill.
- Implement source code yourself (Claude). Claude plans + reviews; Codex implements.
- Dispatch Codex without naming a primary agent per the slice-archetype
  convention (see `docs/superpowers/feedback_codex_agent_assignments.md`).
- Skip Gemini's pre-flight before a phase begins build. If a phase was
  already mid-flight when this loop locked (e.g., 07A), run Gemini's
  audit retroactively and fold findings into the next slice plan rev.

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

## Machine hop — Mac prototyping session (2026-04-22 onward)

Enrique is continuing work on a personal Mac starting 2026-04-22 to
**prototype** ahead of Phase 07 planning. This is exploratory work,
**not** Phase 07 implementation.

### Scope on the Mac (what you ARE doing)

- Verify Phase 06C behavior on macOS native (create case → resolve
  → check indexing; import `.noclense` pack → check SimilarCasesSection)
- Run `npm run electron:dev` and confirm the app boots, renders, and
  persists to IndexedDB on macOS
- Visual-diff check: compare macOS WKWebView rendering vs the
  Windows build's Chromium rendering for CSS subtleties (scrollbars,
  font smoothing, flex edge cases)
- Optional: begin installing Tauri toolchain (`rustup`, Xcode CLI
  tools) so Phase 07 planning next week starts with toolchain ready
- Optional: sketch out what a Tauri port of `electron/main.js` would
  look like (scratch only — do NOT commit prototypes to the branch)

### Out of scope on the Mac (what you are NOT doing)

- Phase 07 implementation. Planning starts next week; no slice
  dispatches until then.
- Modifications to the Phase 06C surfaces (CaseRepository,
  CaseLibraryService, SimilarCasesSection, caseLibraryBootstrap).
  Phase 06C is sealed.
- Amendments to closed-phase audit docs
  (`docs/perf/reduced-motion-audit.md` Phase 06C rows).
- Codex dispatches. No Phase 07 plan exists yet; nothing to execute.

### Mac one-time setup checklist

Run these once when you first open the repo on the Mac:

```bash
# 1. Clone (already done if you're reading this via `docs/superpowers/HANDOFF.md`)
git clone <repo-url> NocLense-Mac
cd NocLense-Mac
git checkout april-redesign

# 2. Sync dependencies (node_modules does NOT transfer from Windows)
npm install

# 3. Verify toolchain versions match Windows host
node --version    # Expected: v24.x (Windows host is v24.14.0)
npm --version

# 4. Xcode CLI tools (for native build steps, notarization later)
xcode-select --install    # skips if already installed

# 5. Smoke test
npm run test:run          # Should match Windows host — all green
npm run dev               # Vite dev server; should boot at :5173
npm run electron:dev      # Electron + Vite concurrent; should open app window
```

### Mac Claude-Code session bootstrap

Claude memory files in `~/.claude/projects/C--Users-envelazquez.../memory/`
are Windows-only. On the Mac you start with a fresh memory store. To
preserve the conventions:

**Option A (fastest, recommended for prototyping):** Don't worry about
it. Rely on this `docs/superpowers/HANDOFF.md` + `CLAUDE.md` +
`AGENTS.md` for all the cross-machine context. Prototyping doesn't
need the lightweight-review policy or agent-assignment memory.

**Option B (worth doing before Phase 07):** Re-derive the key memories
on the Mac by asking Claude "set up the NocLense memory conventions
from scratch" after pointing it at this handoff. The three most
important conventions to re-establish:

1. **Codex runs in a separate CLI session.** Never use `codex:rescue`
   skill. Claude drafts prompts; user pastes into Codex CLI.
2. **Lightweight review policy.** One adversarial probe per plan,
   per-slice self-assessment (not per-commit), deep review at phase
   close-out. YELLOWs logged, not fixed; only NO-GO blocks.
3. **Codex agent assignments per slice.** Every dispatch prompt names
   a primary agent from the decision table (see
   `docs/superpowers/feedback_codex_agent_assignments.md`).

**SessionStart git-sync hook:** The Windows machine has a
`~/.claude/hooks/git-sync.sh` hook that fetches origin on every
session start and warns if local is behind. If you want the same
safety net on the Mac, invoke the `update-config` skill in Claude
Code and ask it to install the same hook. Takes ~2 minutes.

### What to push back to origin from the Mac

- Prototyping scratch files should stay local. Do NOT commit
  Tauri sketches, test `.app` bundles, or exploratory Rust code to
  `april-redesign`.
- If a legitimate finding emerges (e.g., "the IndexedDB path
  differs on macOS in a way that blocks migration"), capture it in
  `docs/superpowers/HANDOFF.md` under "Phase 07 readiness contracts"
  and push that doc change — not the exploratory code.
- If you end up wanting to save prototype code for later reference,
  push to a separate throwaway branch like `mac-prototype` so
  `april-redesign` stays production-ready for Phase 07 planning.

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

## Immediate next step — dispatch Phase 07A (tokens + reskin)

**Phase 07 planning landed 2026-04-22.** Master plan at
`docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md`.
First slice plan at
`docs/superpowers/specs/2026-04-22-phase-07a-tokens-reskin-design.md`.

**Phase 07 sub-phase map:**

| Sub-phase | Scope | Status |
|---|---|---|
| pre-work | File-size split (CorrelationGraph, graphPresentation, NewWorkspaceLayout) | Ready to dispatch |
| 07A | Tokens + Fonts + Global Reskin (obsidian + phosphor, dark only) | **Slice plan ready; next to dispatch** |
| 07B | Auth + Dashboard (greenfield screens) | Slice plan pending 07A merge |
| 07C | Import + Investigation Setup | Slice plan pending 07B merge |
| 07D | Tauri scaffold + keyring + Unleashed refactor (v5.1 thin-MVP) | Slice plan pending 07C merge |
| 07E | Port 4 remaining vendors + FirstRunWizard + Settings panel | Slice plan pending 07D merge |
| 07F | Custom chrome + titlebar + kill Vercel | Slice plan pending 07E merge |
| 07G | Electron archive (Gemini primary) | Slice plan pending 07F merge |

**Confirmed architecture decisions (2026-04-22 brainstorming with Enrique):**

- **v5.1 local keyring**, NOT v4 AWS proxy. Zero backend, $0 recurring.
- **Scope:** Tauri shell + keyring + UI redesign. Rust log perf port and auto-updater are **out of scope** for Phase 07.
- **Platforms:** Windows + macOS.
- **Branch:** continue on `april-redesign`; merge to `main` at end of 07G.
- **Vercel:** killed entirely in 07F. No web preview after Phase 07.
- **Codex dispatch:** user-driven CLI per HANDOFF policy. Never use `codex:rescue`.
- **Gemini:** runs after each sub-phase merge.

**Phase 07 readiness contracts (from Phase 06C sign-off) — all addressed in master plan §4:**

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
