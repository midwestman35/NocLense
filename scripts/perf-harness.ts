/**
 * perf-harness.ts — NocLense performance benchmark harness
 *
 * Phase 01a checkpoint 5 iteration. Keeps the single-file layout
 * (push-back on Codex's "split into three files" suggestion — the
 * layer boundaries are marked by section headers below, not file
 * boundaries, because the code is still small enough that one file
 * is more reviewable than three) but strengthens every layer:
 *
 *   §A Data contracts (schemas + versions)
 *   §B Runtime validators (reject malformed JSON from hand edits / DevTools)
 *   §C Pure computation (fixture generator, FPS percentiles, metrics builders)
 *   §D Evaluation (thresholds from spec §6.4)
 *   §E Persistence (schema-versioned result I/O, fixture manifest)
 *   §F Submission (samples → validated result)
 *   §G Probe resolution (shared with perf-harness-snippet.js via attribute constants)
 *   §H Automation (runHarness — deliberately stubbed; see docs/perf/README.md)
 *
 * See docs/perf/README.md for the manual measurement flow and
 * docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md §4.8
 * for the chosen measurement doctrine (rAF + programmatic scrollBy).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cpus, platform, release, totalmem } from 'node:os';
import { createHash } from 'node:crypto';

// ═══ §A Data contracts (versions + types) ════════════════════════════════

/** Result artifact schema version. Bump on breaking changes to HarnessResult shape. */
export const HARNESS_RESULT_SCHEMA_VERSION = 1 as const;
export type HarnessResultSchemaVersion = typeof HARNESS_RESULT_SCHEMA_VERSION;

/** Raw samples schema version. Independent from result version. */
export const SAMPLES_SCHEMA_VERSION = 1 as const;
export type SamplesSchemaVersion = typeof SAMPLES_SCHEMA_VERSION;

/** Fixture generator version. Stamped on fixture manifests. Bump on generator output changes. */
export const FIXTURE_GENERATOR_VERSION = 1 as const;
export type FixtureGeneratorVersion = typeof FIXTURE_GENERATOR_VERSION;

/** DOM probe contract. Shared with perf-harness-snippet.js via constants. */
export const LOG_VIEWER_SCROLL_PROBE = 'data-log-viewer-scroll' as const;
export const LOG_VIEWER_ROWS_PROBE = 'data-log-viewer-rows' as const;

export type HarnessScenario =
  | 'scroll-100k'
  | 'parse-50mb'
  | 'parse-200mb-indexeddb'
  | 'citation-jump-latency'
  | 'ai-diagnose-turnaround'
  | 'evidence-export-20-items'
  | 'memory-idle-10min';

export type MeasurementMode = 'manual-devtools' | 'automated-cdp';

export type ScrollMethod = 'programmatic-scrollby' | 'wheel-cdp';

export type BuildMode =
  | 'electron-production'
  | 'electron-dev'
  | 'vite-dev'
  | 'unknown';

export type HardwareSourceQuality = 'node-os' | 'electron-gpu' | 'manual-override';

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
  /** Mega*bytes* per second (not Mbit/s). Derived as fileSizeBytes / 1e6 / (endToEndParseMs / 1000). */
  throughputMBps: number;
  peakHeapMb: number;
  indexedDbUsed: boolean;
}

export interface LatencyMetrics {
  kind: 'latency';
  perceivedMs: number;
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

/** Expected metric-kind discriminator per scenario. Used by validators. */
const EXPECTED_METRIC_KIND: Record<HarnessScenario, string> = {
  'scroll-100k': 'scroll',
  'parse-50mb': 'parse',
  'parse-200mb-indexeddb': 'parse',
  'citation-jump-latency': 'latency',
  'ai-diagnose-turnaround': 'turnaround',
  'evidence-export-20-items': 'export',
  'memory-idle-10min': 'memory',
};

export interface HardwareInfo {
  os: string;
  osVersion: string;
  cpuModel: string;
  cpuLogicalCores: number;
  totalMemoryGb: number;
  gpuDescription: string;
  sourceQuality: HardwareSourceQuality;
}

export interface ProvenanceInfo {
  measurementMode: MeasurementMode;
  /** e.g. "perf-harness-snippet.js@ckpt5". Identifies the capture path. */
  captureSource: string;
  /** DOM attribute the snippet hit; echoes LOG_VIEWER_SCROLL_PROBE. */
  probeId?: string;
  /** Row count the app actually loaded, read from LOG_VIEWER_ROWS_PROBE. */
  actualRowsLoaded: number;
  sampleCount: number;
  scrollMethod: ScrollMethod;
  appVersion?: string;
  buildMode: BuildMode;
  /** Fixture identifier (hash or name) the scenario ran against. */
  fixtureId?: string;
  fixtureGeneratorVersion?: FixtureGeneratorVersion;
}

export type HarnessPhase = '01a' | '01b' | '01c' | '02' | '03' | '04' | '05';

export interface HarnessConfig<S extends HarnessScenario = HarnessScenario> {
  phase: HarnessPhase;
  scenario: S;
  electronBuildPath?: string;
  fixturePaths: string[];
  outputDir?: string;
  buildSha?: string;
  fixtureId?: string;
  appVersion?: string;
  buildMode?: BuildMode;
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
  provenance: ProvenanceInfo;
  passed: boolean;
  failures: string[];
}

/** Raw capture payload shape emitted by the DevTools snippet. */
export interface ScrollSamples {
  samplesSchemaVersion: SamplesSchemaVersion;
  rowsLoaded: number;
  scrollDurationMs: number;
  /** Monotonic `performance.now()` timestamps from the renderer. */
  frameTimestamps: number[];
  meta: {
    captureSource: string;
    probeId?: string;
    captureUnixMs: number;
    scrollMethod: ScrollMethod;
    startScrollTop?: number;
    endScrollTop?: number;
  };
}

/** Sidecar manifest emitted alongside a generated fixture file. */
export interface FixtureManifest {
  fixtureGeneratorVersion: FixtureGeneratorVersion;
  generatorProfile: 'synthetic-simple';
  seed: number;
  expectedRowCount: number;
  intendedScenario: HarnessScenario;
  /** SHA-256 of the fixture text. */
  contentSha256: string;
  generatedAt: number;
}

// ═══ §B Runtime validators ═══════════════════════════════════════════════
//
// TypeScript does not protect JSON from hand edits or stale DevTools
// pastes. These validators throw with file:line-precise error messages
// so the manual measurement pipeline fails fast and loud.

class ValidationError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(`${message} at ${path}`);
    this.name = 'ValidationError';
    this.path = path;
  }
}

function must(cond: unknown, message: string, path: string): asserts cond {
  if (!cond) throw new ValidationError(message, path);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateFiniteNumber(v: unknown, path: string): number {
  must(typeof v === 'number' && Number.isFinite(v), 'not a finite number', path);
  return v;
}

function validateNonNegInt(v: unknown, path: string): number {
  const n = validateFiniteNumber(v, path);
  must(Number.isInteger(n) && n >= 0, 'not a non-negative integer', path);
  return n;
}

function validateString(v: unknown, path: string): string {
  must(typeof v === 'string', 'not a string', path);
  return v;
}

function validateOneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  must(typeof v === 'string' && (allowed as readonly string[]).includes(v), `not one of ${allowed.join(' | ')}`, path);
  return v as T;
}

/** Parse and validate ScrollSamples from `unknown`. Throws on failure. */
export function validateScrollSamples(raw: unknown): ScrollSamples {
  must(isRecord(raw), 'not an object', '$');
  must(
    raw.samplesSchemaVersion === SAMPLES_SCHEMA_VERSION,
    `expected samplesSchemaVersion=${SAMPLES_SCHEMA_VERSION}, got ${String(raw.samplesSchemaVersion)}`,
    '$.samplesSchemaVersion',
  );
  const rowsLoaded = validateNonNegInt(raw.rowsLoaded, '$.rowsLoaded');
  const scrollDurationMs = validateFiniteNumber(raw.scrollDurationMs, '$.scrollDurationMs');
  must(scrollDurationMs > 0, 'scrollDurationMs must be positive', '$.scrollDurationMs');

  must(Array.isArray(raw.frameTimestamps), 'not an array', '$.frameTimestamps');
  const frameTimestamps: number[] = [];
  for (let i = 0; i < raw.frameTimestamps.length; i++) {
    frameTimestamps.push(validateFiniteNumber(raw.frameTimestamps[i], `$.frameTimestamps[${i}]`));
  }
  must(frameTimestamps.length >= 2, 'need at least 2 frame timestamps', '$.frameTimestamps');

  must(isRecord(raw.meta), 'not an object', '$.meta');
  const m = raw.meta;
  const meta: ScrollSamples['meta'] = {
    captureSource: validateString(m.captureSource, '$.meta.captureSource'),
    captureUnixMs: validateNonNegInt(m.captureUnixMs, '$.meta.captureUnixMs'),
    scrollMethod: validateOneOf<ScrollMethod>(m.scrollMethod, ['programmatic-scrollby', 'wheel-cdp'], '$.meta.scrollMethod'),
  };
  if (m.probeId !== undefined) meta.probeId = validateString(m.probeId, '$.meta.probeId');
  if (m.startScrollTop !== undefined) meta.startScrollTop = validateFiniteNumber(m.startScrollTop, '$.meta.startScrollTop');
  if (m.endScrollTop !== undefined) meta.endScrollTop = validateFiniteNumber(m.endScrollTop, '$.meta.endScrollTop');

  return { samplesSchemaVersion: SAMPLES_SCHEMA_VERSION, rowsLoaded, scrollDurationMs, frameTimestamps, meta };
}

const ALL_SCENARIOS: readonly HarnessScenario[] = [
  'scroll-100k',
  'parse-50mb',
  'parse-200mb-indexeddb',
  'citation-jump-latency',
  'ai-diagnose-turnaround',
  'evidence-export-20-items',
  'memory-idle-10min',
];

const ALL_PHASES: readonly HarnessPhase[] = ['01a', '01b', '01c', '02', '03', '04', '05'];

function validateHardwareInfo(v: unknown, path: string): HardwareInfo {
  must(isRecord(v), 'not an object', path);
  return {
    os: validateString(v.os, `${path}.os`),
    osVersion: validateString(v.osVersion, `${path}.osVersion`),
    cpuModel: validateString(v.cpuModel, `${path}.cpuModel`),
    cpuLogicalCores: validateNonNegInt(v.cpuLogicalCores, `${path}.cpuLogicalCores`),
    totalMemoryGb: validateNonNegInt(v.totalMemoryGb, `${path}.totalMemoryGb`),
    gpuDescription: validateString(v.gpuDescription, `${path}.gpuDescription`),
    sourceQuality: validateOneOf<HardwareSourceQuality>(
      v.sourceQuality,
      ['node-os', 'electron-gpu', 'manual-override'],
      `${path}.sourceQuality`,
    ),
  };
}

function validateProvenance(v: unknown, path: string): ProvenanceInfo {
  must(isRecord(v), 'not an object', path);
  const prov: ProvenanceInfo = {
    measurementMode: validateOneOf<MeasurementMode>(v.measurementMode, ['manual-devtools', 'automated-cdp'], `${path}.measurementMode`),
    captureSource: validateString(v.captureSource, `${path}.captureSource`),
    actualRowsLoaded: validateNonNegInt(v.actualRowsLoaded, `${path}.actualRowsLoaded`),
    sampleCount: validateNonNegInt(v.sampleCount, `${path}.sampleCount`),
    scrollMethod: validateOneOf<ScrollMethod>(v.scrollMethod, ['programmatic-scrollby', 'wheel-cdp'], `${path}.scrollMethod`),
    buildMode: validateOneOf<BuildMode>(v.buildMode, ['electron-production', 'electron-dev', 'vite-dev', 'unknown'], `${path}.buildMode`),
  };
  if (v.probeId !== undefined) prov.probeId = validateString(v.probeId, `${path}.probeId`);
  if (v.appVersion !== undefined) prov.appVersion = validateString(v.appVersion, `${path}.appVersion`);
  if (v.fixtureId !== undefined) prov.fixtureId = validateString(v.fixtureId, `${path}.fixtureId`);
  if (v.fixtureGeneratorVersion !== undefined) {
    must(
      v.fixtureGeneratorVersion === FIXTURE_GENERATOR_VERSION,
      `unexpected fixtureGeneratorVersion ${String(v.fixtureGeneratorVersion)}`,
      `${path}.fixtureGeneratorVersion`,
    );
    prov.fixtureGeneratorVersion = FIXTURE_GENERATOR_VERSION;
  }
  return prov;
}

function validateScrollMetrics(v: unknown, path: string): ScrollMetrics {
  must(isRecord(v), 'not an object', path);
  must(v.kind === 'scroll', 'metrics.kind must be "scroll"', `${path}.kind`);
  return {
    kind: 'scroll',
    rowsLoaded: validateNonNegInt(v.rowsLoaded, `${path}.rowsLoaded`),
    scrollDurationMs: validateFiniteNumber(v.scrollDurationMs, `${path}.scrollDurationMs`),
    fpsAverage: validateFiniteNumber(v.fpsAverage, `${path}.fpsAverage`),
    fpsP5: validateFiniteNumber(v.fpsP5, `${path}.fpsP5`),
    fpsP50: validateFiniteNumber(v.fpsP50, `${path}.fpsP50`),
    fpsP95: validateFiniteNumber(v.fpsP95, `${path}.fpsP95`),
    droppedFrames: validateNonNegInt(v.droppedFrames, `${path}.droppedFrames`),
    longFrames: validateNonNegInt(v.longFrames, `${path}.longFrames`),
  };
}

/**
 * Parse and validate a HarnessResult from `unknown`. Throws with a
 * path-prefixed message on any structural or value mismatch. Scenario
 * ↔ metric.kind alignment IS enforced here.
 */
export function validateHarnessResult(raw: unknown): HarnessResult {
  must(isRecord(raw), 'not an object', '$');
  must(
    raw.resultSchemaVersion === HARNESS_RESULT_SCHEMA_VERSION,
    `unknown result schema version ${String(raw.resultSchemaVersion)}`,
    '$.resultSchemaVersion',
  );
  const scenario = validateOneOf<HarnessScenario>(raw.scenario, ALL_SCENARIOS, '$.scenario');
  const phase = validateOneOf<HarnessPhase>(raw.phase, ALL_PHASES, '$.phase');
  const startedAt = validateNonNegInt(raw.startedAt, '$.startedAt');
  const completedAt = validateNonNegInt(raw.completedAt, '$.completedAt');
  must(Array.isArray(raw.failures), 'not an array', '$.failures');
  const failures: string[] = [];
  for (let i = 0; i < raw.failures.length; i++) {
    failures.push(validateString(raw.failures[i], `$.failures[${i}]`));
  }
  must(typeof raw.passed === 'boolean', 'not a boolean', '$.passed');
  const hardware = validateHardwareInfo(raw.hardware, '$.hardware');
  const provenance = validateProvenance(raw.provenance, '$.provenance');

  // Scenario ↔ metric.kind must align.
  must(isRecord(raw.metrics), 'not an object', '$.metrics');
  const expectedKind = EXPECTED_METRIC_KIND[scenario];
  must(
    raw.metrics.kind === expectedKind,
    `scenario ${scenario} requires metrics.kind="${expectedKind}", got "${String(raw.metrics.kind)}"`,
    '$.metrics.kind',
  );

  // Today only scroll metrics have a full validator. Other scenarios
  // receive a structural placeholder (kind already matched above);
  // Phase 02+ fleshes them out as those scenarios light up.
  const metrics =
    scenario === 'scroll-100k'
      ? (validateScrollMetrics(raw.metrics, '$.metrics') as unknown as MetricsFor<HarnessScenario>)
      : (raw.metrics as unknown as MetricsFor<HarnessScenario>);

  return {
    resultSchemaVersion: HARNESS_RESULT_SCHEMA_VERSION,
    phase,
    scenario,
    startedAt,
    completedAt,
    hardware,
    buildSha: typeof raw.buildSha === 'string' ? raw.buildSha : undefined,
    metrics,
    provenance,
    passed: raw.passed,
    failures,
  };
}

// ═══ §C Pure computation ═════════════════════════════════════════════════

export interface FpsPercentiles {
  avg: number;
  p5: number;
  p50: number;
  p95: number;
}

/**
 * Nearest-rank percentile on sorted-ascending FPS values. For q=0.05
 * on a 100-sample array, returns the FPS at rank 5 — "the highest
 * FPS that 5% of the samples fall at or below". Matches spec §6.4's
 * p5 FPS as a lower-bound gate.
 */
export function computeFpsPercentiles(intervalsMs: readonly number[]): FpsPercentiles {
  const usable = intervalsMs.filter((i) => i > 0 && Number.isFinite(i));
  if (usable.length === 0) return { avg: 0, p5: 0, p50: 0, p95: 0 };
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

function percentile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil(sortedAsc.length * q);
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, rank - 1));
  return sortedAsc[idx];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildScrollMetrics(samples: ScrollSamples): ScrollMetrics {
  const intervals: number[] = [];
  for (let i = 1; i < samples.frameTimestamps.length; i++) {
    intervals.push(samples.frameTimestamps[i] - samples.frameTimestamps[i - 1]);
  }
  const p = computeFpsPercentiles(intervals);
  return {
    kind: 'scroll',
    rowsLoaded: samples.rowsLoaded,
    scrollDurationMs: samples.scrollDurationMs,
    fpsAverage: p.avg,
    fpsP5: p.p5,
    fpsP50: p.p50,
    fpsP95: p.p95,
    droppedFrames: intervals.filter((i) => i > 20).length,
    longFrames: intervals.filter((i) => i > 50).length,
  };
}

// ─── Fixture generator (mulberry32 PRNG) ─────────────────────────────────

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
 * Generate a synthetic OC-flavored log fixture + sidecar manifest.
 *
 * Design choice: the output is a synthetic workload, not a resample
 * of the real DailyNOC backup (which contains PII we can't ship).
 * The fixture exercises LogViewer virtualization correctly because
 * it hinges on row count, not content realism. `generatorProfile` is
 * reserved in the manifest so a future corpus-derived generator can
 * be introduced as `'corpus-v1'` without breaking consumers.
 */
export function generateSyntheticLogFixture(config: {
  rowCount: number;
  seed: number;
  intendedScenario: HarnessScenario;
  generatedAt?: number;
}): { text: string; manifest: FixtureManifest } {
  const text = renderSyntheticLogText(config.rowCount, config.seed);
  const manifest: FixtureManifest = {
    fixtureGeneratorVersion: FIXTURE_GENERATOR_VERSION,
    generatorProfile: 'synthetic-simple',
    seed: config.seed,
    expectedRowCount: config.rowCount,
    intendedScenario: config.intendedScenario,
    contentSha256: createHash('sha256').update(text).digest('hex'),
    generatedAt: config.generatedAt ?? Date.now(),
  };
  return { text, manifest };
}

/** Back-compat for early callers; prefer `generateSyntheticLogFixture` now. */
export function generateSyntheticLogFile(rowCount: number, seed: number): string {
  return renderSyntheticLogText(rowCount, seed);
}

function renderSyntheticLogText(rowCount: number, seed: number): string {
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
  const pool = templates[level as keyof typeof templates] ?? templates.INFO;
  return pool[Math.floor(rng() * pool.length)];
}

// ═══ §D Evaluation (thresholds) ══════════════════════════════════════════

export const PASS_THRESHOLDS = {
  scroll: {
    fpsAverageMin: 55,
    fpsP5Min: 45,
  },
  parse50: {
    dropToFirstRowVisibleMsMax: 8_000,
    throughputMBpsMin: 40,
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

export function evaluatePassThresholds<S extends HarnessScenario>(
  metrics: MetricsFor<S>,
  scenario: S,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  switch (scenario) {
    case 'scroll-100k': {
      const m = metrics as ScrollMetrics;
      if (m.fpsAverage < PASS_THRESHOLDS.scroll.fpsAverageMin) {
        failures.push(`fpsAverage ${m.fpsAverage} < ${PASS_THRESHOLDS.scroll.fpsAverageMin} (scroll-100k)`);
      }
      if (m.fpsP5 < PASS_THRESHOLDS.scroll.fpsP5Min) {
        failures.push(`fpsP5 ${m.fpsP5} < ${PASS_THRESHOLDS.scroll.fpsP5Min} (scroll-100k)`);
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
      if (m.throughputMBps < PASS_THRESHOLDS.parse50.throughputMBpsMin) {
        failures.push(
          `throughputMBps ${m.throughputMBps} < ${PASS_THRESHOLDS.parse50.throughputMBpsMin} (parse-50mb)`,
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
        failures.push(`perceivedMs ${m.perceivedMs} > ${PASS_THRESHOLDS.citationJump.perceivedMsMax} (citation-jump)`);
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
        failures.push(`totalMs ${m.totalMs} > ${PASS_THRESHOLDS.evidenceExport.totalMsMax} (evidence-export-20-items)`);
      }
      break;
    }
    case 'memory-idle-10min': {
      const m = metrics as MemoryMetrics;
      if (m.growthMb > PASS_THRESHOLDS.memory.growthMbMax) {
        failures.push(`growthMb ${m.growthMb} > ${PASS_THRESHOLDS.memory.growthMbMax} (memory-idle-10min)`);
      }
      break;
    }
  }

  return { passed: failures.length === 0, failures };
}

// ═══ §E Persistence ══════════════════════════════════════════════════════

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

/** Read and fully validate a HarnessResult from disk. Throws on structural drift. */
export function readResult<S extends HarnessScenario = HarnessScenario>(path: string): HarnessResult<S> {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return validateHarnessResult(raw) as HarnessResult<S>;
}

export function writeFixture(
  fixturePath: string,
  result: { text: string; manifest: FixtureManifest },
): { fixturePath: string; manifestPath: string } {
  const absPath = resolve(fixturePath);
  mkdirSync(resolve(absPath, '..'), { recursive: true });
  writeFileSync(absPath, result.text, 'utf8');
  const manifestPath = absPath + '.manifest.json';
  writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2) + '\n', 'utf8');
  return { fixturePath: absPath, manifestPath };
}

function defaultOutputDir(): string {
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

// ═══ §F Submission (samples → validated result) ══════════════════════════

export interface SubmitScrollContext {
  config: HarnessConfig<'scroll-100k'>;
  samples: ScrollSamples;
  buildMode?: BuildMode;
  appVersion?: string;
  now?: () => number;
  hardwareOverrides?: Partial<HardwareInfo>;
}

/**
 * Build a fully-validated HarnessResult from raw samples + context.
 * Validates the samples first; runtime-rejects malformed input before
 * any computation.
 */
export function submitScrollSamples(ctx: SubmitScrollContext): HarnessResult<'scroll-100k'> {
  const samples = validateScrollSamples(ctx.samples);
  const now = ctx.now ?? Date.now;
  const startedAt = now() - Math.round(samples.scrollDurationMs);
  const metrics = buildScrollMetrics(samples);
  const { passed, failures } = evaluatePassThresholds(metrics, 'scroll-100k');
  const hardware = gatherHardwareInfo(ctx.hardwareOverrides);
  const provenance: ProvenanceInfo = {
    measurementMode: 'manual-devtools',
    captureSource: samples.meta.captureSource,
    probeId: samples.meta.probeId,
    actualRowsLoaded: samples.rowsLoaded,
    sampleCount: samples.frameTimestamps.length,
    scrollMethod: samples.meta.scrollMethod,
    appVersion: ctx.appVersion,
    buildMode: ctx.buildMode ?? ctx.config.buildMode ?? 'unknown',
    fixtureId: ctx.config.fixtureId,
    fixtureGeneratorVersion: ctx.config.fixtureId ? FIXTURE_GENERATOR_VERSION : undefined,
  };

  return {
    resultSchemaVersion: HARNESS_RESULT_SCHEMA_VERSION,
    phase: ctx.config.phase,
    scenario: 'scroll-100k',
    startedAt,
    completedAt: now(),
    hardware,
    buildSha: ctx.config.buildSha,
    metrics,
    provenance,
    passed,
    failures,
  };
}

export function gatherHardwareInfo(overrides: Partial<HardwareInfo> = {}): HardwareInfo {
  const cpuList = cpus();
  const base: HardwareInfo = {
    os: platform(),
    osVersion: release(),
    cpuModel: cpuList[0]?.model?.trim() ?? 'unknown',
    cpuLogicalCores: cpuList.length,
    totalMemoryGb: Math.round(totalmem() / 1024 ** 3),
    gpuDescription: 'unknown',
    sourceQuality: 'node-os',
  };
  const merged = { ...base, ...overrides };
  // If caller supplied a GPU string, quality upgrades.
  if (overrides.gpuDescription && overrides.gpuDescription !== 'unknown' && !overrides.sourceQuality) {
    merged.sourceQuality = 'manual-override';
  }
  return merged;
}

// ═══ §G Probe resolution (DOM-side contract) ═════════════════════════════

export interface ProbeResolution {
  element: Element;
  rowsLoaded: number;
  probeId: string;
}

/**
 * Resolve the LogViewer scroll probe inside a Document. Exported so
 * the integration seam test can exercise the exact contract the
 * DevTools snippet duplicates inline. Any drift between this function
 * and the snippet is caught by perf-harness.seam.test.ts.
 */
export function resolveLogViewerProbe(doc: Document): ProbeResolution {
  const el = doc.querySelector(`[${LOG_VIEWER_SCROLL_PROBE}]`);
  if (!el) {
    throw new Error(
      `perf-harness: probe [${LOG_VIEWER_SCROLL_PROBE}] not found in document. ` +
        `Ensure the LogViewer is mounted and the probe attribute is present.`,
    );
  }
  const rowsRaw = el.getAttribute(LOG_VIEWER_ROWS_PROBE);
  if (rowsRaw === null) {
    throw new Error(
      `perf-harness: probe [${LOG_VIEWER_ROWS_PROBE}] missing on scroll element; ` +
        'expected row count attribute.',
    );
  }
  const rowsLoaded = Number.parseInt(rowsRaw, 10);
  if (!Number.isFinite(rowsLoaded) || rowsLoaded < 0) {
    throw new Error(`perf-harness: invalid row count "${rowsRaw}" on probe`);
  }
  return { element: el, rowsLoaded, probeId: LOG_VIEWER_SCROLL_PROBE };
}

// ═══ §H Automation (deliberately stubbed) ════════════════════════════════

export async function runHarness<S extends HarnessScenario>(
  config: HarnessConfig<S>,
): Promise<HarnessResult<S>> {
  void config;
  throw new Error(
    'perf-harness.runHarness: automated runner not implemented. ' +
      'Use the CLI: `node --experimental-strip-types scripts/perf-cli.ts submit …`. ' +
      'See docs/perf/README.md.',
  );
}
