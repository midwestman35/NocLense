/**
 * perf-harness.test.ts — covers every pure function in the harness.
 * The end-to-end renderer path (scripts/perf-harness-snippet.js) is
 * documented manual flow, so these tests exist to lock the data
 * contract and threshold logic.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  HARNESS_RESULT_SCHEMA_VERSION,
  PASS_THRESHOLDS,
  buildScrollMetrics,
  computeFpsPercentiles,
  evaluatePassThresholds,
  gatherHardwareInfo,
  generateSyntheticLogFile,
  readResult,
  submitScrollSamples,
  writeResult,
  type HarnessConfig,
  type HarnessResult,
  type ParseMetrics,
  type ScrollMetrics,
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

  it('drops the worst frames to p5, not average', () => {
    // 95 good frames at 16.67ms + 5 stalls at 100ms
    const stream = [
      ...Array.from({ length: 95 }, () => 16.67),
      ...Array.from({ length: 5 }, () => 100),
    ];
    const p = computeFpsPercentiles(stream);
    // Average stays high...
    expect(p.avg).toBeGreaterThan(55);
    // ...but p5 reflects the stalls (10 fps for a 100ms frame).
    expect(p.p5).toBeLessThan(15);
  });

  it('filters non-finite and zero intervals', () => {
    const stream = [16.67, 0, NaN, Infinity, 16.67, -5];
    const p = computeFpsPercentiles(stream);
    expect(p.avg).toBeGreaterThan(59);
  });
});

// ─── buildScrollMetrics ────────────────────────────────────────────────

describe('buildScrollMetrics', () => {
  it('derives clean 60fps metrics from even rAF timestamps', () => {
    const frameTimestamps: number[] = [];
    for (let i = 0; i < 601; i++) frameTimestamps.push(i * 16.67);
    const m = buildScrollMetrics({
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
    });
    expect(m.kind).toBe('scroll');
    expect(m.rowsLoaded).toBe(100_000);
    expect(m.fpsAverage).toBeGreaterThan(59);
    expect(m.fpsP5).toBeGreaterThan(59);
    expect(m.droppedFrames).toBe(0);
    expect(m.longFrames).toBe(0);
  });

  it('counts dropped and long frames correctly', () => {
    // 50 normal + 10 dropped (25ms) + 2 long (60ms)
    const frameTimestamps: number[] = [0];
    for (let i = 1; i <= 50; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 16.67);
    for (let i = 0; i < 10; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 25);
    for (let i = 0; i < 2; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 60);
    const m = buildScrollMetrics({
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
    });
    expect(m.droppedFrames).toBe(12); // 10 @ 25ms + 2 @ 60ms both cross the 20ms line
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
    const { passed, failures } = evaluatePassThresholds(m, 'scroll-100k');
    expect(passed).toBe(true);
    expect(failures).toEqual([]);
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

  it('parse-50mb fails on slow throughput', () => {
    const m: ParseMetrics = {
      kind: 'parse',
      fileSizeBytes: 50_000_000,
      dropToFirstRowVisibleMs: 4000,
      endToEndParseMs: 7000,
      throughputMbps: 20, // below 40
      peakHeapMb: 200,
      indexedDbUsed: false,
    };
    const { passed, failures } = evaluatePassThresholds(m, 'parse-50mb');
    expect(passed).toBe(false);
    expect(failures.some((f) => f.includes('throughputMbps'))).toBe(true);
  });

  it('threshold constants match spec §6.4', () => {
    expect(PASS_THRESHOLDS.scroll.fpsAverageMin).toBe(55);
    expect(PASS_THRESHOLDS.scroll.fpsP5Min).toBe(45);
    expect(PASS_THRESHOLDS.parse50.dropToFirstRowVisibleMsMax).toBe(8_000);
    expect(PASS_THRESHOLDS.memory.growthMbMax).toBe(50);
  });
});

// ─── Fixture generator ────────────────────────────────────────────────

describe('generateSyntheticLogFile', () => {
  it('produces exactly rowCount lines', () => {
    const text = generateSyntheticLogFile(1000, 42);
    expect(text.split('\n').filter(Boolean)).toHaveLength(1000);
  });

  it('is deterministic for a given seed', () => {
    expect(generateSyntheticLogFile(100, 42)).toBe(generateSyntheticLogFile(100, 42));
  });

  it('differs between seeds', () => {
    expect(generateSyntheticLogFile(100, 42)).not.toBe(generateSyntheticLogFile(100, 43));
  });

  it('every line parses as an OC-style header + JSON body', () => {
    const text = generateSyntheticLogFile(50, 7);
    const lines = text.split('\n').filter(Boolean);
    for (const line of lines) {
      expect(line).toMatch(/^\[(INFO|DEBUG|WARN|ERROR)\] \[\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM),\d{1,3}\] \[[^\]]+\]: /);
      expect(line).toContain('"traceId"');
    }
  });
});

// ─── Hardware info ─────────────────────────────────────────────────────

describe('gatherHardwareInfo', () => {
  it('returns non-empty host values', () => {
    const info = gatherHardwareInfo();
    expect(info.os.length).toBeGreaterThan(0);
    expect(info.cpuLogicalCores).toBeGreaterThan(0);
    expect(info.totalMemoryGb).toBeGreaterThan(0);
    expect(info.gpuDescription).toBe('unknown');
  });

  it('respects overrides (Electron runner integration)', () => {
    const info = gatherHardwareInfo({ gpuDescription: 'Intel UHD 770' });
    expect(info.gpuDescription).toBe('Intel UHD 770');
  });
});

// ─── submitScrollSamples end-to-end ────────────────────────────────────

describe('submitScrollSamples', () => {
  it('builds a passing HarnessResult from clean 60fps samples', () => {
    const config: HarnessConfig<'scroll-100k'> = {
      phase: '01a',
      scenario: 'scroll-100k',
      fixturePaths: ['/tmp/fake-fixture.log'],
    };
    const frameTimestamps: number[] = [];
    for (let i = 0; i < 601; i++) frameTimestamps.push(i * 16.67);
    const result = submitScrollSamples(config, {
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
    });
    expect(result.resultSchemaVersion).toBe(HARNESS_RESULT_SCHEMA_VERSION);
    expect(result.scenario).toBe('scroll-100k');
    expect(result.passed).toBe(true);
    expect(result.metrics.kind).toBe('scroll');
    expect(result.metrics.fpsAverage).toBeGreaterThan(59);
  });

  it('builds a failing result when samples are janky', () => {
    const config: HarnessConfig<'scroll-100k'> = {
      phase: '01a',
      scenario: 'scroll-100k',
      fixturePaths: ['/tmp/fake-fixture.log'],
    };
    // Simulate 30fps with large stalls: intervals of 33ms then some 100ms spikes.
    const frameTimestamps: number[] = [0];
    for (let i = 1; i <= 300; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 33);
    for (let i = 0; i < 20; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 100);
    const result = submitScrollSamples(config, {
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});

// ─── writeResult / readResult round-trip ───────────────────────────────

describe('writeResult / readResult', () => {
  it('writes, reads, and validates schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-harness-'));
    try {
      const result: HarnessResult<'scroll-100k'> = {
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
        passed: true,
        failures: [],
      };
      const path = writeResult(result, dir);
      expect(path).toMatch(/01a-scroll-100k-\d{8}-\d{6}\.json$/);
      expect(readFileSync(path, 'utf8').length).toBeGreaterThan(0);
      const roundTrip = readResult<'scroll-100k'>(path);
      expect(roundTrip).toEqual(result);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a file with the wrong schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-harness-'));
    try {
      const target = join(dir, 'drifted.json');
      writeFileSync(
        target,
        JSON.stringify({ resultSchemaVersion: 99, phase: '01a', scenario: 'scroll-100k' }),
        'utf8',
      );
      expect(() => readResult(target)).toThrow(/unknown result schema version 99/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
