# NocLense Standalone — Shipping Inventory

**Sub-phase:** 07J.1 (Batch D, Phase 07 Tauri migration)
**Draft date:** 2026-04-23
**Driver:** Claude (lead) + Enrique (decisions)
**Parent spec:** `docs/superpowers/specs/2026-04-23-phase-07j-review-and-test-infra-design.md`
**Source branch:** `april-redesign` at `5435464` (post-07C.2 polish)

## Purpose

This document is the shipping cut-over ledger for NocLense standalone. Every known issue, deferral, and open decision accumulated through Phase 07 lives here with an explicit **disposition + owner + target phase**. A row without a disposition blocks `[HALT]` GO at end of 07J.1. After merge to `main`, this doc becomes the Phase 08 intake.

**Target phase codes:**

- `07I.a` — addressable during final chrome/docs slice before merge.
- `07I.b` — covered by Gemini docs rewrite.
- `Phase 08` — deferred to next phase after merge.
- `watch` — monitored, no action yet; escalate if it recurs.
- `accepted` — known limitation, intentional tradeoff, no action planned.
- `closed` — already resolved; row kept for history.

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft. Pre-seeded from 07J slice-plan seed list + Batch A/B/C reviews + Codex self-assessments. |
| v2 | 2026-04-23 | Enrique signed off via option (c) — recommended dispositions accepted with minor flattening. §4.1 / §4.2 settle on ship-unsigned strategy for v2.0.0; §4.3 picks NSIS; §4.6 reconciles on canonical 2.0.0; §3.4 accepts no-telemetry. Exit criteria met. |

---

## §1. Phase 07 YELLOWs carried forward

One row per YELLOW. `closed` rows kept for historical context so future-you can see that they were tracked and resolved.

| # | Issue | Source | Severity | Disposition | Owner | Target |
|---|---|---|---|---|---|---|
| 1.1 | Cargo / rustc / rustup not on PATH by default on dev machine; any Rust-touching slice must prepend `$env:USERPROFILE\.cargo\bin` in PowerShell | 07B Batch A environmental YELLOW | low | `accepted` — dev environment issue, not app. Document in 07J.3 automation harness so `/smoke-tauri` runner knows. | Enrique | 07J.3 |
| 1.2 | `public/service-mappings.json` import warning on `tauri:dev` boot | Pre-existing; surfaced in 07C.0 review | low | `07I.a` — convert to proper Vite asset import or move out of `public/` | Enrique + Codex | 07I.a |
| 1.3 | `src-tauri/capabilities/default.json` allowlist drift risk — any new HTTP surface or file path can silently 403 at runtime | 07B.5 regression + fix `d7e85f2`; carried YELLOW | medium | `07J.3` — add a pre-commit hook on `default.json` changes that reminds Claude to re-audit against vendor services | Codex + Claude | 07J.3 |
| 1.4 | Untracked working-tree files present since before Phase 07: `demo-assets/`, `public/demo-assets/`, `tools/`, `docs/CODE_REVIEW_AGENTS/`, `docs/demo-storyboard/`, `src/contexts/logContextObject.ts`, `src/contexts/useLogContext.ts`, `src/utils/{logSort,sipMethod,useClickOutside}.ts`, `src/styles/__tests__/`, snapshot diff on `useCuteLoadingLabel.test.ts.snap` | Git status at start of Phase 07 | medium | `07I.a` — per-file disposition pass (commit / delete / stash) before merge. Snapshot diff should update-and-commit since the splash/dashboard polish likely regenerated it | Enrique | 07I.a |
| 1.5 | Phase 06-baseline test failures: 18 total (14 in `EvidenceContext.test.tsx`, 4 in `caseContext.test.tsx`). Root cause: `window.localStorage.clear is not a function` — jsdom polyfill gap | Pre-existing before Phase 07 | low | `Phase 08` — trivial fix (add a localStorage polyfill stub in `src/test/setup.ts`) but out of Phase 07 scope. Keep as gate baseline until Phase 08 | Claude + Codex | Phase 08 |
| 1.6 | Large-file streaming (07B.5 Rust command `file_stream.rs`) manually verified only with small fixtures. Full end-to-end with a real >100MB log is owed now that 07E Import Room is live | 07B.5 manual-gate carryover | high | `07I.a` — user runs 100MB+ import against current HEAD, confirms chunk streaming + IndexedDB page-load + virtualized viewer all hold. If smoke passes, automate in 07J.3.b `/smoke-tauri import-room` | Enrique | 07I.a |
| 1.7 | Tauri `default.json` capabilities allowlist still uses starting patterns from 07B.1; 07B.4 audit was light-touch. Full audit needed before ship | 07B.4 self-assessment | medium | `07I.a` — one explicit audit pass: enumerate every HTTP host, every `fs` scope, every `dialog` scope actually reached by the app; prune unused entries | Codex | 07I.a |
| 1.8 | MacWindow height-chain regression — blocked all visual gate verification from 07C.0 (2026-04-23 AM) until caught 2026-04-23 PM | 07C.0 regression; hotfix `0c59d46` | high | `closed` — fixed. Kept for history so the failure mode is recognizable if similar chrome work happens in Phase 08 | — | closed |
| 1.9 | Sandbox EPERM for Vitest/Tauri esbuild subprocess spawn — required escalated permissions in Codex's sandboxed env | 07H gate run | low | `accepted` — environmental. Document as harness requirement in 07J.3 so the `/smoke-tauri` runner is launched with elevated spawn permissions | Claude | 07J.3 |
| 1.10 | Manual-gate backlog from Batch C close | 07H self-assessment — Codex did not run `tauri:dev` visual walkthroughs | — | `closed` — Auth/Splash/Dashboard/Import + Setup/Investigate/Submit visually confirmed 2026-04-23 after MacWindow fix + second-pass after polish commit `5435464` | Enrique | closed |

---

## §2. Deferred / descoped mid-port items

Features explicitly punted during 07C–07H and 07C.2 to preserve port-first discipline.

| # | Item | Source | Disposition | Owner | Target |
|---|---|---|---|---|---|
| 2.1 | **Vendor-token keyring migration.** Zendesk / Jira / Datadog / Confluence tokens still persist through `src/store/aiSettings.ts` (localStorage, plain-text). `src/services/credentials.ts` `CredentialKey` union was intentionally not expanded during 07F to keep port slices UI-scoped | 07F redirect 2026-04-23 | `Phase 08` — own slice. Scope: extend `CredentialKey`, first-boot migration of existing localStorage values, wire Setup Room save paths through `credentials()`, audit all vendor services for secret reads, deletion-on-logout semantics (or explicit "no logout" decision given closed-distribution v5) | Codex | Phase 08 |
| 2.2 | **Submit Room export formats.** `src/services/investigationExporter.ts` only produces `.noclense` ZIP (JSON files). PDF + Markdown export was explicitly DEFER-07J'd | 07H self-assessment | `07I.a` **if trivial** (pure formatter, <100 LOC, no new services). Else `Phase 08`. Scope: PDF via browser print-to-PDF or lightweight lib; Markdown via template over the same evidence + closure-note payload the ZIP already collects | Codex | 07I.a → Phase 08 |
| 2.3 | **Auth / identity provider.** Descoped entirely in master plan v5 (2026-04-23) per closed-distribution pivot. `AuthScreen`/`AuthCard`/`AuthStatusFeed` deleted. `SplashScreen` replaces them with phrase cycler + Continue CTA | Master plan v5 | `closed` — nothing to carry forward. Row kept to explain why §3.5 below is struck-through | — | closed |

---

## §3. Master plan §8 out-of-scope items

Items the master plan explicitly punted to post-07 phases. Each must leave Phase 07 with a carry-forward disposition.

| # | Item | Disposition | Owner | Target |
|---|---|---|---|---|
| 3.1 | **Rust log-parsing perf port.** Current parser is TypeScript in `src/utils/parser.ts`. Master plan said revisit only if 100k-entry render stutters in Tauri | `watch` — no action unless §1.6 manual verification surfaces perf problems at scale. Re-evaluate after 07I.a scale test | Enrique | watch |
| 3.2 | **Tauri auto-updater.** No updater plugin registered; no update channel decided | `Phase 08` — with closed distribution, hand-delivered bundle iterations work short-term. Decide update channel (self-hosted static manifest vs. GitHub Releases) in Phase 08 planning | Enrique + Codex | Phase 08 |
| 3.3 | **Mobile / Linux builds.** Windows + macOS only per master plan | `accepted` — closed-distribution audience is on Windows/Mac desktop. No Linux or mobile demand | — | accepted |
| 3.4 | **Telemetry / analytics wiring.** No runtime telemetry; local crash reports only via `app_local_data_dir/crash-reports/` | `accepted` — closed distribution + direct feedback loop makes telemetry a surface-area liability. Revisit only if user count grows past direct-feedback capacity | Enrique | accepted |
| 3.5 | ~~**Real auth identity provider integration.**~~ | `closed` — descoped in master plan v5. See §2.3 | — | closed |

---

## §4. Packaging + distribution open questions

Decisions needed before first closed-distribution bundle ships.

| # | Question | Current state | Disposition | Owner | Target |
|---|---|---|---|---|---|
| 4.1 | **Windows code-signing certificate.** `tauri:build` currently produces unsigned MSI + NSIS. Windows SmartScreen will warn on first-run for every recipient | `src-tauri/tauri.conf.json` has no `windows.certificateThumbprint` or signing identity | **Ship unsigned for v2.0.0.** Coach recipients through the SmartScreen first-run warning ("More info" → "Run anyway"). Viable given closed distribution + direct feedback loop. Phase 08: acquire cert if recipient count grows past hand-holding capacity | Enrique | accepted (Phase 08 revisit) |
| 4.2 | **macOS notarization.** `tauri:build` on Mac will produce a `.dmg` that Gatekeeper blocks without notarization | No Apple developer account linked; no entitlements plist; hardened runtime flags absent | **Ship unsigned for v2.0.0.** Coach recipients through `xattr -d com.apple.quarantine /Applications/NocLense.app` from Terminal on first launch. Phase 08: Apple Developer Program enrollment ($99/yr) if recipient count grows | Enrique | accepted (Phase 08 revisit) |
| 4.3 | **Installer format.** `bundle.targets: "all"` in `tauri.conf.json` produces both MSI + NSIS on Windows. Shipping both to closed recipients adds confusion | `src-tauri/tauri.conf.json:30` | **NSIS only.** Smaller, single-file, no admin install required. Set `bundle.targets: ["nsis", "dmg"]` (or per-platform explicit list) in `tauri.conf.json` during 07I.a | Codex | 07I.a |
| 4.4 | **Update channel.** Master plan §8 punts to Phase 08, but recipients need a story for "how will I get v2.1.0 when it ships?" | No `updater` config in `tauri.conf.json` | `accepted` for v2.0.0 ship — re-send hand-delivered bundle. Phase 08: add updater plugin + self-hosted JSON manifest at a private URL | Enrique | accepted / Phase 08 |
| 4.5 | **Crash-report destination.** 07B.6 routed to `app_local_data_dir/crash-reports/`. No upload path; no user-facing "send crash report" affordance | `src-tauri/src/commands/crash_report.rs` | `accepted` for v2.0.0 — closed distribution + direct-feedback means local-only is fine; Enrique can ask a recipient to grab `%APPDATA%\com.axon.noclense\crash-reports\*.json` if a crash is reported | Enrique | accepted |
| 4.6 | **App version baseline.** `tauri.conf.json` declares `version: "2.0.0"`; SplashScreen displays `v4.2.0` in its right slot (carried over from pre-Phase-07 auth chrome) | Conflict between canonical app version and UI chrome | **Canonical is 2.0.0** per `tauri.conf.json` (matches `productName` + Phase 07 being a major rewrite). Update SplashScreen + AppShellSidebar chrome to read version at runtime via Tauri `getVersion()` API from `@tauri-apps/api/app`. Fallback to `package.json` import for dev-mode / test environments | Codex | 07I.a |
| 4.7 | **CSP: null.** `tauri.conf.json:26` explicitly disables CSP. Safe for a local-only desktop app with no remote content, but worth documenting intent before ship | `src-tauri/tauri.conf.json:25-27` | `accepted` — document rationale in `DEVELOPER_HANDOFF.md` during 07I.b. If any future feature pulls remote HTML/scripts (e.g. rendering vendor ticket previews), revisit | Enrique | 07I.b |

---

## §5. Post-merge backlog

Items surfaced during 07J.1 that don't belong to Phase 07 but shouldn't be lost. Becomes Phase 08 intake.

| # | Item | Source | Target |
|---|---|---|---|
| 5.1 | Add `window.localStorage.clear` polyfill to `src/test/setup.ts` to unblock the 18 baseline test failures | §1.5 | Phase 08 |
| 5.2 | Migrate vendor tokens (Zendesk / Jira / Datadog / Confluence) from localStorage to keyring with first-boot migration shim | §2.1 | Phase 08 |
| 5.3 | Tauri auto-updater plugin + self-hosted manifest | §3.2 | Phase 08 |
| 5.4 | Code-signing acquisition (Windows cert + Apple Developer enrollment) | §4.1, §4.2 | Phase 08 |
| 5.5 | Revisit MongoDB / backend architecture question from archived `docs/archive/2026-q1-architecture/LARGE_FILE_REVIEW.md` — decision has held (no backend, local-only), but worth a fresh look once user count grows | Archive reference | Phase 08 watch |
| 5.6 | CI integration of `/smoke-tauri` runbook runner — GitHub Actions job that runs the harness on every PR | 07J slice plan §6 | Phase 08 |
| 5.7 | Phase 06 leftover untracked files (`src/contexts/logContextObject.ts`, `useLogContext.ts`, etc.) — per-file audit to determine which are dead and which are in-progress work | §1.4 | 07I.a (if trivial) or Phase 08 |

---

## §6. Exit criteria for 07J.1 GO

Per the slice plan, 07J.1 cannot close until:

- [x] Every row above has a disposition + owner + target phase.
- [x] Enrique has signed off on each disposition (or redirected it). *Signed off via option (c) 2026-04-23 — see v2 revision row.*
- [x] No row in the "Deferred / descoped" section lacks a Phase 08 scope note if its target is Phase 08.
- [x] Packaging decisions in §4.1, §4.2, §4.3 are resolved — v2.0.0 ships unsigned on both platforms; NSIS-only on Windows; Phase 08 revisits signing if recipient count grows.
- [x] §1.6 large-file manual verification is scheduled as the first 07I.a gate.

**07J.1 GO** — 2026-04-23. Doc is now the reference for 07J.2 runbook authoring and 07I.a scope.
