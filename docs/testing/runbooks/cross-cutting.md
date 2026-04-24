# Runbook — Cross-cutting

**Surface:** Orthogonal concerns spanning the app — keyring, theme, window management, HMR, crash path, strict-port guard, forward navigation.
**Source commits:** Various across 07B–07C.2; key touchpoints noted per step.
**Automation share:** ~50% — several paths require OS-level interaction or subprocess spawning
**Last updated:** 2026-04-23

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft. Covers keyring round-trip, dark-only theme, window resize, HMR, crash path, strict-port guard, phase-dot forward nav. |

## Preconditions

- App installed (built bundle) AND dev env (`npm run tauri:dev`) both available — some steps test build vs. dev differences.
- OS reduced-motion toggle accessible.
- Ability to inspect OS keyring (Windows: Credential Manager; macOS: Keychain Access).
- Task Manager / Activity Monitor to check process state.

## Steps

### 1. Keyring round-trip (AI providers)

**Action:** In the built app, configure an AI provider (e.g., Claude). Enter an API key. Save. Quit the app fully. Relaunch.

**Pass criteria:**
- First save routes through `credentials().set('claude', ...)` which invokes `keyring_set` Tauri command.
- Key appears in OS keyring under service `com.axon.noclense`, key name `claude`.
- After relaunch, `credentials().get('claude')` returns the stored value without re-prompting.
- Key is NOT visible in `localStorage` or any renderer state — confirm via DevTools.

### 2. Keyring round-trip (GitHub PAT)

**Action:** Repeat Step 1 for `github_pat`.

**Pass criteria:**
- Same round-trip succeeds independently from `claude` / `unleash` / etc.
- Each credential key has its own keyring entry; no overwriting.

### 3. Keyring unavailable fallback

**Action:** On a machine where keyring is unavailable (e.g. headless Linux, broken Credential Manager service — simulate by temporarily disabling the service), launch the app.

**Pass criteria:**
- `credentials().isAvailable()` returns `false`.
- App surfaces a clear error message ("Secure credential storage is unavailable — contact support") instead of silently failing or crashing.
- No partial state — keys aren't written to localStorage as a fallback.

### 4. Dark-only theme (no light-mode flashes)

**Action:** Launch the app with the OS in light-mode preference (Windows: Settings → Personalization → Colors → Light). Observe first paint.

**Pass criteria:**
- App renders in dark mode regardless of OS preference.
- No "flash of unstyled content" in light colors between mount and first paint.
- All screens (Splash, Dashboard, all rooms) render with dark tokens (`--bg-0`, `--ink-0`, etc.).
- Inspect `:root` or `html` element: no light-mode media query fires.

### 5. Theme toggle (verify no-op if dark-only)

**Action:** Click the theme toggle button in `PhaseHeader` (investigate room → top-right).

**Pass criteria:**
- If Phase 07 ships dark-only: clicking has no user-visible effect, or button is hidden entirely.
- If light-mode support is still wired (legacy code): toggle switches to light — **this is a regression** per dark-only spec. Raise as an inventory item.

### 6. Window resize — minimum size honored

**Action:** Try to resize the window below 1100×700.

**Pass criteria:**
- OS window manager enforces the minimum (per `tauri.conf.json:17-18` `minWidth: 1100, minHeight: 700`).
- Window cannot be dragged smaller than that.

### 7. Window resize — content reflow

**Action:** Resize across the useful range (1100×700 to 1920×1080 to 2560×1440 if on a 4K monitor).

**Pass criteria:**
- Every surface reflows without clipped content or horizontal scrollbars.
- Sidebar width stays fixed or scales per spec.
- Investigate Room's 6-card grid rearranges gracefully (stacks on narrow, spreads on wide).
- No console errors from ResizeObserver loops.

### 8. HMR in `npm run tauri:dev`

**Action:** Start `tauri:dev`. Edit a component (e.g., change a button label in `SplashScreen.tsx`).

**Pass criteria:**
- Vite HMR reloads the component within 1–2s.
- Tauri window updates without full reload.
- Component state (non-persisted) resets appropriately; app state (IndexedDB, keyring) persists.
- No "module not found" or "cannot HMR" errors in Vite console.

### 9. Strict-port guard

**Action:** With `tauri:dev` already running on port 5173, launch another Vite dev server (e.g. `npm run dev`) in a second terminal.

**Pass criteria:**
- Second Vite instance fails loudly with "Port 5173 is already in use" and exits non-zero.
- This is because `vite.config.ts:25` has `strictPort: true` (re-committed in `5435464` after regression).
- Tauri's hardcoded `devUrl: http://localhost:5173` stays valid.

### 10. Crash path — Rust panic

**Action:** Trigger a controlled panic. If a debug-only panic button is exposed, use it. Otherwise, call the `crash_test` Tauri command via browser DevTools: `await window.__TAURI__.core.invoke('crash_test')` (if command exists — verify).

**Pass criteria:**
- Rust panics cleanly; crash report writes to `<app_local_data_dir>/crash-reports/<timestamp>.json`.
- On Windows: `%APPDATA%\com.axon.noclense\crash-reports\`.
- On macOS: `~/Library/Application Support/com.axon.noclense/crash-reports/`.
- JSON contains: panic message, stack trace, OS info, app version.
- App exits (or displays a crash dialog then exits).

### 11. Forward phase navigation

**Action:** From Import Room (fresh case, no imports), click the Submit phase dot.

**Pass criteria:**
- Navigation succeeds (per post-07C.2 polish — forward nav is intentional).
- Submit Room renders with empty state (no logs, no evidence, no closure note).
- Returning to Import and completing the flow still works normally.

### 12. Native file dialog (Import path)

**Action:** In Import Room, click Upload. OS native file picker opens.

**Pass criteria:**
- Dialog is OS-native, not a browser-style `<input type="file">` popup.
- File-type filter honored (`.log`, `.txt`, `.csv`, etc.).
- Multi-select allowed if designed for multi-file import.
- Selected file path is accessible via Tauri plugin-dialog + plugin-fs capabilities.

### 13. No direct web platform API usage from components

**Action:** Inspect `src/components/` for direct `fetch()`, `XMLHttpRequest`, `window.fs`, or Electron `remote` / `ipcRenderer` calls.

**Pass criteria:**
- Zero direct network calls from components — all routed through `src/services/*`.
- Zero references to `electronAPI`, `ipcRenderer`, `contextBridge` (verify with grep — these should have been killed in 07B).
- Zero references to Node.js built-ins (`fs`, `path`, `child_process`) in `src/`.
- All native access routes through Tauri `invoke()` in service wrappers.

### 14. `tauri:build` produces expected artifacts

**Action:** Run `npm run tauri:build`.

**Pass criteria:**
- On Windows: produces MSI + NSIS installers in `src-tauri/target/release/bundle/`.
- On macOS: produces `.dmg` + `.app` bundle.
- Bundles are unsigned (per inventory §4.1 / §4.2 — shipping unsigned for v2.0.0).
- Bundle size is under a reasonable threshold (<100MB for the NSIS installer).

## Known failure modes

| Symptom | Root cause | Fix / watch |
|---|---|---|
| Keyring save silently fails | OS keyring service not running (Windows: "Credential Manager" service disabled) | `credentials().isAvailable()` should catch this; error surfacing is the fix |
| Light-mode flash on launch | `body` background set via inline style from JS, not from CSS tokens | Check `src/index.css` + `src/styles/tokens.css` for `:root { background: var(--bg-0) }` |
| HMR reload loop | Circular import chain triggered by a recent refactor | Vite console will name the files; break the cycle |
| Strict-port guard warns but doesn't exit | `strictPort: true` got flipped back to `false` (happened once during the MacWindow debug session — hotfix `5435464` re-reverted) | Grep `vite.config.ts` for `strictPort: true` |
| Crash report JSON malformed | Serialization of the panic payload broke | Check `src-tauri/src/commands/crash_report.rs` serde setup |
| Native dialog shows browser-style picker instead | `plugin-dialog` not registered in Rust, OR capability missing in `default.json` | Check both locations |

## Automation target (07J.3)

| Step | Automatable? | Notes |
|---|---|---|
| 1. Keyring AI provider | YES | Set via API → kill process → relaunch → read. Tauri sidecar can expose `keyring_get` for test verification |
| 2. Keyring GitHub PAT | YES | Same pattern as Step 1 |
| 3. Keyring unavailable fallback | NO (human only) | Requires disabling OS service — too destructive for automation |
| 4. Dark-only theme | PARTIAL | Set OS preference via Playwright's `emulateMedia`; visual-diff baseline needed for "no flash" assertion |
| 5. Theme toggle | YES | Click + assert no state change |
| 6. Minimum window size | NO (Tauri API) | Tauri plugin-window doesn't expose resize-to-below-min via event, would need OS-level input simulation |
| 7. Content reflow | PARTIAL | Screenshot at multiple sizes; visual-diff baselines needed |
| 8. HMR | NO (human only) | File-edit during test is orthogonal to normal run |
| 9. Strict-port guard | YES | Spawn second `vite` subprocess, assert non-zero exit + error message |
| 10. Crash path | YES | Invoke `crash_test` command, assert crash-reports file written, assert process exited |
| 11. Forward phase nav | YES | Click Submit dot from Import, assert Submit mount |
| 12. Native file dialog | PARTIAL | Tauri's dialog has an event channel test harness can subscribe to; real OS picker stays manual |
| 13. No direct web APIs | YES | Static grep via `tools/claude-automation` — integrate into pre-commit hooks per 07J.3.c |
| 14. `tauri:build` artifacts | YES | Run build, assert artifacts exist + file sizes |

`/smoke-tauri cross-cutting` runs steps 1, 2, 5, 9, 10, 11, 13, 14 automatically. Steps 3, 6, 8, 12 stay as manual gates per this runbook.
