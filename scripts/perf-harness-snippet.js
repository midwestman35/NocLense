/*
 * perf-harness-snippet.js — DevTools measurement runner for scroll-100k.
 *
 * Phase 01a checkpoint 5. This script runs inside the Electron
 * renderer (NOT Node). Paste it into DevTools Console with the
 * NocLense LogViewer mounted; it will:
 *
 *   1. Locate the scroll probe `[data-log-viewer-scroll]` (required —
 *      no guesswork; snippet fails loudly if the probe is missing).
 *   2. Preflight: verify scrollHeight > clientHeight.
 *   3. Derive the actual row count from `[data-log-viewer-rows]` —
 *      no hardcoded 100k.
 *   4. Programmatically scroll at 1000 px/s for 10 seconds,
 *      capturing requestAnimationFrame timestamps.
 *   5. Emit a versioned ScrollSamples payload (console + clipboard)
 *      that `scripts/perf-cli.ts submit` consumes.
 *
 * Selector and row-count contract match scripts/perf-harness.ts:
 *     LOG_VIEWER_SCROLL_PROBE = 'data-log-viewer-scroll'
 *     LOG_VIEWER_ROWS_PROBE   = 'data-log-viewer-rows'
 *     SAMPLES_SCHEMA_VERSION  = 1
 *
 * Drift between this file and those constants is caught by
 * scripts/__tests__/perf-harness.seam.test.ts.
 */

(() => {
  const SCROLL_PROBE = 'data-log-viewer-scroll';
  const ROWS_PROBE = 'data-log-viewer-rows';
  const SAMPLES_SCHEMA_VERSION = 1;
  const CAPTURE_SOURCE = 'perf-harness-snippet.js@ckpt5';
  const SCROLL_METHOD = 'programmatic-scrollby';
  const DURATION_MS = 10_000;
  const SCROLL_RATE_PX_S = 1000;

  const target = document.querySelector(`[${SCROLL_PROBE}]`);
  if (!target) {
    console.error(
      `perf-harness-snippet: probe [${SCROLL_PROBE}] not found. ` +
      'Ensure the LogViewer is mounted and rendering (Investigate phase, ' +
      'logs loaded). The probe is set on the scroll container in ' +
      'src/components/LogViewer.tsx.',
    );
    return;
  }

  if (target.scrollHeight <= target.clientHeight) {
    console.error(
      'perf-harness-snippet: scroll element has no overflow ' +
      `(scrollHeight=${target.scrollHeight}, clientHeight=${target.clientHeight}). ` +
      'Load a fixture with enough rows to require scrolling.',
    );
    return;
  }

  const rowsRaw = target.getAttribute(ROWS_PROBE);
  const rowsLoaded = rowsRaw !== null ? Number.parseInt(rowsRaw, 10) : NaN;
  if (!Number.isFinite(rowsLoaded) || rowsLoaded < 0) {
    console.error(
      `perf-harness-snippet: invalid row count on [${ROWS_PROBE}]: "${rowsRaw}". ` +
      'The probe must reflect the number of virtualized rows.',
    );
    return;
  }

  const startScrollTop = Math.round(target.scrollTop || 0);

  /** @type {number[]} */
  const frameTimestamps = [];
  let startTime = 0;
  let lastScrollTime = 0;

  function tick(t) {
    if (startTime === 0) {
      startTime = t;
      lastScrollTime = t;
    }
    frameTimestamps.push(t);

    if (t - startTime >= DURATION_MS) {
      const payload = {
        samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
        rowsLoaded,
        scrollDurationMs: Math.round(t - startTime),
        frameTimestamps,
        meta: {
          captureSource: CAPTURE_SOURCE,
          probeId: SCROLL_PROBE,
          scrollMethod: SCROLL_METHOD,
          startScrollTop,
          endScrollTop: Math.round(target.scrollTop || 0),
          captureUnixMs: Date.now(),
        },
      };
      const json = JSON.stringify(payload);
      console.log('perf-harness-snippet:result', json);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json).then(
          () => console.log(
            'perf-harness-snippet: copied to clipboard. Submit with:\n' +
            '  pbpaste | node --experimental-strip-types scripts/perf-cli.ts submit ' +
            '--phase 01a --scenario scroll-100k',
          ),
          (err) => console.warn('perf-harness-snippet: clipboard write failed', err),
        );
      }
      return;
    }

    const elapsed = t - lastScrollTime;
    const pxToScroll = (SCROLL_RATE_PX_S * elapsed) / 1000;
    target.scrollBy(0, pxToScroll);
    lastScrollTime = t;
    requestAnimationFrame(tick);
  }

  console.log(
    `perf-harness-snippet: starting 10s capture — ${rowsLoaded} rows, ` +
    `probe=${SCROLL_PROBE}, method=${SCROLL_METHOD}`,
  );
  requestAnimationFrame(tick);
})();
