/**
 * perf-harness.ts — NocLense performance benchmark harness
 *
 * Phase 01a checkpoint 4 implementation. Covers every pure
 * computation required by design spec §4.8 and §6.4:
 *   - Synthetic fixture generation (reproducible from a seed)
 *   - FPS percentile computation from rAF interval samples
 *   - Per-scenario pass-threshold evaluation
 *   - Schema-versioned result artifact I/O
 *   - Hardware info capture from the host Node runtime
 *
 * What this file does NOT do (by design — see docs/perf/README.md):
 *   The actual scroll / parse / diagnose / export measurement runs
 *   inside the Electron renderer. Developers paste
 *   `scripts/perf-harness-snippet.js` into DevTools with the target
 *   surface loaded, capture raw samples, then call
 *   `submitSamples(config, raw)` here to produce a validated result.
 *
 *   This split keeps the harness honest: the measurement path is a
 *   documented manual flow, the result pipeline is fully tested.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { cpus, platform, release, totalmem } from 'node:os';

// ─── Result schema versioning ────────────────────────────────────────────

/** Bumped when HarnessResult shape changes. Separate from investigation / manifest versions. */
export const HARNESS_RESULT_SCHEMA_VERSION = 1 as const;
export type HarnessResultSchemaVersion = typeof HARNESS_RESULT_SCHEMA_VERSION;

// ─── Scenarios + typed metrics ───────────────────────────────────────────

export type HarnessScenario =
  | 'scroll-100k'
  | 'parse-50mb'
  | 'parse-200mb-indexeddb'
  | 'citation-jump-latency'
  | 'ai-diagnose-turnaround'
  | 'evidence-export-20-items'
  | 'memory-idle-10min';

export interface ScrollMetrics {
  kind: 'scroll';
  rowsLoaded: number;
  scrollDurationMs: number;
  fpsAverage: number;
  fpsP5: number;
  fpsP50: number;
  fpsP95: number;
  droppedFrames: number;
  longFrames: number;
}

export interface ParseMetrics {
  kind: 'parse';
  fileSizeBytes: number;
  dropToFirstRowVisibleMs: number;
  endToEndParseMs: number;
  /** MB/sec — endToEndParseMs divided into file size. */
  throughputMbps: number;
  peakHeapMb: number;
  indexedDbUsed: boolean;
}

export interface LatencyMetrics {
  kind: 'latency';
  /** From input event to first visible feedback. */
  perceivedMs: number;
  /** From input event to animation complete. */
  totalAnimationMs: number;
}

export interface TurnaroundMetrics {
  kind: 'turnaround';
  requestStartMs: number;
  firstBlockVisibleMs: number;
  fullResponseRenderedMs: number;
  networkTransferMs: number;
}

export interface ExportMetrics {
  kind: 'export';
  itemCount: number;
  zipSizeBytes: number;
  totalMs: number;
  peakHeapMb: number;
}

export interface MemoryMetrics {
  kind: 'memory';
  startHeapMb: number;
  endHeapMb: number;
  peakHeapMb: number;
  growthMb: number;
  gcEvents: number;
  observationWindowMs: number;
}

export type ScenarioMetricsMap = {
  'scroll-100k': ScrollMetrics;
  'parse-50mb': ParseMetrics;
  'parse-200mb-indexeddb': ParseMetrics;
  'citation-jump-latency': LatencyMetrics;
  'ai-diagnose-turnaround': TurnaroundMetrics;
  'evidence-export-20-items': ExportMetrics;
  'memory-idle-10min': MemoryMetrics;
};

export type MetricsFor<S extends HarnessScenario> = ScenarioMetricsMap[S];

// ─── Config + Result ─────────────────────────────────────────────────────

export interface HardwareInfo {
  os: string;
  osVersion: string;
  cpuModel: string;
  cpuLogicalCores: number;
  totalMemoryGb: number;
  /** GPU identifier. 'unknown' from Node host; Electron runner can fill via app.getGPUInfo(). */
  gpuDescription: string;
}

export type HarnessPhase = '01a' | '01b' | '01c' | '02' | '03' | '04' | '05';

export interface HarnessConfig<S extends HarnessScenario = HarnessScenario> {
  phase: HarnessPhase;
  scenario: S;
  /** Absolute path to the production build under test (documentation only for now). */
  electronBuildPath?: string;
  /** Scenarios may need multiple fixtures (log file + correlation ground-truth, etc.). */
  fixturePaths: string[];
  /** Optional override for output directory. Default: <repo>/docs/perf/. */
  outputDir?: string;
  /** Optional git SHA for provenance; recorded verbatim in the result. */
  buildSha?: string;
}

export interface HarnessResult<S extends HarnessScenario = HarnessScenario> {
  resultSchemaVersion: HarnessResultSchemaVersion;
  phase: HarnessPhase;
  scenario: S;
  startedAt: number;
  completedAt: number;
  hardware: HardwareInfo;
  buildSha?: string;
  metrics: MetricsFor<S>;
  passed: boolean;
  failures: string[];
}

// ─── Hardware detection ──────────────────────────────────────────────────

/**
 * Gathers host hardware info from Node's `os` module. GPU identifier is not
 * available from Node; stays 'unknown' unless the caller overrides it via
 * `overrides` (the Electron runner can pass `app.getGPUInfo()` output here).
 */
export function gatherHardwareInfo(overrides: Partial<HardwareInfo> = {}): HardwareInfo {
  const cpuList = cpus();
  return {
    os: platform(),
    osVersion: release(),
    cpuModel: cpuList[0]?.model?.trim() ?? 'unknown',
    cpuLogicalCores: cpuList.length,
    totalMemoryGb: Math.round(totalmem() / 1024 ** 3),
    gpuDescription: 'unknown',
    ...overrides,
  };
}

// ─── FPS percentile computation ──────────────────────────────────────────

export interface FpsPercentiles {
  avg: number;
  p5: number;
  p50: number;
  p95: number;
}

/**
 * Compute FPS percentiles from frame interval samples (milliseconds).
 * `intervalsMs[i]` is the duration between frame i and frame i-1.
 *
 * p5 is the 5th percentile of instantaneous FPS — i.e. the worst-5%
 * FPS value. A low p5 means janky frames even if the average is high.
 */
export function computeFpsPercentiles(intervalsMs: readonly number[]): FpsPercentiles {
  const usable = intervalsMs.filter((i) => i > 0 && Number.isFinite(i));
  if (usable.length === 0) {
    return { avg: 0, p5: 0, p50: 0, p95: 0 };
  }
  const fpsSamples = usable.map((i) => 1000 / i);
  const sorted = [...fpsSamples].sort((a, b) => a - b);
  const sum = fpsSamples.reduce((a, b) => a + b, 0);
  return {
    avg: round2(sum / fpsSamples.length),
    p5: round2(percentile(sorted, 0.05)),
    p50: round2(percentile(sorted, 0.5)),
    p95: round2(percentile(sorted, 0.95)),
  };
}

/**
 * Nearest-rank percentile on a sorted-ascending array. For q=0.05 on a
 * 100-sample array, returns sortedAsc[4] — "the highest FPS that 5% of
 * the samples fall at or below". This matches spec §6.4's use of p5 as
 * a lower-bound gate ("≥ 45 fps p5" means 95% of frames are at or
 * above 45 fps).
 */
function percentile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil(sortedAsc.length * q);
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, rank - 1));
  return sortedAsc[idx];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Scroll metrics builder ──────────────────────────────────────────────

export interface ScrollSamples {
  rowsLoaded: number;
  scrollDurationMs: number;
  /** Monotonic `performance.now()` timestamps captured in the renderer. */
  frameTimestamps: readonly number[];
}

/** Builds ScrollMetrics from raw rAF timestamp samples. Pure. */
export function buildScrollMetrics(samples: ScrollSamples): ScrollMetrics {
  const intervals: number[] = [];
  for (let i = 1; i < samples.frameTimestamps.length; i++) {
    intervals.push(samples.frameTimestamps[i] - samples.frameTimestamps[i - 1]);
  }
  const p = computeFpsPercentiles(intervals);
  // At 60fps target, a frame takes ~16.67ms. >20ms = dropped, >50ms = stall.
  const droppedFrames = intervals.filter((i) => i > 20).length;
  const longFrames = intervals.filter((i) => i > 50).length;
  return {
    kind: 'scroll',
    rowsLoaded: samples.rowsLoaded,
    scrollDurationMs: samples.scrollDurationMs,
    fpsAverage: p.avg,
    fpsP5: p.p5,
    fpsP50: p.p50,
    fpsP95: p.p95,
    droppedFrames,
    longFrames,
  };
}

// ─── Threshold evaluation ────────────────────────────────────────────────

/** Thresholds lifted from design spec §6.4. Warm-cache targets (stricter side). */
export const PASS_THRESHOLDS = {
  scroll: {
    fpsAverageMin: 55,
    fpsP5Min: 45,
  },
  parse50: {
    dropToFirstRowVisibleMsMax: 8_000,
    throughputMbpsMin: 40,
  },
  parse200: {
    endToEndParseMsMax: 45_000,
  },
  citationJump: {
    perceivedMsMax: 500,
    totalAnimationMsMax: 1_000,
  },
  aiDiagnose: {
    firstBlockVisibleMsMax: 10_000,
    fullResponseRenderedMsMax: 25_000,
  },
  evidenceExport: {
    totalMsMax: 2_000,
  },
  memory: {
    growthMbMax: 50,
  },
} as const;

/**
 * Evaluate pass thresholds for a scenario. Returns the list of specific
 * failures (empty = pass). Scenario + metric shape are type-constrained
 * by MetricsFor<S> so invalid pairings are compile errors.
 */
export function evaluatePassThresholds<S extends HarnessScenario>(
  metrics: MetricsFor<S>,
  scenario: S,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  switch (scenario) {
    case 'scroll-100k': {
      const m = metrics as ScrollMetrics;
      if (m.fpsAverage < PASS_THRESHOLDS.scroll.fpsAverageMin) {
        failures.push(
          `fpsAverage ${m.fpsAverage} < ${PASS_THRESHOLDS.scroll.fpsAverageMin} (scroll-100k)`,
        );
      }
      if (m.fpsP5 < PASS_THRESHOLDS.scroll.fpsP5Min) {
        failures.push(
          `fpsP5 ${m.fpsP5} < ${PASS_THRESHOLDS.scroll.fpsP5Min} (scroll-100k)`,
        );
      }
      break;
    }
    case 'parse-50mb': {
      const m = metrics as ParseMetrics;
      if (m.dropToFirstRowVisibleMs > PASS_THRESHOLDS.parse50.dropToFirstRowVisibleMsMax) {
        failures.push(
          `dropToFirstRowVisibleMs ${m.dropToFirstRowVisibleMs} > ${PASS_THRESHOLDS.parse50.dropToFirstRowVisibleMsMax} (parse-50mb)`,
        );
      }
      if (m.throughputMbps < PASS_THRESHOLDS.parse50.throughputMbpsMin) {
        failures.push(
          `throughputMbps ${m.throughputMbps} < ${PASS_THRESHOLDS.parse50.throughputMbpsMin} (parse-50mb)`,
        );
      }
      break;
    }
    case 'parse-200mb-indexeddb': {
      const m = metrics as ParseMetrics;
      if (m.endToEndParseMs > PASS_THRESHOLDS.parse200.endToEndParseMsMax) {
        failures.push(
          `endToEndParseMs ${m.endToEndParseMs} > ${PASS_THRESHOLDS.parse200.endToEndParseMsMax} (parse-200mb-indexeddb)`,
        );
      }
      break;
    }
    case 'citation-jump-latency': {
      const m = metrics as LatencyMetrics;
      if (m.perceivedMs > PASS_THRESHOLDS.citationJump.perceivedMsMax) {
        failures.push(
          `perceivedMs ${m.perceivedMs} > ${PASS_THRESHOLDS.citationJump.perceivedMsMax} (citation-jump)`,
        );
      }
      if (m.totalAnimationMs > PASS_THRESHOLDS.citationJump.totalAnimationMsMax) {
        failures.push(
          `totalAnimationMs ${m.totalAnimationMs} > ${PASS_THRESHOLDS.citationJump.totalAnimationMsMax} (citation-jump)`,
        );
      }
      break;
    }
    case 'ai-diagnose-turnaround': {
      const m = metrics as TurnaroundMetrics;
      if (m.firstBlockVisibleMs > PASS_THRESHOLDS.aiDiagnose.firstBlockVisibleMsMax) {
        failures.push(
          `firstBlockVisibleMs ${m.firstBlockVisibleMs} > ${PASS_THRESHOLDS.aiDiagnose.firstBlockVisibleMsMax} (ai-diagnose)`,
        );
      }
      if (m.fullResponseRenderedMs > PASS_THRESHOLDS.aiDiagnose.fullResponseRenderedMsMax) {
        failures.push(
          `fullResponseRenderedMs ${m.fullResponseRenderedMs} > ${PASS_THRESHOLDS.aiDiagnose.fullResponseRenderedMsMax} (ai-diagnose)`,
        );
      }
      break;
    }
    case 'evidence-export-20-items': {
      const m = metrics as ExportMetrics;
      if (m.totalMs > PASS_THRESHOLDS.evidenceExport.totalMsMax) {
        failures.push(
          `totalMs ${m.totalMs} > ${PASS_THRESHOLDS.evidenceExport.totalMsMax} (evidence-export-20-items)`,
        );
      }
      break;
    }
    case 'memory-idle-10min': {
      const m = metrics as MemoryMetrics;
      if (m.growthMb > PASS_THRESHOLDS.memory.growthMbMax) {
        failures.push(
          `growthMb ${m.growthMb} > ${PASS_THRESHOLDS.memory.growthMbMax} (memory-idle-10min)`,
        );
      }
      break;
    }
  }

  return { passed: failures.length === 0, failures };
}

// ─── Submit samples: raw measurements → validated result ─────────────────

/**
 * Build a result from a config + raw scroll samples. The main API the
 * CLI (or a test) calls after capturing measurements. Handles metric
 * construction, threshold evaluation, and schema-version stamping.
 */
export function submitScrollSamples(
  config: HarnessConfig<'scroll-100k'>,
  samples: ScrollSamples,
  now: () => number = Date.now,
): HarnessResult<'scroll-100k'> {
  const startedAt = now() - Math.round(samples.scrollDurationMs);
  const metrics = buildScrollMetrics(samples);
  const { passed, failures } = evaluatePassThresholds(metrics, 'scroll-100k');
  return {
    resultSchemaVersion: HARNESS_RESULT_SCHEMA_VERSION,
    phase: config.phase,
    scenario: 'scroll-100k',
    startedAt,
    completedAt: now(),
    hardware: gatherHardwareInfo(),
    buildSha: config.buildSha,
    metrics,
    passed,
    failures,
  };
}

// ─── Fixture generation ──────────────────────────────────────────────────

/**
 * Simple seeded PRNG (mulberry32). Not cryptographic — just needs to be
 * deterministic and fast. Seed of 0 is invalid (would always return 0).
 */
function makeRng(seed: number): () => number {
  let state = (seed || 1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEVELS = ['INFO', 'DEBUG', 'WARN', 'ERROR'] as const;
const COMPONENTS = [
  'OperatorClient',
  'CallController',
  'CPEStation',
  'SessionManager',
  'AudioEngine',
  'SIPStack',
  'MDTHandler',
] as const;

/**
 * Generate a synthetic log file in a format the existing plain-text
 * parser accepts (one entry per line; `[LEVEL] [timestamp] [Component]:
 * message { json }`). Deterministic for a given seed.
 *
 * This is the 100k-row fixture for the scroll-100k scenario. It does
 * NOT attempt to be realistic OC-format (OC parser lands Phase 02);
 * it just produces a parseable file whose row count drives the scroll
 * benchmark.
 */
export function generateSyntheticLogFile(rowCount: number, seed: number): string {
  const rng = makeRng(seed);
  const baseMs = new Date('2026-04-20T14:00:00').getTime();
  const lines: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const level = LEVELS[Math.floor(rng() * LEVELS.length)];
    const comp = COMPONENTS[Math.floor(rng() * COMPONENTS.length)];
    const ts = new Date(baseMs + i * 25);
    const tsStr = formatOcTimestamp(ts);
    const traceId = `t${Math.floor(rng() * 1_000_000).toString(16).padStart(6, '0')}`;
    const callId = `c${Math.floor(rng() * 10_000).toString(16).padStart(4, '0')}`;
    const station = `s${Math.floor(rng() * 500)}`;
    const cnc = `cnc${Math.floor(rng() * 100)}`;
    const msg = synthesizeMessage(level, rng);
    const json = `{"traceId":"${traceId}","callId":"${callId}","cpeStation":{"id":"${station}"},"cpeUser":{"cncID":"${cnc}"}}`;
    lines.push(`[${level}] [${tsStr}] [${comp}]: ${msg} ${json}`);
  }
  return lines.join('\n') + '\n';
}

function formatOcTimestamp(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const sec = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${m}/${day}/${y}, ${h}:${min}:${sec} ${ampm},${ms}`;
}

function synthesizeMessage(level: string, rng: () => number): string {
  const templates = {
    INFO: ['heartbeat ok', 'session established', 'cache warmed', 'state transition'],
    DEBUG: ['trace enter', 'checkpoint reached', 'dispatched', 'buffer flushed'],
    WARN: ['slow response', 'retry triggered', 'backoff engaged', 'degraded mode'],
    ERROR: ['call failed', 'auth rejected', 'timeout waiting', 'stream closed unexpectedly'],
  } as const;
  const pool =
    templates[level as keyof typeof templates] ?? templates.INFO;
  return pool[Math.floor(rng() * pool.length)];
}

// ─── Result I/O ──────────────────────────────────────────────────────────

/**
 * Write a HarnessResult to `<outputDir>/<phase>-<scenario>-<YYYYMMDD-HHMMSS>.json`.
 * Default outputDir is `<repo>/docs/perf/`. Creates the directory if missing.
 * Returns the absolute path written.
 */
export function writeResult<S extends HarnessScenario>(
  result: HarnessResult<S>,
  outputDir?: string,
): string {
  const dir = resolve(outputDir ?? defaultOutputDir());
  mkdirSync(dir, { recursive: true });
  const ts = new Date(result.completedAt);
  const stamp = stampFromDate(ts);
  const path = join(dir, `${result.phase}-${result.scenario}-${stamp}.json`);
  writeFileSync(path, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return path;
}

/** Read a HarnessResult back from disk. Validates the schema version. */
export function readResult<S extends HarnessScenario>(path: string): HarnessResult<S> {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as HarnessResult<S>;
  if (parsed.resultSchemaVersion !== HARNESS_RESULT_SCHEMA_VERSION) {
    throw new Error(
      `perf-harness: unknown result schema version ${parsed.resultSchemaVersion} at ${path}`,
    );
  }
  return parsed;
}

function defaultOutputDir(): string {
  // Assume invocation from the repo root; fall back to process.cwd().
  return join(process.cwd(), 'docs', 'perf');
}

function stampFromDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// ─── Legacy automation entry (documented deferred) ───────────────────────

/**
 * Fully-automated scenario runner. Stubbed for all scenarios — the
 * measurement phase runs inside the Electron renderer (see
 * scripts/perf-harness-snippet.js) and submits raw samples back via
 * `submitScrollSamples` etc. Automated Electron orchestration lives
 * outside this harness for now; see docs/perf/README.md.
 */
export async function runHarness<S extends HarnessScenario>(
  config: HarnessConfig<S>,
): Promise<HarnessResult<S>> {
  void config;
  throw new Error(
    'perf-harness.runHarness: automated runner not implemented. ' +
      'Use scripts/perf-harness-snippet.js to capture samples in DevTools, ' +
      'then call submitScrollSamples(config, samples) to build the result. ' +
      'See docs/perf/README.md.',
  );
}

// Re-export — used by the forthcoming CLI (scripts/perf-cli.ts) and tests.
export { dirname as _dirname_fwd };
