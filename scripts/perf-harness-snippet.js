/*
 * perf-harness-snippet.js — paste-into-DevTools measurement runner.
 *
 * Phase 01a checkpoint 4. This script runs inside the Electron
 * renderer (NOT Node). Paste it into DevTools Console with the
 * NocLense log viewer loaded, and it will:
 *
 *   1. Find the virtualized log scroll element.
 *   2. Programmatically scroll at ~1000px/s for 10 seconds.
 *   3. Capture requestAnimationFrame timestamps.
 *   4. Log the result as JSON to the console AND copy to clipboard.
 *
 * After the run, execute this in a terminal at the repo root to
 * persist and evaluate the samples:
 *
 *   pbpaste | node --experimental-strip-types \
 *     scripts/perf-cli.ts submit \
 *     --scenario scroll-100k --phase 01a
 *
 * (Replace `pbpaste` with your OS clipboard-paste command.)
 */

(() => {
  const DURATION_MS = 10_000;
  const SCROLL_RATE_PX_S = 1000;

  // Candidate selectors — tuned for the current LogViewer DOM. Update
  // when the component structure changes.
  const SELECTORS = [
    '[data-log-viewer-scroll]',
    '[data-testid="log-viewer-scroll"]',
    '.log-viewer-scroll',
  ];

  let target = null;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      target = el;
      break;
    }
  }
  if (!target) {
    // Fall back: look for tanstack-virtual's internal scroll element.
    const tv = document.querySelector('[data-tanstack-virtual]')
      || document.querySelector('.log-grid')?.parentElement?.parentElement;
    if (tv) target = tv;
  }

  if (!target) {
    console.error(
      'perf-harness-snippet: could not locate log viewer scroll element. ' +
      'Verify the LogViewer is open and DOM selectors match.'
    );
    return;
  }

  const startScrollTop = Math.round(target.scrollTop || 0);
  const rowsLoaded = 100_000; // snapshot assumption — update per scenario

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
      const samples = {
        rowsLoaded,
        scrollDurationMs: Math.round(t - startTime),
        frameTimestamps,
        meta: {
          startScrollTop,
          endScrollTop: Math.round(target.scrollTop || 0),
          frames: frameTimestamps.length,
          selectorUsed: target.tagName + (target.className ? '.' + target.className.split(' ')[0] : ''),
          captureUnixMs: Date.now(),
        },
      };
      const json = JSON.stringify(samples);
      console.log('perf-harness-snippet:result', json);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json).then(
          () => console.log('perf-harness-snippet: samples copied to clipboard'),
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

  console.log('perf-harness-snippet: starting 10s scroll capture');
  requestAnimationFrame(tick);
})();
