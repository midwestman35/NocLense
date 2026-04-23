# Phase 07 — Omnibus Dispatch (speed-run)

**Status:** Active 2026-04-23. Ships Batch A → D with Claude-review halts at batch boundaries.
**Parent plans:**
- Master v3: `docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md`
- 07B slice plan v2.2: `docs/superpowers/specs/2026-04-23-phase-07b-tauri-scaffold-electron-kill-design.md`
- Keyring: `docs/superpowers/specs/2026-04-21-tauri-migration-v5.1-local-keyring-design.md`
- Design handoff: `reference/handoff-2026-04-23/project/`

## Why this doc exists

Per-slice Claude review is slow. This doc compresses Phase 07's remaining ~14 slices into 4 batches with review gates only between batches. Each batch is self-contained: Codex runs every slice in order, gates after each commit, halts on any regression. Claude reviews the whole batch output at the end.

Risk acknowledged: defect-detection lag increases (a scope drift caught in 1 slice under normal cadence may surface 4 slices late here). Mitigation: gate discipline unchanged per slice; batch halts are mandatory.

## Open-question resolutions (committed 2026-04-23)

| Topic | Decision | Applies to |
|---|---|---|
| Auth flow | Stub — UI only, resolves "authenticated" after 500ms | 07C.1 |
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
  Done ─┼── 07B.6 ───┘            ├──▶ 07B.9 ─[HALT]─▶ 07C.0 ─[HALT]─▶ 07C.1 ─▶ 07D ─▶ 07E ─▶ 07F ─▶ 07G ─▶ 07H ─[HALT]─▶ 07I.a ─▶ 07I.b ─[FINAL]
        │                         │
        └── 07B.8 ────────────────┘
```

07B.4, 07B.5, 07B.6, 07B.8 are file-independent — Codex may interleave their commits in any order as long as each passes gates.
07B.7 blocks until 07B.4/5/6 complete (grep must show zero `electronAPI` refs).
07B.9 blocks until 07B.7 + 07B.8 complete.

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

See §"Batch A paste-in" in the Claude message accompanying this doc.

## Batch B–D dispatch prompts

Held back pending Batch A review outcome. Claude drafts each batch prompt after the preceding batch's review GO.

## Post-phase

Phase 07 exit criteria (from master plan §12):
- `electron/` does not exist
- `vercel.json`, `.vercel/`, `api/` do not exist
- `src-tauri/` exists; `tauri dev` + `tauri build` work on Windows + macOS
- All 4 rooms + Auth + Dashboard render from ported handoff designs
- Existing Phase 06 services wired to new UI without feature regressions
- README + USAGE_GUIDE + DEVELOPER_HANDOFF rewritten by Gemini
- No live Electron or Vercel references anywhere in `src/`

Merge `april-redesign` → `main` after Claude final GO at end of Batch D.
