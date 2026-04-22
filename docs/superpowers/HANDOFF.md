# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (end of night session)
**Branch:** `april-redesign`
**Current HEAD:** `191069a` — `docs: rewrite README, USAGE_GUIDE, DEVELOPER_HANDOFF (Gemini round 2)`

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
| **Gemini** (Google Gemini CLI) | Support Staff / Doc Engineer | Maintains README, USAGE_GUIDE, DEVELOPER_HANDOFF |

Claude plans → Codex implements → Claude reviews → Gemini updates docs.

**Never:**
- Use the `codex:rescue` skill or any `/codex:*` dispatch slash-skill.
- Implement source code yourself. Claude plans + reviews; Codex implements.
- Skip the self-assessment stop between commits.

---

## Completed phases

| Phase | What shipped | Close commit |
|---|---|---|
| 04.5 | Direction C token base, Button + WorkspaceCard curves | `d0e45c9` |
| 05 | §4.2 transition-all sweep, citation-jump, reduced-motion audit | `cefc12e` |
| 06A | Spinner primitive, anime.js guards, MotionConfig wiring, Direction C transitions, room parity, audit consolidation | `78a1e22` |

Phase 06A survived 7 adversarial review rounds (v1→v8 GO). Plan file:
`docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md`

---

## Current state — Phase 06B (Correlation Graph)

**Status:** Commits 1+2 shipped. Commits 3-5 remaining.

**What landed (commit `12cd7cb`):**
- `src/components/correlation-graph/types.ts` — GraphNode, GraphEdge, CorrelationGraphResult interfaces + type meta
- `src/components/correlation-graph/useCorrelationGraph.ts` — data transformer hook with memoization + >500 node clustering
- `src/components/correlation-graph/CorrelationGraph.tsx` — G6 canvas renderer, wired into NewWorkspaceLayout
- `src/components/correlation-graph/__tests__/useCorrelationGraph.test.ts` — 4 tests (base graph, type scoping, clustering, expand toggle)
- `src/components/correlation-graph/__tests__/CorrelationGraph.test.tsx` — renderer tests
- `@antv/g6` installed as dependency
- `src/styles/tokens.css` — `--correlation-*` color token palette added
- Reduced-motion: force layout + viewport animation disabled when prefers-reduced-motion active

**What's next:**

### Commit 3 — Click-to-filter + hover tooltips + active-filter highlighting
- Wire node clicks into LogContext filtering (use `addCorrelation` from `useLogContext()`)
- Hovering a node: tooltip with correlation type, value, connected log count, connected node count
- Hovering an edge: highlight the log entries it represents
- Active correlation filters visually highlight their nodes (ring/glow)
- Tests for click-to-filter behavior
- Resume from: `src/components/correlation-graph/CorrelationGraph.tsx`

### Commit 4 — Keyboard navigation + accessibility
- Tab into graph, arrow keys to traverse, Enter/Space to activate, Escape to deselect
- aria-label on graph container
- Focused node announces type + value to screen readers
- Append new animated surfaces to `docs/perf/reduced-motion-audit.md`

### Commit 5 — Performance + polish
- >500 nodes: auto-clustering (already in hook — wire into renderer)
- >1000 nodes: "Graph is large" notice + "Show all" toggle
- WebGL renderer if available
- Zoom controls (buttons, not just scroll)
- "Reset layout" button
- Empty state message

---

## Immediate next step

Draft or paste the **Commit 3 dispatch prompt** for Codex:

```
You are continuing Phase 06B of NocLense — Correlation Graph card.
Commits 1+2 are shipped (data layer + G6 renderer at 12cd7cb).

MANDATORY PRE-READS:
1. CLAUDE.md
2. src/CLAUDE.md
3. src/components/correlation-graph/CorrelationGraph.tsx (your starting point)
4. src/components/correlation-graph/useCorrelationGraph.ts (the data hook)
5. src/components/correlation-graph/types.ts (interfaces)
6. src/contexts/LogContext.tsx — find addCorrelation / toggleCorrelation

COMMIT 3 — Click-to-filter + hover tooltips + active-filter highlighting:

1. NODE CLICK → FILTER:
   - Clicking a non-cluster node calls addCorrelation (or equivalent)
     from LogContext with the node's correlationType + value
   - Clicking a cluster node calls toggleCluster (already wired in hook)
   - The Log Stream card should immediately reflect the filter change

2. HOVER TOOLTIPS:
   - Hovering a node shows: correlation type label, value, connected
     log count, connected node count
   - Hovering an edge shows: number of shared log entries, the two
     correlation types it connects
   - Use G6's built-in tooltip plugin or a custom HTML overlay

3. ACTIVE-FILTER HIGHLIGHTING:
   - Nodes whose correlation is currently active in LogContext should
     have a visible ring or glow effect
   - Excluded correlations should appear dimmed or struck-through
   - Use the isActive / isExcluded flags already on GraphNode

4. TESTS:
   - Test that clicking a node calls the correct LogContext method
   - Test that active/excluded nodes render with distinguishing attributes

WORKFLOW: Implement Commit 3 → emit self-assessment → STOP.

SELF-ASSESSMENT FORMAT:
## Self-Assessment — Phase 06B, Commit 3
- **Files changed:** [list]
- **Tests:** [pass/fail + exact command]
- **LogContext integration:** [which method is called on node click]
- **Reduced-motion:** [any new animated surfaces? if so, how guarded]
- **Confidence:** [high/medium/low]
- **Risks / questions:** [list or "none"]
```

---

## Gemini docs status

README.md, USAGE_GUIDE.md, DEVELOPER_HANDOFF.md: **GO** after round 2.
All 3 REDs + 10 YELLOWs resolved. Committed at `191069a`.

---

## Pre-existing tech debt (not ours)

- `tsc` red on `src/contexts/logContextObject.ts` + `src/services/investigationExporter.ts`
- `vitest` red on `src/contexts/__tests__/EvidenceContext.test.tsx` + `.worktrees/ui-overhaul*/llmService.test.ts`
- `act()` warnings in `src/components/__tests__/AIButton.test.tsx` (cosmetic, not failures)

---

## What's after 06B

| Phase | Scope |
|---|---|
| 06C | Case Library — indexing/retrieving past investigations |
| 07 | Tauri migration — replacing Electron |

---

## Posture

Tight, diagnostic, no fluff. Claude reviews each Codex self-assessment
before authorizing the next commit. Assume continuity — don't restart
from zero.
