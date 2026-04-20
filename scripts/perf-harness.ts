/**
 * perf-harness.ts — NocLense performance benchmark harness
 *
 * Phase 00: skeleton with function contracts only.
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
 * Design spec §4.8 defines the pass thresholds:
 *   - Log Stream scroll FPS: >= 55 avg, >= 45 p5
 *   - Memory heap growth < 50 MB over 10 min idle
 *   - Hardware class: Win 11, i7-12th gen, 32GB, integrated GPU
 */

export interface HarnessConfig {
  /** Spec phase being validated. Used in the output path. */
  phase: '01a' | '01b' | '01c' | '02' | '03' | '04' | '05';
  /** Which scenario to run. */
  scenario: HarnessScenario;
  /** Absolute path to the production build under test. */
  electronBuildPath: string;
  /** Absolute path to the dataset fixture. */
  fixturePath: string;
  /** Optional override for the output directory. */
  outputDir?: string;
}

export type HarnessScenario =
  | 'scroll-100k'
  | 'parse-50mb'
  | 'parse-200mb-indexeddb'
  | 'citation-jump-latency'
  | 'ai-diagnose-turnaround'
  | 'evidence-export-20-items'
  | 'memory-idle-10min';

export interface HarnessResult {
  phase: HarnessConfig['phase'];
  scenario: HarnessScenario;
  startedAt: number;
  completedAt: number;
  hardware: {
    os: string;
    cpuModel: string;
    totalMemoryGb: number;
  };
  buildSha?: string;
  metrics: ScenarioMetrics;
  passed: boolean;
  failures: string[];
}

export type ScenarioMetrics =
  | ScrollMetrics
  | ParseMetrics
  | LatencyMetrics
  | TurnaroundMetrics
  | MemoryMetrics;

export interface ScrollMetrics {
  kind: 'scroll';
  rowsLoaded: number;
  scrollDurationMs: number;
  fpsAverage: number;
  fpsP5: number;
  fpsP95: number;
  droppedFrames: number;
}

export interface ParseMetrics {
  kind: 'parse';
  fileSizeBytes: number;
  dropToFirstRowVisibleMs: number;
  endToEndParseMs: number;
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

export interface MemoryMetrics {
  kind: 'memory';
  startHeapMb: number;
  endHeapMb: number;
  peakHeapMb: number;
  growthMb: number;
  gcEvents: number;
}

const NOT_IMPLEMENTED = (fn: string): never => {
  throw new Error(
    `perf-harness.ts: ${fn} not implemented (Phase 00 skeleton). Fill in during Phase 01a.`,
  );
};

/**
 * Entry point. Phase 01a fills this in.
 * @throws when the Electron build cannot be launched or the fixture cannot be loaded.
 */
export async function runHarness(config: HarnessConfig): Promise<HarnessResult> {
  void config;
  return NOT_IMPLEMENTED('runHarness');
}

/**
 * Pass-threshold evaluator per §6.4. Called by runHarness after metrics capture.
 * Phase 01a implements; Phase 00 exports the contract.
 */
export function evaluatePassThresholds(
  metrics: ScenarioMetrics,
  scenario: HarnessScenario,
): { passed: boolean; failures: string[] } {
  void metrics;
  void scenario;
  return NOT_IMPLEMENTED('evaluatePassThresholds');
}

/**
 * Writes the HarnessResult to `docs/perf/<phase>-<YYYYMMDD>.json`.
 * Phase 01a implements.
 */
export function writeResult(result: HarnessResult, outputDir?: string): string {
  void result;
  void outputDir;
  return NOT_IMPLEMENTED('writeResult');
}
