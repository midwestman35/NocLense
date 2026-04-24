# Phase 07 — Omnibus Dispatch (speed-run)

**Status:** Active 2026-04-23. Ships Batch A → E with Claude-review halts at batch boundaries. **v2 2026-04-23:** inserted Batch D (07J — UI review + test infra + automation) between port completion (07H) and final chrome (07I); old Batch D (07I) becomes Batch E.
**Parent plans:**
- Master v4: `docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md`
- 07B slice plan v2.2: `docs/superpowers/specs/2026-04-23-phase-07b-tauri-scaffold-electron-kill-design.md`
- 07J slice plan v1: `docs/superpowers/specs/2026-04-23-phase-07j-review-and-test-infra-design.md`
- Keyring: `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`
- Design handoff: `reference/handoff-2026-04-23/project/`

## Why this doc exists

Per-slice Claude review is slow. This doc compresses Phase 07's remaining ~14 slices into 5 batches with review gates only between batches. Each batch is self-contained: Codex runs every slice in order, gates after each commit, halts on any regression. Claude reviews the whole batch output at the end.

Risk acknowledged: defect-detection lag increases (a scope drift caught in 1 slice under normal cadence may surface 4 slices late here). Mitigation: gate discipline unchanged per slice; batch halts are mandatory.

**v2 insert (2026-04-23, user direction):** Batch D (07J) is a deliberate focus shift from forward-implementation to QA + automation. It runs after the full ported UI is visible (end of 07H) and before final chrome (07I). Runbooks + Claude-Code automation built in 07J raise the floor on every subsequent change — post-merge ongoing maintenance, Phase 08+ features, and the 07I chrome/docs pass itself.

## Open-question resolutions (committed 2026-04-23)

| Topic | Decision | Applies to |
|---|---|---|
| ~~Auth flow~~ | ~~Stub — UI only, resolves "authenticated" after 500ms~~ **Descoped v5 (2026-04-23): no auth.** Screen reworked as premium splash in 07C.2. | 07C.1 → 07C.2 |
| Dashboard data | Reads existing `caseRepository` + `caseLibraryService` | 07D |
| UI primitives rebuild | Replace `src/components/ui/*` contents wholesale in 07C.0 (one commit, consumer updates inline) | 07C.0 |
| 07G split threshold | Codex may split Investigate into 07G.1/07G.2/07G.3 if single-slice >500 LOC or >10 files changed | 07G |
| Feature parity | Port-first, prune-later. Keep Phase 06 feature set; remove genuinely-dead code only in the specific slice that owns it | 07C–07H |

## Dependency graph

```
        ┌── 07B.4 ───┐
        │            │
        ├── 07B.5 ───┼──▶ 07B.7 ──┐
 (prep) │            │            │
  Done ─┼── 07B.6 ───┘            ├──▶ 07B.9 ─[HALT]─▶ 07C.0 ─[HALT]─▶ 07C.1 ─▶ 07D ─▶ 07E ─▶ 07F ─▶ 07G ─▶ 07H ─[HALT]─▶ 07J.1 ─▶ 07J.2 ─▶ 07J.3 ─[HALT]─▶ 07I.a ─▶ 07I.b ─[FINAL]
        │                         │
        └── 07B.8 ────────────────┘
```

07B.4, 07B.5, 07B.6, 07B.8 are file-independent — Codex may interleave their commits in any order as long as each passes gates.
07B.7 blocks until 07B.4/5/6 complete (grep must show zero `electronAPI` refs).
07B.9 blocks until 07B.7 + 07B.8 complete.
**07C.2 Splash rework** is an inserted slice between Batch C close and Batch D kickoff (v5 2026-04-23 design pivot — auth descoped). Small, single-commit slice. No separate batch; reviewed on commit, rolls straight into Batch D.
07J.1/2/3 are strictly sequential — inventory feeds runbook scope; runbooks feed automation target list.
07J.3 is a budget-bounded infra slice (~5 commits max) — halt for re-plan if automation scope grows past Playwright harness + slash command + hooks + agent workflow + MCP surface.

## Sub-agent assignments

| Slice | Primary sub-agent | Support | Type |
|---|---|---|---|
| 07B.4 | `typescript-pro` | `refactoring-specialist` | plugin-http swap in 6 service files |
| 07B.5 | `rust-engineer` | `typescript-pro` | Rust streaming cmd + TS integration |
| 07B.6 | `rust-engineer` | `refactoring-specialist` | Retire panel + rewire errorReporting |
| 07B.7 | `refactoring-specialist` | `code-reviewer` | Delete electron/, deps, types |
| 07B.8 | `refactoring-specialist` | `code-reviewer` | Delete Vercel config + api/ |
| 07B.9 | `build-engineer` | `technical-writer` | Smoke + README update |
| 07C.0 | `react-specialist` | `typescript-pro` | Primitives rebuild from handoff |
| 07C.1 | `react-specialist` | `frontend-developer` | Auth screen port |
| 07D | `react-specialist` | `frontend-developer` | Dashboard port |
| 07E | `react-specialist` | `frontend-developer` | Import Room port |
| 07F | `react-specialist` | `typescript-pro` | Setup Room port (Zendesk/Datadog service wiring) |
| 07G | `react-specialist` | `performance-engineer` | Investigate Room (virtualized list, G6 graph) |
| 07H | `react-specialist` | `frontend-developer` | Submit Room port |
| 07C.2 | `react-specialist` | `frontend-developer` | Splash rework (auth descope) — single slice between Batch C close and Batch D kickoff |
| 07J.1 | Claude (lead) | user | Inventory authoring — no code |
| 07J.2 | Claude (lead) | user | Runbook authoring — markdown only |
| 07J.3 | `qa-automation` (Playwright-Tauri) | `typescript-pro` + `mcp-server-builder` | Automation harness: Playwright driver, slash command, settings.json hooks, agent workflows, optional MCP surface |
| 07I.a | `rust-engineer` | `build-engineer` | Final chrome + cleanup |
| 07I.b | — | — | Gemini — docs rewrite |

## Gate discipline (unchanged per slice)

After every commit:
- `npm run build` → green
- `npm run test:run` → baseline-match (18 pre-existing failures from Phase 06 era; new slices may add new passing tests — that's fine)
- `npm run lint` → ≤ **110 errors / 5 warnings** (post-07B.3 baseline)
- Include gate tails in per-slice self-assessment

Any regression → halt, surface to Claude.

## Batch halt protocol

At each `[HALT]` in the dependency graph:
1. Codex stops, does NOT advance to next batch.
2. User pastes the batch result diffs + gate tails to Claude.
3. Claude runs review on the batch, returns GO / NO-GO with YELLOWs.
4. On GO: user dispatches next batch prompt to Codex.

This preserves the phase loop's `Codex build → Claude review` step at every batch boundary, just not per slice within a batch.

## Halt rules (unchanged)

- Any gate regression beyond baseline → halt, surface.
- Any need to touch a do-not-touch path → stop, propose scope change.
- Manual user-gate failure → halt.
- `codex:rescue` forbidden.
- **safeStorage migration manual verification** still owed before 07B.7 — user must run old Electron, save a key, quit, boot Tauri, confirm key persists via keyring. Can happen any time through 07B.6 but MUST precede 07B.7 commit.

## Batch A dispatch prompt — Finish 07B

See §"Batch A paste-in" in the Claude message accompanying this doc. **Status: shipped 2026-04-23, review GO.**

## Batch B dispatch prompt — 07C.0 Primitives rebuild

See §"Batch B paste-in" in the Claude message dated 2026-04-23 post-Batch-A review. **Status: shipped 2026-04-23 (commit 7d3b379), review GO with three logged YELLOWs (manual-gate indirect evidence, cargo PATH, `service-mappings.json` import warning).**

## Batch C dispatch prompt — 07C.1 → 07H port run

Six slices to next HALT: 07C.1 Auth, 07D Dashboard, 07E Import Room, 07F Setup Room, 07G Investigate Room (may split 07G.1/2/3 if >500 LOC or >10 files), 07H Submit Room. Drafted post-Batch-B review GO.

## Batch D dispatch prompt — 07J UI review + test infra + automation

Focus-shift batch. Claude + user drive 07J.1 (inventory) and 07J.2 (runbook authoring) with no Codex code changes — these are markdown deliverables. 07J.3 (automation harness) is Codex-dispatched against the 07J slice plan. Drafted post-Batch-C review GO. Scope: Playwright-Tauri driver, `/smoke-tauri` slash command, settings.json hooks for post-commit gates, agent workflow for end-to-end runbook execution, optional MCP surface for asset-driven navigation.

## Batch E dispatch prompt — 07I.a + 07I.b

Final chrome (Rust side: native menus, titlebar polish, about panel) + Gemini docs rewrite + merge `april-redesign` → `main`. Drafted post-Batch-D review GO.

## Post-phase

Phase 07 exit criteria (from master plan §12):
- `electron/` does not exist
- `vercel.json`, `.vercel/`, `api/` do not exist
- `src-tauri/` exists; `tauri dev` + `tauri build` work on Windows + macOS
- All 4 rooms + Auth + Dashboard render from ported handoff designs
- Existing Phase 06 services wired to new UI without feature regressions
- README + USAGE_GUIDE + DEVELOPER_HANDOFF rewritten by Gemini
- No live Electron or Vercel references anywhere in `src/`
- 07J deliverables shipped (standalone inventory, per-screen runbooks, Claude Code automation harness driving the full app from asset input)

Merge `april-redesign` → `main` after Claude final GO at end of Batch E.
