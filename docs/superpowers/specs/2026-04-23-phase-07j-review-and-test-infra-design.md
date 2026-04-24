# Phase 07J — UI Review + Testing Runbooks + Claude Code Automation (slice plan, v1)

**Parent:** `docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md` (v4)
**Omnibus:** `docs/superpowers/specs/2026-04-23-phase-07-omnibus-dispatch.md` (v2 — Batch D)
**Status:** v1 draft — written 2026-04-23 at user direction after Batch B GO.

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft. Three slices: 07J.1 inventory, 07J.2 runbook authoring, 07J.3 Claude Code automation harness. Sequenced after 07H (all 6 port slices done) and before 07I (final chrome/docs). Batch D in omnibus. |

## 1. Scope and motivation

By end of 07H, the full user-facing surface exists in its ported form: Auth, Dashboard, Import Room, Setup Room, Investigate Room, Submit Room. Up to that point, the work has been forward-implementation against a design handoff. 07J is a deliberate focus shift before the final chrome + docs pass:

1. **Inventory.** Take stock of what's actually left to ship the standalone app beyond this phase — YELLOWs accumulated during 07B–07H, deferred features, packaging/signing/updater decisions, and the five master-plan §8 out-of-scope items so each carries forward with a known disposition.
2. **Runbooks.** Capture manual test protocols for every screen so a human (or Claude) can reproducibly verify behavior. Markdown-first, pass/fail checklists, versioned in-repo.
3. **Automation.** Build a broad, asset-driven Claude Code automation layer that lets Claude navigate and work with the entire application end-to-end. Not just a test runner — a repeatable harness Claude can drive from design refs, ticket screenshots, log samples, or runbook references without human babysitting.

07J is NOT:
- A feature slice. No user-facing code changes in 07J.1/2. 07J.3 adds tooling, not app behavior.
- A rewrite of Phase 06 tests. Existing vitest suites stay as-is; 07J layers on top.
- A replacement for Claude review. Automation catches regressions between reviews; Claude still reviews at batch boundaries.

## 2. Deliverables by slice

### 07J.1 — Standalone inventory

**Output:** `docs/testing/standalone-inventory.md`
**Driver:** Claude (lead) + user (decisions)
**No Codex involvement; no code changes.**

Contents:

- **Phase 07 YELLOWs carried forward.** One row per YELLOW, with source commit / slice, disposition (fix in 07I / defer to Phase 08 / accepted / watch), owner, severity. Seed list from current state:
  - Cargo PATH not default-exported (07B Batch A) — environmental, needs `.cargo/bin` prepend for any Rust-touching slice.
  - `public/service-mappings.json` import warning on tauri:dev boot (pre-existing, surfaced 07C.0) — low-priority Vite warning.
  - `default.json` capabilities drift risk (surfaced 07B.5 / fix d7e85f2) — requires allowlist re-audit on every new HTTP surface or file path.
  - Untracked working-tree files present since before Phase 07 (`demo-assets/`, `public/demo-assets/`, `tools/`, `docs/CODE_REVIEW_AGENTS/`, `src/contexts/logContextObject.ts`, `src/contexts/useLogContext.ts`, `src/utils/{logSort,sipMethod,useClickOutside}.ts`, `src/styles/__tests__/`, snapshot diff on `useCuteLoadingLabel.test.ts.snap`) — need disposition decision (commit / delete / stash) before merge to main.
  - Phase 06 baseline test failures (18 in `EvidenceContext.test.tsx` + `caseContext.test.tsx`, `window.localStorage.clear is not a function`) — jsdom polyfill gap; fix is trivial but out of Phase 07 scope.
  - Large-file streaming (07B.5 Rust command) — gated manually on >100MB import; must be re-verified once 07E Import Room is live.
  - Tauri capabilities allowlist still uses starting patterns from 07B.1; 07B.4 audit was light-touch — requires a full audit pass.
- **Deferred / descoped mid-port items.** Anything Codex explicitly punted during 07C–07H self-assessments. (Seeded during 07J.1 by grepping `self-assessment` / `deferred` / `followup` in Batch C commit bodies.) Pre-seeded rows:
  - **Vendor-token keyring migration.** Zendesk / Jira / Datadog / Confluence tokens still persist through `src/store/aiSettings.ts` (localStorage, plain-text) as of end of 07F. `src/services/credentials.ts` type union was intentionally **not** expanded during Batch C to keep port slices scoped to UI work. Disposition: Phase 08. Scope (when picked up): extend `CredentialKey` union, migrate existing localStorage values on first boot, wire Setup Room save paths through `credentials()`, audit all vendor-service files for secret reads. Blocks nothing in Phase 07.
  - **Submit Room export formats.** `src/services/investigationExporter.ts` currently only produces the `.noclense` ZIP (JSON files). 07H self-assessment flagged PDF + Markdown export as DEFER-07J to avoid service-scope expansion mid-port. Disposition: 07I.a if trivial (<100 LOC, pure formatter), else Phase 08. Scope: PDF via browser print-to-PDF or lightweight lib; Markdown via template over the same evidence + closure-note payload the ZIP already collects. No new keyring / Tauri surface needed.
  - **Sandbox EPERM for Vitest/Tauri esbuild spawn.** Surfaced during 07H gate run — required escalated permissions to spawn the test / Tauri build subprocesses inside the sandboxed Codex environment. Environmental, not code. Disposition: accepted / document in 07J.3 automation harness requirements so the `/smoke-tauri` runner knows it needs elevated spawn permissions.
  - **Manual-gate backlog.** Six `tauri:dev` visual gates (07C.1 Auth, 07D Dashboard, 07E Import Room, 07F Setup Room, 07G.1/2/3 Investigate Room, 07H Submit Room) were not run by Codex — all owed to user before Batch D can start 07J.2 runbook authoring against real behavior. Disposition: user runs each before Batch D kickoff. Blocks 07J.2 authoring but not 07J.1 inventory (this doc). **Partial status as of 2026-04-23 post-Batch-C:** Auth, Dashboard, and Import Room visually confirmed via dev-server flow test after the MacWindow height-chain fix (below). Setup, Investigate, and Submit still owed.
  - **MacWindow height-chain regression — fixed.** Symptom: `tauri:dev` / `npm run dev` booted with a fully-rendered DOM but 0-pixel-tall viewport. All Batch C screens were invisible despite committing clean. Root cause: `src/styles/ambient.css:4` declares `.mac-window { height: 100%; }`, and `.mac-body` uses `position: absolute`, but no ancestor had a defined height. The Phase 06-era full-viewport wrapper that used to provide the height chain was removed during 07C.0 primitives rebuild (commit `7d3b379`) and not replaced. Fix: add `html, body, #root { height: 100%; }` at `src/index.css:17-21`. Three-line CSS addition; no component changes. Disposition: committed as standalone hotfix `0c59d46` on 2026-04-23. This regression silently blocked all visual gate verification for Batch C from 07C.0 (2026-04-23 AM) through the fix landing (2026-04-23 PM).
- **Master plan §8 out-of-scope items.** Each with a carry-forward disposition:
  - Rust log-parsing perf port.
  - Tauri auto-updater.
  - Mobile / Linux builds.
  - Telemetry / analytics wiring.
  - ~~Real auth identity provider integration~~ **Descoped v5 (2026-04-23).** Closed distribution, no auth layer. 07C.2 reworked the screen into a premium splash (no credentials, no SSO). Nothing to carry forward.
- **Packaging + distribution open questions.**
  - Windows code-signing cert — who owns, when acquired, CI integration.
  - macOS notarization — Apple dev account, entitlements, hardened runtime flags.
  - MSI vs NSIS default installer — currently both produced; pick one for distribution.
  - Update channel — none shipped; decision: ship v2.0.0 without updater, add in Phase 08.
  - Crash-report destination — 07B.6 routed to `app_local_data_dir/crash-reports/`; no upload path. Decide: local-only ship or add upload in Phase 08.
- **Post-merge backlog.** Anything surfaced during 07J.1 that isn't Phase 07 but shouldn't be lost.

Format: one section per category. Every row must have disposition + owner + target phase (07I / Phase 08 / watch / accepted). Entries without disposition block 07J.1 GO.

**Gate:** Claude review confirms every YELLOW + deferred item from Phase 07 is catalogued; user sign-off on dispositions.

### 07J.2 — Testing runbooks

**Output:** `docs/testing/runbooks/` (markdown files)
**Driver:** Claude (lead) + user (final sign-off)
**No Codex involvement; no code changes.**

One runbook per file. Files:

- `auth.md` — stub flow (email/password fields → 500ms delay → Dashboard mount); SSO button render (Google / Okta); keyboard navigation; theme application.
- `dashboard.md` — case library load + render; recent investigations sort; severity color coding; empty state; link-out to each room; metrics strip live values.
- `import-room.md` — small file import (<50MB); large file import (>100MB streamed via Rust command); malformed file error path; cancel mid-import; IndexedDB mode toggle; phase-dot transition on success.
- `setup-room.md` — Zendesk credential save + round-trip; Datadog credential save + round-trip; invalid-credential error path; attachment upload; transition to Investigate.
- `investigate-room.md` — virtualized log stream ≥100k entries (scroll perf, no frame drops); correlation graph render (G6); AI assistant chat roundtrip with log context; evidence capture (highlight + save); similar-tickets panel populates; citation jump from AI response to log line; filter chips (SIP method, level, correlation).
- `submit-room.md` — closure note authoring; evidence summary renders from captured items; handoff export format; phase-dot final state.
- `cross-cutting.md` — keyring round-trip (add key → reboot → retrieve); dark-only theme (no light-mode flashes); window resize (minimum size honored; grid reflows); HMR in tauri:dev (edit component → see update without reboot); crash path (forced panic writes to crash-reports dir).

Each runbook:

- **Preconditions** — fixture data required, app state, credentials.
- **Steps** — numbered, one action per step, expected observable outcome.
- **Pass criteria** — explicit pass/fail per step. "Screen loads" is not a pass criterion; "card with title 'Recent Investigations' renders with ≥1 row" is.
- **Known failure modes** — list of things that have broken before (seeded from Phase 06 incidents where known).
- **Automation target** — which parts are automatable in 07J.3, which stay manual (e.g., subjective visual fidelity).

Stored at `docs/testing/runbooks/<name>.md`. Index at `docs/testing/runbooks/README.md` links to all.

**Gate:** Claude review confirms each runbook covers every interactive element + every data path in the ported screen. User walks one runbook end-to-end on the live app as sanity check before GO.

### 07J.3 — Claude Code automation harness

**Output:**
- `tools/claude-automation/` — executable harness code
- `docs/testing/automation/README.md` — entry point + usage
- `.claude/settings.json` additions — hooks
- `/smoke-tauri` slash command under `.claude/commands/` (or wherever project-local commands live)
- Optional: `tools/claude-automation/mcp-server/` — MCP surface for richer asset-driven workflows

**Driver:** Codex (implementation) with `qa-automation` primary agent, `typescript-pro` + `mcp-server-builder` support. User manual-gates at end.

Budget: **~5 commits max.** Halt for re-plan if automation scope grows beyond the five components below.

#### 07J.3.a — Playwright-Tauri driver

- Add `@playwright/test` + `tauri-driver` (or equivalent WebDriver bridge for Tauri v2) as dev deps.
- `tools/claude-automation/driver.ts` — launches the built Tauri binary (or dev server), returns a Playwright `Page` wired to the webview.
- Helpers: `startApp()`, `stopApp()`, `screenshot(name)`, `waitForRoom(name)`, `clickByRole(role, name)`, `importFile(path)`, `saveCredential(service, key, value)`.
- Fixture assets under `tools/claude-automation/fixtures/`: sample log files (small, medium, 100MB+), canned AI responses, mocked Zendesk/Datadog payloads.

#### 07J.3.b — `/smoke-tauri` slash command

- Project-local slash command that runs a chosen runbook via the driver, captures screenshots, writes a pass/fail report to `tools/claude-automation/reports/<timestamp>/`.
- Args: `/smoke-tauri <runbook-name>` or `/smoke-tauri all`.
- Exit code 0 on all-pass, 1 on any-fail; report includes per-step assertions + screenshot refs.

#### 07J.3.c — Settings.json hooks

- Post-commit hook on `src/components/**` writes: trigger `npm run lint` + `npm run test:run` + grep-assertion bundle (no `electronAPI`, no `@keyframes nl-` in components, no `window.MacWindow`).
- Pre-commit hook on `src-tauri/capabilities/default.json` writes: remind Claude to re-audit the allowlist against vendor services.
- Hooks are scoped to this repo (`.claude/settings.json`, not user-global).

#### 07J.3.d — Agent workflow for end-to-end runbook execution

- New agent definition (local): `noclense-qa-runner`. Role: given a runbook path, read the markdown, execute each step through the Playwright driver, report pass/fail.
- Dispatchable via the Agent tool with `subagent_type: noclense-qa-runner`.
- Reads runbook markdown + optional asset bundle (screenshots, log fixtures) + writes structured report.
- The agent is the repeatable primitive — Claude can dispatch it on demand ("run the investigate runbook against HEAD"), on a schedule via `/loop`, or as part of a larger workflow.

#### 07J.3.e — Asset-driven navigation (optional MCP surface)

Goal: Claude can be handed a design screenshot, a ticket export, or a log sample and autonomously drive the app to match / reproduce / verify.

- `tools/claude-automation/mcp-server/` — local MCP server exposing:
  - `resource://app-state` — current Tauri window state, room, active log count, AI conversation ID.
  - `tool:navigate-to-room` — Claude picks a room by name; driver clicks the right nav.
  - `tool:import-log` — Claude passes a file path; driver drives the Import Room.
  - `tool:query-dom` — Claude queries for elements by role/text/testid; driver returns matches.
  - `tool:capture-state` — returns a structured dump (room, open panels, active filters, case ID) for inspection.
- Makes automation composable: Claude can reason about the app rather than execute a fixed script.
- If MCP server scope grows, defer to Phase 08 and ship 07J.3.a–d as the minimum harness.

**Gate per commit:** build + test:run baseline + lint baseline still hold. `/smoke-tauri auth` green on a clean boot once 07J.3.a + 07J.3.b land.
**Manual user gate before 07J close:** user dispatches `noclense-qa-runner` against one runbook and confirms report output is usable; user feeds Claude a design-reference screenshot and confirms Claude can drive to the matching room via the MCP surface (if 07J.3.e shipped).

## 3. Files that must NOT change in 07J

- `src/components/**` — the ported surface is frozen. Fixing visual/functional bugs surfaced by 07J.2 runbooks is 07I.a scope, not 07J.
- `src/services/**`, `src/contexts/**`, `src/utils/**`, `src/types.ts` — untouched.
- `src-tauri/**` — untouched unless 07J.3 needs a new Tauri command to support driver introspection (unlikely; halt + re-plan if proposed).
- Production `package.json` dependencies (`dependencies`). Dev deps (`devDependencies`) may grow by `@playwright/test`, `tauri-driver`, and any MCP SDK.

## 4. Gates

- `npm run build` green.
- `npm run test:run` ≤ baseline (18 fail / ~659 pass per 07C.0 close; higher pass count as port slices add tests is fine).
- `npm run lint` ≤ 110 errors / 5 warnings.
- `npm run tauri:build` green.
- 07J.3: `/smoke-tauri auth` green from a clean boot.

## 5. Halt rules

- Any gate regression beyond baseline → halt.
- Automation scope drift (e.g., adding a second MCP server, a CI pipeline, a dashboard UI for reports) → halt, surface for re-plan.
- Runbook gap surfaced during 07J.2 review → halt, author missing runbook before GO.
- Inventory row without disposition in 07J.1 → halt, surface to user.
- `codex:rescue` forbidden per HANDOFF policy.

## 6. Open questions

- **Tauri WebDriver bridge.** `tauri-driver` is the Tauri v1 convention; Tauri v2 may have a different path (check at dispatch). If webview automation is not viable, fall back to `@tauri-apps/api/event`-based integration harness + screenshot via native window grab.
- **Fixture file size.** 100MB+ log fixture checked into repo is too big. Store under `tools/claude-automation/fixtures/` with a generator script + `.gitignore`, or host elsewhere with a fetch step.
- **MCP server scope.** 07J.3.e is marked optional. If Playwright driver + agent workflow cover 80% of needs, defer MCP to Phase 08.
- **CI integration.** Currently the runbooks run locally. Adding GitHub Actions to run them per-PR is out of 07J scope unless explicitly requested — flag in 07J.1 inventory for Phase 08 decision.

## 7. After 07J.3 commits

- Claude runs deep review of the three 07J deliverables.
- On GO: Batch E (07I.a + 07I.b) dispatches.
- 07J artifacts (inventory, runbooks, harness) are the durable output — they survive the phase merge and become the ongoing QA surface for NocLense standalone.
