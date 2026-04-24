# Runbook — Dashboard

**Surface:** `src/components/dashboard/DashboardScreen.tsx` + `src/components/app/AppShellSidebar.tsx` + `ContinueCard.tsx` + `InvestigationRow.tsx` + `ClosedRow.tsx` + `MetricsStrip.tsx` + `LiveLogPeek.tsx`
**Source commits:** `3c15bc4` (07D) + `5435464` (polish — greeting became `LoadingLabel`, Sidebar migrated to AppShellSidebar)
**Automation share:** ~90% — typography + spacing verification stays subjective
**Last updated:** 2026-04-23

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft, post-07D + polish. Dashboard reads `caseRepository` + `caseLibraryService`; greeting is animated `LoadingLabel`. |

## Preconditions

- Splash runbook §4 complete (Continue → Dashboard transition verified).
- `caseRepository` IndexedDB store seeded with 0, 1, and ≥3 cases for empty-state / single-case / populated-state verification. Generator: run `tools/fixtures/seed-cases.ts` (Phase 08) or manually create via Setup → Investigate → Submit cycles.
- No auth state — closed-distribution v5 descope.

## Steps

### 1. First paint after Continue

**Action:** Click Continue on splash.

**Pass criteria:**
- `AppShellSidebar` renders on the left with brand mark + nav items.
- Main content area renders top-to-bottom: greeting + metrics strip + ContinueCard (if any in-flight investigation) + InvestigationRow section + ClosedRow section + LiveLogPeek (if recent parse activity).
- Greeting renders via `LoadingLabel` with text `"Let's begin"` — character-reveal animation plays on mount.
- No console errors or warnings.

### 2. Greeting animation

**Action:** Observe the greeting without interaction for 5 seconds.

**Pass criteria:**
- Greeting text `"Let's begin"` is visible immediately (sr-only fallback for screen readers).
- Character-reveal animation plays once on mount, then settles into the breathing/wave loop per `LoadingLabel` spec.
- Reduced-motion OS preference suppresses the breathing wave (character-reveal may still play once).

### 3. Case library data load

**Action:** Ensure `caseRepository` has ≥1 persisted case. Observe the InvestigationRow and ClosedRow sections.

**Pass criteria:**
- `InvestigationRow` renders one row per active (not-yet-submitted) case, sorted most-recent-first.
- Each row shows: ticket ID, case title, updated-at timestamp, severity indicator (color strip or badge).
- `ClosedRow` renders one row per submitted case, sorted most-recent-first.
- Row counts match `caseLibraryService.getAll().filter(c => c.status === 'active').length` (active) and `...status === 'closed'` (closed).

### 4. Severity color coding

**Action:** Inspect a row known to have severity `high`, `medium`, `low`.

**Pass criteria:**
- `high` → red-ish accent (`var(--red)` or equivalent).
- `medium` → amber (`var(--amber)`).
- `low` → mint or muted (`var(--mint)` or `var(--ink-3)`).
- No hardcoded hex values in the rendered DOM (inspect the `style`/`class` attribute — should reference CSS variables).

### 5. Empty state

**Action:** Clear `caseRepository` (or launch with a fresh IndexedDB). Return to Dashboard.

**Pass criteria:**
- `InvestigationRow` section renders an empty-state placeholder ("No active investigations" or equivalent).
- `ClosedRow` section renders its own empty-state placeholder.
- `MetricsStrip` renders with zero values (not hidden, not broken).
- `ContinueCard` does NOT render (nothing in-flight).

### 6. ContinueCard routes to in-flight investigation

**Action:** With an in-flight case, click the ContinueCard.

**Pass criteria:**
- Workspace mounts (`NewWorkspaceLayout`).
- Room opened matches the case's last-known phase (Setup / Investigate / Submit).
- No loss of case context — active correlations, evidence pins persist.

### 7. Open new workspace

**Action:** From Dashboard, click the "New investigation" or "Open workspace" affordance (location TBD — verify in current chrome).

**Pass criteria:**
- Workspace mounts with Import Room as the default phase.
- Phase dots show Import as active, others inactive.

### 8. Metrics strip values

**Action:** Read each metric in `MetricsStrip`.

**Pass criteria:**
- Each metric has a label + value (e.g., "Active cases: 3", "Closed this week: 7", "Avg resolution time: 42m").
- Values match what `caseLibraryService` reports at render time (no hardcoded placeholders).
- Metrics update within 500ms after a case state change (e.g., marking a case closed from Submit Room, returning to Dashboard).

### 9. LiveLogPeek

**Action:** Import a log file via Import Room to populate `LogContext`. Return to Dashboard.

**Pass criteria:**
- `LiveLogPeek` card appears with a truncated preview of the last-imported log (first 3–5 lines).
- Timestamp of the import is visible.
- Click on LiveLogPeek routes to Investigate Room for that case.

### 10. AppShellSidebar navigation

**Action:** Click each nav item in the sidebar.

**Pass criteria:**
- Each item is either (a) active-surface visible indicator, or (b) routes to a valid surface.
- No dead links or broken routes.
- Sidebar remains visible across Dashboard / Workspace transitions (it's part of the app shell, not screen chrome).

### 11. Resize behavior

**Action:** Resize window between minimum (1100×700) and wide laptop (~1440×900).

**Pass criteria:**
- Sidebar width is fixed or responsive per design spec (verify against handoff).
- InvestigationRow / ClosedRow grids reflow columns gracefully; no horizontal scroll.
- MetricsStrip does not wrap awkwardly; falls back to a stacked layout on narrow widths if needed.

## Known failure modes

| Symptom | Root cause | Fix / watch |
|---|---|---|
| Dashboard renders but `InvestigationRow` is empty despite cases existing | `caseLibraryService` init order — accessing before `CaseProvider` hydrates | Check `CaseProvider` mount order in `main.tsx`; verify `useCaseContext()` is inside provider |
| Greeting text appears but no animation | `LoadingLabel` CSS (`loading.css` keyframes) not imported | Check `src/index.css` imports — `loading.css` should be in the import chain |
| Severity colors showing as `var(--red)` literally (not evaluated) | Dark-theme tokens file (`tokens.css`) not imported, or `--red` not declared | Grep `src/styles/tokens.css` for `--red` declaration |
| Empty state placeholder missing when 0 cases | Row components return `null` instead of the placeholder when list is empty | Check `InvestigationRow.tsx` early-return logic |
| Sidebar nav click does nothing | `AppShellSidebar` not wired to `AppSurface`'s `setSurface` callback | Verify `AppSurface.tsx` passes navigation handlers down |

## Automation target (07J.3)

| Step | Automatable? | Notes |
|---|---|---|
| 1. First paint | YES | Assert AppShellSidebar + DashboardScreen markers present |
| 2. Greeting animation | YES | Assert `role="status"` region with `"Let's begin"` text |
| 3. Case library data load | YES | Pre-seed IndexedDB fixture; assert row counts match |
| 4. Severity color coding | PARTIAL | Assert `style`/`class` contains `var(--red|amber|mint)` — can't verify rendered pixel color without visual diff |
| 5. Empty state | YES | Seed empty IndexedDB, assert placeholder text |
| 6. ContinueCard routes | YES | Seed in-flight case, click, assert Workspace mount |
| 7. Open new workspace | YES | Click affordance, assert Import Room mount |
| 8. Metrics strip values | YES | Read DOM, compare to `caseLibraryService` mocked output |
| 9. LiveLogPeek | YES | Import fixture log, assert LiveLogPeek content |
| 10. AppShellSidebar nav | YES | Iterate nav items, click, assert route change |
| 11. Resize behavior | PARTIAL | Playwright can resize + screenshot, but "reflow gracefully" needs visual-diff baseline |

`/smoke-tauri dashboard` covers all 11 steps. Visual-diff baselines for steps 4 and 11 land in 07J.3.a fixture bundle.
