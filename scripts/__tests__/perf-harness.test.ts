/**
 * perf-harness.test.ts — covers every pure function in the harness.
 * Scenario-kind validation and schema-version drift are tested here
 * along with the computation primitives.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FIXTURE_GENERATOR_VERSION,
  HARNESS_RESULT_SCHEMA_VERSION,
  PASS_THRESHOLDS,
  SAMPLES_SCHEMA_VERSION,
  buildScrollMetrics,
  computeFpsPercentiles,
  evaluatePassThresholds,
  gatherHardwareInfo,
  generateSyntheticLogFile,
  generateSyntheticLogFixture,
  readResult,
  submitScrollSamples,
  validateHarnessResult,
  validateScrollSamples,
  writeResult,
  type HarnessConfig,
  type HarnessResult,
  type ParseMetrics,
  type ScrollMetrics,
  type ScrollSamples,
} from '../perf-harness';

// ─── computeFpsPercentiles ─────────────────────────────────────────────

describe('computeFpsPercentiles', () => {
  it('returns zeroes for an empty input', () => {
    expect(computeFpsPercentiles([])).toEqual({ avg: 0, p5: 0, p50: 0, p95: 0 });
  });

  it('computes 60fps for a clean 16.67ms stream', () => {
    const stream = Array.from({ length: 100 }, () => 16.67);
    const p = computeFpsPercentiles(stream);
    expect(p.avg).toBeGreaterThanOrEqual(59.9);
    expect(p.avg).toBeLessThanOrEqual(60.1);
    expect(p.p50).toBeGreaterThanOrEqual(59.9);
  });

  it('p5 reflects worst-5% stalls even when average stays high', () => {
    const stream = [
      ...Array.from({ length: 95 }, () => 16.67),
      ...Array.from({ length: 5 }, () => 100),
    ];
    const p = computeFpsPercentiles(stream);
    expect(p.avg).toBeGreaterThan(55);
    expect(p.p5).toBeLessThan(15);
  });

  it('filters non-finite and zero intervals', () => {
    const stream = [16.67, 0, NaN, Infinity, 16.67, -5];
    expect(computeFpsPercentiles(stream).avg).toBeGreaterThan(59);
  });
});

// ─── buildScrollMetrics ────────────────────────────────────────────────

describe('buildScrollMetrics', () => {
  it('derives clean 60fps metrics from even rAF timestamps', () => {
    const frameTimestamps: number[] = [];
    for (let i = 0; i < 601; i++) frameTimestamps.push(i * 16.67);
    const m = buildScrollMetrics({
      samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
      meta: { captureSource: 'test', scrollMethod: 'programmatic-scrollby', captureUnixMs: Date.now() },
    });
    expect(m.kind).toBe('scroll');
    expect(m.rowsLoaded).toBe(100_000);
    expect(m.fpsAverage).toBeGreaterThan(59);
    expect(m.fpsP5).toBeGreaterThan(59);
    expect(m.droppedFrames).toBe(0);
    expect(m.longFrames).toBe(0);
  });

  it('counts dropped and long frames correctly', () => {
    const frameTimestamps: number[] = [0];
    for (let i = 1; i <= 50; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 16.67);
    for (let i = 0; i < 10; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 25);
    for (let i = 0; i < 2; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 60);
    const m = buildScrollMetrics({
      samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
      meta: { captureSource: 'test', scrollMethod: 'programmatic-scrollby', captureUnixMs: Date.now() },
    });
    expect(m.droppedFrames).toBe(12);
    expect(m.longFrames).toBe(2);
  });
});

// ─── evaluatePassThresholds ────────────────────────────────────────────

describe('evaluatePassThresholds', () => {
  it('scroll-100k passes at spec thresholds', () => {
    const m: ScrollMetrics = {
      kind: 'scroll',
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      fpsAverage: 55,
      fpsP5: 45,
      fpsP50: 59,
      fpsP95: 60,
      droppedFrames: 10,
      longFrames: 0,
    };
    expect(evaluatePassThresholds(m, 'scroll-100k')).toEqual({ passed: true, failures: [] });
  });

  it('scroll-100k fails when avg drops below 55', () => {
    const m: ScrollMetrics = {
      kind: 'scroll',
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      fpsAverage: 42,
      fpsP5: 30,
      fpsP50: 50,
      fpsP95: 60,
      droppedFrames: 100,
      longFrames: 10,
    };
    const { passed, failures } = evaluatePassThresholds(m, 'scroll-100k');
    expect(passed).toBe(false);
    expect(failures.some((f) => f.includes('fpsAverage'))).toBe(true);
    expect(failures.some((f) => f.includes('fpsP5'))).toBe(true);
  });

  it('parse-50mb uses throughputMBps (not throughputMbps)', () => {
    const m: ParseMetrics = {
      kind: 'parse',
      fileSizeBytes: 50_000_000,
      dropToFirstRowVisibleMs: 4_000,
      endToEndParseMs: 7_000,
      throughputMBps: 20,
      peakHeapMb: 200,
      indexedDbUsed: false,
    };
    const { passed, failures } = evaluatePassThresholds(m, 'parse-50mb');
    expect(passed).toBe(false);
    expect(failures.some((f) => f.includes('throughputMBps'))).toBe(true);
  });

  it('threshold constants match spec §6.4', () => {
    expect(PASS_THRESHOLDS.scroll.fpsAverageMin).toBe(55);
    expect(PASS_THRESHOLDS.scroll.fpsP5Min).toBe(45);
    expect(PASS_THRESHOLDS.parse50.dropToFirstRowVisibleMsMax).toBe(8_000);
    expect(PASS_THRESHOLDS.parse50.throughputMBpsMin).toBe(40);
    expect(PASS_THRESHOLDS.memory.growthMbMax).toBe(50);
  });
});

// ─── Fixture generator + manifest ──────────────────────────────────────

describe('generateSyntheticLogFixture', () => {
  it('produces exactly rowCount lines and a manifest', () => {
    const { text, manifest } = generateSyntheticLogFixture({
      rowCount: 1000,
      seed: 42,
      intendedScenario: 'scroll-100k',
      generatedAt: 1_700_000_000_000,
    });
    expect(text.split('\n').filter(Boolean)).toHaveLength(1000);
    expect(manifest.fixtureGeneratorVersion).toBe(FIXTURE_GENERATOR_VERSION);
    expect(manifest.generatorProfile).toBe('synthetic-simple');
    expect(manifest.expectedRowCount).toBe(1000);
    expect(manifest.intendedScenario).toBe('scroll-100k');
    expect(manifest.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.seed).toBe(42);
    expect(manifest.generatedAt).toBe(1_700_000_000_000);
  });

  it('is deterministic for a given seed', () => {
    const a = generateSyntheticLogFixture({ rowCount: 100, seed: 42, intendedScenario: 'scroll-100k', generatedAt: 0 });
    const b = generateSyntheticLogFixture({ rowCount: 100, seed: 42, intendedScenario: 'scroll-100k', generatedAt: 0 });
    expect(a.text).toBe(b.text);
    expect(a.manifest.contentSha256).toBe(b.manifest.contentSha256);
  });

  it('different seeds produce different content hashes', () => {
    const a = generateSyntheticLogFixture({ rowCount: 100, seed: 1, intendedScenario: 'scroll-100k', generatedAt: 0 });
    const b = generateSyntheticLogFixture({ rowCount: 100, seed: 2, intendedScenario: 'scroll-100k', generatedAt: 0 });
    expect(a.manifest.contentSha256).not.toBe(b.manifest.contentSha256);
  });

  it('legacy generateSyntheticLogFile still produces parseable lines', () => {
    const text = generateSyntheticLogFile(20, 7);
    const lines = text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(20);
    for (const line of lines) {
      expect(line).toMatch(/^\[(INFO|DEBUG|WARN|ERROR)\] \[\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM),\d{1,3}\] \[[^\]]+\]: /);
      expect(line).toContain('"traceId"');
    }
  });
});

// ─── Hardware info ─────────────────────────────────────────────────────

describe('gatherHardwareInfo', () => {
  it('returns non-empty host values and node-os source quality', () => {
    const info = gatherHardwareInfo();
    expect(info.os.length).toBeGreaterThan(0);
    expect(info.cpuLogicalCores).toBeGreaterThan(0);
    expect(info.totalMemoryGb).toBeGreaterThan(0);
    expect(info.sourceQuality).toBe('node-os');
  });

  it('upgrades sourceQuality when GPU override is supplied', () => {
    const info = gatherHardwareInfo({ gpuDescription: 'Intel UHD 770' });
    expect(info.gpuDescription).toBe('Intel UHD 770');
    expect(info.sourceQuality).toBe('manual-override');
  });

  it('respects explicit sourceQuality override', () => {
    const info = gatherHardwareInfo({ gpuDescription: 'NVIDIA RTX', sourceQuality: 'electron-gpu' });
    expect(info.sourceQuality).toBe('electron-gpu');
  });
});

// ─── validateScrollSamples ─────────────────────────────────────────────

describe('validateScrollSamples', () => {
  const good: ScrollSamples = {
    samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
    rowsLoaded: 100_000,
    scrollDurationMs: 10_000,
    frameTimestamps: [0, 16.67, 33.33],
    meta: {
      captureSource: 'perf-harness-snippet.js@ckpt5',
      probeId: 'data-log-viewer-scroll',
      scrollMethod: 'programmatic-scrollby',
      captureUnixMs: 1_745_000_000_000,
    },
  };

  it('accepts valid samples', () => {
    expect(validateScrollSamples(good)).toEqual(good);
  });

  it('rejects wrong samples schema version with path-precise error', () => {
    expect(() =>
      validateScrollSamples({ ...good, samplesSchemaVersion: 99 }),
    ).toThrow(/expected samplesSchemaVersion=1.*\$\.samplesSchemaVersion/);
  });

  it('rejects negative row count', () => {
    expect(() => validateScrollSamples({ ...good, rowsLoaded: -1 })).toThrow(/\$\.rowsLoaded/);
  });

  it('rejects frame timestamps with too few samples', () => {
    expect(() => validateScrollSamples({ ...good, frameTimestamps: [0] })).toThrow(
      /at least 2 frame timestamps/,
    );
  });

  it('rejects unknown scrollMethod', () => {
    expect(() =>
      validateScrollSamples({ ...good, meta: { ...good.meta, scrollMethod: 'swipe' } }),
    ).toThrow(/\$\.meta\.scrollMethod/);
  });
});

// ─── validateHarnessResult ─────────────────────────────────────────────

function minimalValidResult(): HarnessResult<'scroll-100k'> {
  return {
    resultSchemaVersion: HARNESS_RESULT_SCHEMA_VERSION,
    phase: '01a',
    scenario: 'scroll-100k',
    startedAt: 1_745_000_000_000,
    completedAt: 1_745_000_010_000,
    hardware: gatherHardwareInfo(),
    metrics: {
      kind: 'scroll',
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      fpsAverage: 58,
      fpsP5: 46,
      fpsP50: 60,
      fpsP95: 60,
      droppedFrames: 5,
      longFrames: 0,
    },
    provenance: {
      measurementMode: 'manual-devtools',
      captureSource: 'test',
      actualRowsLoaded: 100_000,
      sampleCount: 600,
      scrollMethod: 'programmatic-scrollby',
      buildMode: 'electron-production',
    },
    passed: true,
    failures: [],
  };
}

describe('validateHarnessResult', () => {
  it('accepts a minimal well-formed result', () => {
    expect(validateHarnessResult(minimalValidResult())).toEqual(minimalValidResult());
  });

  it('rejects scenario ↔ metric.kind mismatch', () => {
    const bad = minimalValidResult() as HarnessResult;
    (bad.metrics as { kind: string }).kind = 'parse';
    expect(() => validateHarnessResult(bad)).toThrow(
      /scroll-100k requires metrics\.kind="scroll", got "parse"/,
    );
  });

  it('rejects unknown schema version', () => {
    const bad = { ...minimalValidResult(), resultSchemaVersion: 99 };
    expect(() => validateHarnessResult(bad)).toThrow(/unknown result schema version 99/);
  });

  it('rejects missing provenance', () => {
    const bad = { ...minimalValidResult() } as unknown as Record<string, unknown>;
    delete bad.provenance;
    expect(() => validateHarnessResult(bad)).toThrow(/\$\.provenance/);
  });

  it('rejects invalid measurementMode', () => {
    const bad = minimalValidResult();
    (bad.provenance as { measurementMode: string }).measurementMode = 'telemetry';
    expect(() => validateHarnessResult(bad)).toThrow(/\$\.provenance\.measurementMode/);
  });
});

// ─── submitScrollSamples end-to-end ────────────────────────────────────

describe('submitScrollSamples', () => {
  const cleanSamples: ScrollSamples = {
    samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
    rowsLoaded: 100_000,
    scrollDurationMs: 10_000,
    frameTimestamps: Array.from({ length: 601 }, (_, i) => i * 16.67),
    meta: {
      captureSource: 'perf-harness-snippet.js@ckpt5',
      probeId: 'data-log-viewer-scroll',
      scrollMethod: 'programmatic-scrollby',
      captureUnixMs: 1_745_000_000_000,
    },
  };

  it('builds a passing HarnessResult with filled provenance', () => {
    const config: HarnessConfig<'scroll-100k'> = {
      phase: '01a',
      scenario: 'scroll-100k',
      fixturePaths: ['/tmp/fake.log'],
      fixtureId: 'synthetic-100k-seed42',
    };
    const result = submitScrollSamples({
      config,
      samples: cleanSamples,
      buildMode: 'electron-production',
      appVersion: '2.0.0',
    });
    expect(result.resultSchemaVersion).toBe(HARNESS_RESULT_SCHEMA_VERSION);
    expect(result.scenario).toBe('scroll-100k');
    expect(result.passed).toBe(true);
    expect(result.metrics.kind).toBe('scroll');
    expect(result.provenance.actualRowsLoaded).toBe(100_000);
    expect(result.provenance.sampleCount).toBe(601);
    expect(result.provenance.fixtureId).toBe('synthetic-100k-seed42');
    expect(result.provenance.fixtureGeneratorVersion).toBe(FIXTURE_GENERATOR_VERSION);
    expect(result.provenance.buildMode).toBe('electron-production');
    expect(result.provenance.appVersion).toBe('2.0.0');
  });

  it('rejects malformed samples before any computation', () => {
    const bad = { ...cleanSamples, samplesSchemaVersion: 99 };
    expect(() =>
      submitScrollSamples({
        config: { phase: '01a', scenario: 'scroll-100k', fixturePaths: ['/tmp/fake.log'] },
        samples: bad as ScrollSamples,
      }),
    ).toThrow(/expected samplesSchemaVersion=1/);
  });
});

// ─── writeResult / readResult round-trip ───────────────────────────────

describe('writeResult / readResult', () => {
  it('writes a valid result and round-trips through validator', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-harness-'));
    try {
      const result = minimalValidResult();
      const path = writeResult(result, dir);
      expect(path).toMatch(/01a-scroll-100k-\d{8}-\d{6}\.json$/);
      const roundTrip = readResult<'scroll-100k'>(path);
      expect(roundTrip).toEqual(result);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readResult rejects a version-drifted file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-harness-'));
    try {
      const target = join(dir, 'drifted.json');
      writeFileSync(target, JSON.stringify({ resultSchemaVersion: 99 }), 'utf8');
      expect(() => readResult(target)).toThrow(/unknown result schema version 99/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readResult rejects a file with scenario/metric mismatch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-harness-'));
    try {
      const bad = minimalValidResult();
      (bad.metrics as { kind: string }).kind = 'parse';
      const target = join(dir, 'mismatch.json');
      writeFileSync(target, JSON.stringify(bad), 'utf8');
      expect(() => readResult(target)).toThrow(/metrics\.kind="scroll"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readFileSync exists', () => {
    // Smoke — fs actually installed.
    expect(typeof readFileSync).toBe('function');
  });
});
