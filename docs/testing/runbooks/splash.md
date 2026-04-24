# Runbook — Splash

**Surface:** `src/components/splash/SplashScreen.tsx`, wired via `src/components/app/AppSurface.tsx`
**Source commit:** `9b26610` (07C.2) + `5435464` (polish)
**Automation share:** 100% — fully drivable by 07J.3 Playwright harness
**Last updated:** 2026-04-23

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft, post-07C.2 polish. Covers the iterated splash (phrase cycler + TuiSpinner, no MacWindow shell). |

## Preconditions

- Tauri app built at `src-tauri/target/release/noclense.exe` (or macOS equivalent) **or** `npm run tauri:dev` running with Vite on port 5173.
- No persistent state required — splash is stateless across launches.
- OS reduced-motion preference can be toggled for the reduced-motion step: Windows Settings → Accessibility → Visual effects → Animation effects OFF; macOS System Settings → Accessibility → Display → Reduce motion ON.

## Steps

### 1. First paint on cold launch

**Action:** Launch NocLense (or reload the Tauri window with `Ctrl+R` in dev).

**Pass criteria:**
- Window title bar reads `NocLense`.
- Header bar (top, full width) renders:
  - Left side: mint-colored dot (1.5×1.5 px) + text `NocLense`.
  - Right side: current app version from `tauri.conf.json` / `package.json` (for example, `v2.0.0`) + `· Standalone`.
- Center stack is vertically and horizontally centered in the main content area:
  1. Rounded square (80×80 px) with dark-green gradient background + mint border; contains an animated braille spinner.
  2. Heading `NocLense` rendered in the large display face (40–60px depending on viewport).
  3. A phrase (one of `SPLASH_PHRASES`) renders below the heading via `LoadingLabel` with a character-by-character reveal animation.
  4. Primary button labeled `Continue` (48 rem wide) sits below the phrase.
- No console errors or warnings.

### 2. Phrase cycling

**Action:** Observe the phrase area without interacting.

**Pass criteria:**
- Phrase rotates through the 12 entries of `SPLASH_PHRASES` (`Reviewing…`, `Investigating…`, `Taking a look…`, `Thinking…`, `Working…`, `Puzzling it out…`, `Digging in…`, `Grepping…`, `Tracing…`, `Crunching…`, `Brewing…`, `Sifting…`).
- Rotation interval is 3.5 seconds (per `SPLASH_PHRASE_CYCLE_MS`).
- Each phrase plays the character-reveal animation fresh on every change (keyed re-mount).
- Screen-reader announces `Loading NocLense` (via `aria-status` on the `LoadingLabel` — not the raw cycling phrase, which would be noisy).

### 3. Reduced-motion honored

**Action:** Enable OS reduced-motion preference. Reload the Tauri window.

**Pass criteria:**
- Phrase does NOT cycle. It stays on the first entry (`Reviewing…`).
- Character-reveal animation may still play once on initial mount (per `LoadingLabel` keyframes); acceptable per Phase 04.5 motion conventions as long as the loop is suppressed.
- Braille spinner is permitted to keep animating (it's decorative); if this becomes an accessibility complaint, add a reduced-motion branch inside `TuiSpinner`.

### 4. Continue routes to Dashboard

**Action:** Click the Continue button.

**Pass criteria:**
- `DashboardScreen` mounts within ~300ms (state change, no network I/O).
- Splash unmounts cleanly — phrase-cycler interval is cleared (no orphaned `setInterval` in the React DevTools Profiler).
- No console errors or warnings.

### 5. Every-launch behavior

**Action:** With Dashboard visible, quit the app (not just close the window — fully terminate). Relaunch.

**Pass criteria:**
- Splash appears again on the fresh launch (per §2.b of the 07C.2 dispatch — every launch, no first-run skip marker).
- No "welcome back" or short-circuit state — splash is a clean branded moment every time.

### 6. Keyboard accessibility

**Action:** On splash, press `Tab`. Then press `Enter` or `Space`.

**Pass criteria:**
- First `Tab` focuses the Continue button (visible focus ring).
- `Enter` or `Space` activates Continue with the same outcome as Step 4.
- No focus traps elsewhere (only one interactive element on splash).

### 7. Window resize

**Action:** On splash, resize the window to minimum (1100×700 per `tauri.conf.json:17-18`) and to a wide laptop size (~1440×900).

**Pass criteria:**
- Content stays centered at all sizes.
- Header right-slot (`v2.0.0 · Standalone`, or the current app version) never wraps or overlaps with left-slot branding.
- No horizontal scrollbar.

## Known failure modes

| Symptom | Root cause | Fix / commit |
|---|---|---|
| Splash renders with 0px height; window looks black | Missing `html, body, #root { height: 100% }` cascade — MacWindow-era descendants collapsed without the explicit height chain | Fixed in `0c59d46` (2026-04-23). Watch for recurrence if any root-level layout refactor lands |
| Continue button present but click does nothing | `onContinue` prop not wired or `AppSurface` `setSurface` is stale-closured | Grep `AppSurface.tsx` for `'splash' → 'dashboard'` transition |
| Phrase stays on `Reviewing…` forever despite reduced-motion being OFF | `usePrefersReducedMotion` returning stale `true` due to OS-level media-query listener issue | Check `src/hooks/usePrefersReducedMotion.ts` subscription setup |
| Console warning about missing `aria-label` on TuiSpinner | `decorative` prop not passed — TuiSpinner defaults to announcing | Grep `SplashScreen.tsx` for `<TuiSpinner` and confirm `decorative` is present |
| Splash unmounts but phrase-cycler interval keeps running (memory leak) | `useEffect` cleanup missing or dependency array wrong | Confirm `return () => window.clearInterval(id)` in `SplashScreen.tsx:37` |

## Automation target (07J.3)

| Step | Automatable? | Notes |
|---|---|---|
| 1. First paint | YES | Playwright: `page.getByRole('heading', { name: 'NocLense' })`, `page.getByText(/v2\.0\.0/)` or the current app version, `page.getByRole('button', { name: 'Continue' })`. Capture screenshot for visual diff baseline |
| 2. Phrase cycling | YES | Wait 10 seconds, capture `LoadingLabel` text at 3 intervals, assert it's a member of `SPLASH_PHRASES` and changes between captures |
| 3. Reduced-motion | YES but flaky | Playwright's `emulateMedia({ reducedMotion: 'reduce' })` doesn't always propagate to Tauri's webview — may need to set the OS preference directly. Acceptable to skip if flaky; human coverage remains in this runbook |
| 4. Continue routes | YES | `page.getByRole('button', { name: 'Continue' }).click()`, then assert DashboardScreen markers appear |
| 5. Every-launch | YES | Playwright can kill the Tauri process + relaunch; assert splash re-appears |
| 6. Keyboard accessibility | YES | `page.keyboard.press('Tab')` + assert focus; `page.keyboard.press('Enter')` + assert navigation |
| 7. Window resize | YES | `page.setViewportSize({ width: 1100, height: 700 })` + screenshot, repeat at 1440×900 |

All 7 steps feed into `/smoke-tauri splash` as the first automated runbook once 07J.3 lands.
