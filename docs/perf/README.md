# NocLense performance harness

Phase 01a checkpoint 4 of the UI polish redesign.

The harness closes the measurability gap for design spec §4.8 / §6.4 by
producing **schema-versioned, threshold-evaluated** result artifacts from
raw measurements. CI does not run it (Electron + scroll measurement is
flaky in headless). Developers capture samples locally before closing a
phase and commit the resulting JSON to `docs/perf/`.

## What's implemented

All pure / deterministic pieces:

- Synthetic fixture generation (`generateSyntheticLogFile`)
- FPS percentile computation from rAF samples (`computeFpsPercentiles`)
- Per-scenario pass-threshold evaluation (`evaluatePassThresholds`)
- Raw-samples → typed metrics builders (`buildScrollMetrics`)
- End-to-end sample submission (`submitScrollSamples`)
- Schema-versioned result I/O (`writeResult` / `readResult`)
- Host hardware capture (`gatherHardwareInfo`)

All covered by `scripts/__tests__/perf-harness.test.ts`.

## What still runs manually

Automated Electron launch + DevTools orchestration. The measurement
itself runs inside the renderer via a paste-in snippet. This is
documented (not deferred further) because a manual capture produces
the same result artifact as an automated one would.

## Scenarios

From design spec §6.4. Scroll-100k is the first scenario with a real
manual-run flow below. The others are parameterized in
`evaluatePassThresholds` and waiting on their surfaces to exist in
later phases.

| Scenario | Phase unblock | How measured |
|---|---|---|
| `scroll-100k` | 01a (now) | Snippet + existing LogViewer |
| `parse-50mb` | 02 | Phase 02 adds OC parser + harness integration |
| `parse-200mb-indexeddb` | 02 | Same |
| `citation-jump-latency` | 02 | After citation-jump choreography lands |
| `ai-diagnose-turnaround` | 01b | After canonical renderer lands |
| `evidence-export-20-items` | 03 | After .noclense export pipeline lands |
| `memory-idle-10min` | 01a/02 | Electron process.memoryUsage sampling |

## Running `scroll-100k` locally

### 1. Produce the 100k fixture

```bash
node --experimental-strip-types scripts/perf-generate-fixture.ts \
  --rows 100000 --seed 42 > docs/perf/fixtures/scroll-100k.log
```

(The generator is wired through `generateSyntheticLogFile`. A thin
CLI wrapper lands in the next increment; for now, invoke
programmatically or via a tiny one-liner:
`node -e "import('./scripts/perf-harness.js').then(m => console.log(m.generateSyntheticLogFile(100000, 42)))"`.)

### 2. Launch the production Electron build

```bash
npm run electron:build    # one-time
# Launch the packaged app. Open the log viewer. Load the fixture.
```

### 3. Capture samples in DevTools

Open DevTools (Ctrl+Shift+I), switch to Console, paste the entire
contents of `scripts/perf-harness-snippet.js`, and run it. The
snippet will:

- Scroll programmatically at 1000 px/s for 10 seconds.
- Capture `requestAnimationFrame` timestamps.
- Log a JSON payload starting with `perf-harness-snippet:result` and
  copy it to the clipboard.

### 4. Submit samples → validated result JSON

Paste the JSON into a file, then:

```bash
# Pseudocode — wire via the programmatic API for now:
node --experimental-strip-types -e "
  const h = await import('./scripts/perf-harness.ts');
  const samples = JSON.parse(/* pasted JSON */);
  const result = h.submitScrollSamples(
    { phase: '01a', scenario: 'scroll-100k',
      fixturePaths: ['docs/perf/fixtures/scroll-100k.log'] },
    samples,
  );
  const path = h.writeResult(result);
  console.log('wrote', path);
  console.log('passed:', result.passed);
  if (!result.passed) console.log('failures:', result.failures);
"
```

A future increment adds a `scripts/perf-cli.ts` wrapper for steps 1
and 4. Today it's programmatic.

## Result artifact shape

Every written result is a `HarnessResult<S>` from `perf-harness.ts`:

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
    "gpuDescription": "Intel UHD 770"
  },
  "buildSha": "f59a66d",
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
  "passed": true,
  "failures": []
}
```

## Schema version

`HARNESS_RESULT_SCHEMA_VERSION = 1`. Independent of the canonical
investigation schema and the `.noclense` manifest schema. Bump when
the result shape changes in a way that breaks existing readers.
