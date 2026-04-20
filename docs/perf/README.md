# NocLense performance harness

Phase 01a checkpoint 5 of the UI polish redesign.

The harness closes the measurability gap for design spec §4.8 / §6.4 by
producing **schema-versioned, runtime-validated, threshold-evaluated**
result artifacts from raw measurements. CI does not run it (Electron
scroll capture is flaky in headless). Developers capture samples
locally before closing a phase and commit the result JSON to
`docs/perf/`.

## What's implemented

All deterministic pieces plus a thin CLI wrapping them:

- Fixture generator with sidecar manifest (seed, generator version,
  expected row count, intended scenario, content sha256).
- FPS percentile computation (nearest-rank p5/p50/p95 + average).
- Per-scenario pass-threshold evaluation (values lifted verbatim
  from spec §6.4).
- Runtime validators for raw samples AND result artifacts — path-
  precise error messages, scenario ↔ metric-kind alignment enforced.
- Schema-versioned result I/O (`HARNESS_RESULT_SCHEMA_VERSION = 1`,
  `SAMPLES_SCHEMA_VERSION = 1`, `FIXTURE_GENERATOR_VERSION = 1`,
  all independent).
- First-class provenance on every result: measurement mode, capture
  source, probe id, actual rows loaded (from DOM, not hardcoded),
  sample count, scroll method, app version, build mode, fixture id +
  generator version, hardware source quality.
- Integration seam test verifying that the DevTools snippet's DOM
  contract matches the TS harness.

## What still runs manually

Automated Electron launch + DevTools orchestration. The measurement
itself runs inside the renderer via a paste-in snippet. Manual
capture produces the same result artifact as automated would, so this
stays deferred.

## Measurement doctrine (design spec §4.8)

NocLense uses **programmatic scrollBy + requestAnimationFrame
timestamps** captured in the renderer. Not CDP / Chrome DevTools
Protocol `Performance.getMetrics()`. rAF samples give directly-
observed frame intervals at the source without requiring a CDP
client, and the numerical result for scroll FPS is equivalent.
Spec §4.8 was updated in checkpoint 5 to reflect this choice. The
scroll method is stamped on every result
(`provenance.scrollMethod: 'programmatic-scrollby'`).

## Scenarios

Scroll-100k is the only scenario with a complete manual-run flow
today (LogViewer exists and is virtualized). The others are
parameterized in `evaluatePassThresholds` and wait on their
surfaces to exist in later phases.

| Scenario | Phase unblock | How measured |
|---|---|---|
| `scroll-100k` | 01a (now) | Snippet + existing LogViewer |
| `parse-50mb` | 02 | After OC parser lands |
| `parse-200mb-indexeddb` | 02 | Same |
| `citation-jump-latency` | 02 | After citation-jump choreography lands |
| `ai-diagnose-turnaround` | 01b | After canonical renderer lands |
| `evidence-export-20-items` | 03 | After .noclense export lands |
| `memory-idle-10min` | 01a/02 | Electron `process.memoryUsage()` sampling |

## Running `scroll-100k` locally

### 1. Generate a fixture

```bash
node --experimental-strip-types scripts/perf-cli.ts generate \
  --rows 100000 --seed 42 --scenario scroll-100k \
  --out docs/perf/fixtures/scroll-100k.log
```

Emits `scroll-100k.log` plus `scroll-100k.log.manifest.json`
(fixture id, seed, generator version, expected rows, content hash).

### 2. Launch the production Electron build

```bash
npm run electron:build       # one-time
# Launch the packaged app.
# Navigate to Investigate phase, open the Log Stream card, load the
# fixture from step 1. Confirm rows are rendering.
```

### 3. Capture samples in DevTools

Open DevTools (Ctrl+Shift+I → Console). Paste the entire contents of
`scripts/perf-harness-snippet.js` and press Enter. The snippet will:

- Find `[data-log-viewer-scroll]` on the real scroll container
  (fails loudly if the probe isn't present — no selector guessing).
- Preflight: verify `scrollHeight > clientHeight`.
- Read actual row count from `[data-log-viewer-rows]` (no
  hardcoded 100k).
- Programmatically scroll at 1000 px/s for 10 seconds.
- Emit a versioned `ScrollSamples` payload (logged to console,
  copied to clipboard).

### 4. Submit samples → validated result JSON

Paste the clipboard contents to the CLI's stdin:

```bash
pbpaste | node --experimental-strip-types scripts/perf-cli.ts submit \
  --phase 01a --scenario scroll-100k \
  --build-mode electron-production \
  --fixture-id scroll-100k-seed42 \
  --app-version 2.0.0 \
  --build-sha $(git rev-parse --short HEAD)
```

(Substitute the clipboard-paste command for your OS — `xclip -sel clip -o`
on Linux, `Get-Clipboard` in PowerShell.)

The CLI runs `validateScrollSamples` on the raw payload, builds a
typed result, writes it to
`docs/perf/01a-scroll-100k-YYYYMMDD-HHMMSS.json`, and exits 0 on
pass / 1 on fail. Failure messages are printed with specific
threshold breaches.

### 5. Validate or inspect existing results

```bash
# Structural re-validate (useful after hand-editing a committed result):
node --experimental-strip-types scripts/perf-cli.ts validate \
  docs/perf/01a-scroll-100k-*.json

# Human-readable summary:
node --experimental-strip-types scripts/perf-cli.ts show \
  docs/perf/01a-scroll-100k-*.json
```

## Result artifact shape

Every written result is a `HarnessResult<S>` from `perf-harness.ts`.
The result is a superset of what Phase 00 defined — provenance and
hardware `sourceQuality` were added in checkpoint 5.

```json
{
  "resultSchemaVersion": 1,
  "phase": "01a",
  "scenario": "scroll-100k",
  "startedAt": 1745000000000,
  "completedAt": 1745000010000,
  "hardware": {
    "os": "win32",
    "osVersion": "10.0.26100",
    "cpuModel": "12th Gen Intel(R) Core(TM) i7-…",
    "cpuLogicalCores": 20,
    "totalMemoryGb": 32,
    "gpuDescription": "Intel UHD 770",
    "sourceQuality": "manual-override"
  },
  "buildSha": "94faeca",
  "metrics": {
    "kind": "scroll",
    "rowsLoaded": 100000,
    "scrollDurationMs": 10000,
    "fpsAverage": 58.2,
    "fpsP5": 47.1,
    "fpsP50": 60.0,
    "fpsP95": 60.0,
    "droppedFrames": 7,
    "longFrames": 0
  },
  "provenance": {
    "measurementMode": "manual-devtools",
    "captureSource": "perf-harness-snippet.js@ckpt5",
    "probeId": "data-log-viewer-scroll",
    "actualRowsLoaded": 100000,
    "sampleCount": 601,
    "scrollMethod": "programmatic-scrollby",
    "appVersion": "2.0.0",
    "buildMode": "electron-production",
    "fixtureId": "scroll-100k-seed42",
    "fixtureGeneratorVersion": 1
  },
  "passed": true,
  "failures": []
}
```

## Schema versions (independent)

| Constant | Purpose | Bump when |
|---|---|---|
| `HARNESS_RESULT_SCHEMA_VERSION` | Result artifact layout | adding/removing/renaming fields |
| `SAMPLES_SCHEMA_VERSION` | Raw capture payload | changing what the snippet emits |
| `FIXTURE_GENERATOR_VERSION` | Fixture content | changing the generator so old hashes don't match |

Runtime validators fail artifacts/samples whose version doesn't
match the current constant.

## Fixture integrity

The fixture manifest (`<fixture>.manifest.json`) stores the seed,
generator version, expected row count, intended scenario, and the
SHA-256 of the fixture content. A benchmark result's
`provenance.fixtureId` should match a manifest committed to the
repo so results are comparable across checkpoints.

The current generator's `generatorProfile` is `'synthetic-simple'`.
A future corpus-derived generator would introduce
`'corpus-v1'` as a new value, bump `FIXTURE_GENERATOR_VERSION`, and
not overlap with existing result artifacts.
