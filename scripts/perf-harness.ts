/**
 * perf-harness.ts — NocLense performance benchmark harness
 *
 * Phase 00: skeleton with function + type contracts. No runtime work.
 * Phase 01a: fills in implementation, produces the first baseline.
 *
 * Usage (Phase 01a+):
 *   npx tsx scripts/perf-harness.ts --phase 01a --scenario scroll-100k
 *
 * Results land in `docs/perf/<phase>-<YYYYMMDD>.json`.
 *
 * CI does NOT run this (too flaky in headless). Developer runs locally
 * against the Electron production build before closing a phase.
 *
 * Design spec §4.7 / §6.4 defines the pass thresholds:
 *   - Log Stream scroll FPS: >= 55 avg, >= 45 p5, measured fps p5/p95
 *   - Parse throughput: >= 40 MB/sec (50MB fixture)
 *   - Memory heap growth: < 50 MB over 10 min idle
 *   - Hardware class: Win 11, i7-12th gen, 32GB, integrated GPU
 */

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

/**
 * Scenario → metric shape map. Enforces that invalid
 * (scenario, metric) pairs are compile-time errors.
 */
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
  /** GPU identifier string. Electron can get this via `app.getGPUInfo()`. */
  gpuDescription: string;
}

export interface HarnessConfig<S extends HarnessScenario = HarnessScenario> {
  /** Spec phase being validated. Used in the output path. */
  phase: '01a' | '01b' | '01c' | '02' | '03' | '04' | '05';
  scenario: S;
  /** Absolute path to the production build under test. */
  electronBuildPath: string;
  /**
   * Scenarios may need multiple fixtures (e.g. parse scenarios use both
   * a .log file and a correlation-ground-truth JSON).
   */
  fixturePaths: string[];
  /** Optional override for the output directory. */
  outputDir?: string;
}

export interface HarnessResult<S extends HarnessScenario = HarnessScenario> {
  resultSchemaVersion: HarnessResultSchemaVersion;
  phase: HarnessConfig['phase'];
  scenario: S;
  startedAt: number;
  completedAt: number;
  hardware: HardwareInfo;
  buildSha?: string;
  /** Metric shape is narrowed to the scenario's expected shape. */
  metrics: MetricsFor<S>;
  passed: boolean;
  failures: string[];
}

// ─── Contract stubs (Phase 01a implements) ───────────────────────────────

const NOT_IMPLEMENTED = (fn: string): never => {
  throw new Error(
    `perf-harness.ts: ${fn} not implemented (Phase 00 skeleton). Fill in during Phase 01a.`,
  );
};

/**
 * Entry point. Phase 01a fills this in.
 * @throws when the Electron build cannot be launched or the fixture cannot be loaded.
 */
export async function runHarness<S extends HarnessScenario>(
  config: HarnessConfig<S>,
): Promise<HarnessResult<S>> {
  void config;
  return NOT_IMPLEMENTED('runHarness');
}

/**
 * Pass-threshold evaluator per §6.4. Called by runHarness after metrics
 * capture. The threshold set depends on the scenario.
 */
export function evaluatePassThresholds<S extends HarnessScenario>(
  metrics: MetricsFor<S>,
  scenario: S,
): { passed: boolean; failures: string[] } {
  void metrics;
  void scenario;
  return NOT_IMPLEMENTED('evaluatePassThresholds');
}

/**
 * Writes the HarnessResult to `docs/perf/<phase>-<YYYYMMDD>.json`.
 * Phase 01a implements.
 */
export function writeResult<S extends HarnessScenario>(
  result: HarnessResult<S>,
  outputDir?: string,
): string {
  void result;
  void outputDir;
  return NOT_IMPLEMENTED('writeResult');
}
