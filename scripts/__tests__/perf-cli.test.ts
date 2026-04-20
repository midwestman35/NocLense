/**
 * perf-cli.test.ts — exercises the CLI command handlers directly
 * (argv-dispatch path) rather than spawning a subprocess. Catches
 * argument parsing, validation, and stdout/stderr wiring without
 * requiring Node's TS runner to be set up in CI.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  runGenerate,
  runSubmit,
  runValidate,
  runShow,
  main,
} from '../perf-cli';
import {
  FIXTURE_GENERATOR_VERSION,
  SAMPLES_SCHEMA_VERSION,
  validateHarnessResult,
  type ScrollSamples,
} from '../perf-harness';

let stdoutChunks: string[];
let stderrChunks: string[];

beforeEach(() => {
  stdoutChunks = [];
  stderrChunks = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stdout(): string {
  return stdoutChunks.join('');
}

function stderr(): string {
  return stderrChunks.join('');
}

// ─── generate ─────────────────────────────────────────────────────────

describe('runGenerate', () => {
  it('writes fixture + manifest and reports them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-cli-'));
    try {
      const out = join(dir, 'fixture.log');
      const code = await runGenerate({ rows: '50', seed: '42', scenario: 'scroll-100k', out });
      expect(code).toBe(0);
      const lines = readFileSync(out, 'utf8').split('\n').filter(Boolean);
      expect(lines).toHaveLength(50);
      const manifest = JSON.parse(readFileSync(out + '.manifest.json', 'utf8'));
      expect(manifest.fixtureGeneratorVersion).toBe(FIXTURE_GENERATOR_VERSION);
      expect(manifest.intendedScenario).toBe('scroll-100k');
      expect(stdout()).toMatch(/wrote fixture:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects invalid scenario', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-cli-'));
    try {
      await expect(
        runGenerate({ rows: '10', seed: '1', scenario: 'nonexistent', out: join(dir, 'f.log') }),
      ).rejects.toThrow(/invalid scenario/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects negative rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-cli-'));
    try {
      await expect(
        runGenerate({ rows: '-5', seed: '1', scenario: 'scroll-100k', out: join(dir, 'f.log') }),
      ).rejects.toThrow(/--rows must be a positive integer/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── submit ───────────────────────────────────────────────────────────

describe('runSubmit', () => {
  it('builds and writes a passing result from clean samples', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mkdtempSync(join(tmpdir(), 'perf-cli-')));
    try {
      const samples: ScrollSamples = {
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
      const code = await runSubmit(
        { phase: '01a', scenario: 'scroll-100k', 'build-mode': 'electron-production' },
        JSON.stringify(samples),
      );
      expect(code).toBe(0);
      expect(stdout()).toMatch(/passed=true/);
      expect(stdout()).toMatch(/wrote .*\.json/);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('returns 1 and lists failures when samples are janky', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mkdtempSync(join(tmpdir(), 'perf-cli-')));
    try {
      const frameTimestamps: number[] = [0];
      for (let i = 1; i <= 300; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 33);
      for (let i = 0; i < 30; i++) frameTimestamps.push(frameTimestamps.at(-1)! + 100);
      const samples: ScrollSamples = {
        samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
        rowsLoaded: 100_000,
        scrollDurationMs: 10_000,
        frameTimestamps,
        meta: {
          captureSource: 'perf-harness-snippet.js@ckpt5',
          probeId: 'data-log-viewer-scroll',
          scrollMethod: 'programmatic-scrollby',
          captureUnixMs: 1_745_000_000_000,
        },
      };
      const code = await runSubmit(
        { phase: '01a', scenario: 'scroll-100k' },
        JSON.stringify(samples),
      );
      expect(code).toBe(1);
      expect(stdout()).toMatch(/passed=false/);
      expect(stdout()).toMatch(/failures:/);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('rejects scenarios other than scroll-100k with a clear message', async () => {
    await expect(
      runSubmit({ phase: '01a', scenario: 'parse-50mb' }, '{}'),
    ).rejects.toThrow(/only scroll-100k in checkpoint 5/);
  });

  it('rejects unknown build-mode', async () => {
    await expect(
      runSubmit({ phase: '01a', scenario: 'scroll-100k', 'build-mode': 'fictional' }, '{}'),
    ).rejects.toThrow(/invalid build-mode/);
  });
});

// ─── validate ─────────────────────────────────────────────────────────

describe('runValidate', () => {
  it('returns 0 on a valid result file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-cli-'));
    try {
      const validPath = join(dir, 'valid.json');
      const hw = { os: 'linux', osVersion: '6', cpuModel: 'x', cpuLogicalCores: 8, totalMemoryGb: 16, gpuDescription: 'unknown', sourceQuality: 'node-os' };
      const provenance = { measurementMode: 'manual-devtools', captureSource: 'test', actualRowsLoaded: 100, sampleCount: 10, scrollMethod: 'programmatic-scrollby', buildMode: 'electron-production' };
      const result = {
        resultSchemaVersion: 1,
        phase: '01a',
        scenario: 'scroll-100k',
        startedAt: 1,
        completedAt: 2,
        hardware: hw,
        metrics: { kind: 'scroll', rowsLoaded: 100, scrollDurationMs: 1, fpsAverage: 60, fpsP5: 60, fpsP50: 60, fpsP95: 60, droppedFrames: 0, longFrames: 0 },
        provenance,
        passed: true,
        failures: [],
      };
      writeFileSync(validPath, JSON.stringify(result), 'utf8');
      expect(() => validateHarnessResult(result)).not.toThrow();
      const code = await runValidate([validPath]);
      expect(code).toBe(0);
      expect(stdout()).toMatch(/valid:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns 1 and reports the validation error on malformed input', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perf-cli-'));
    try {
      const badPath = join(dir, 'bad.json');
      writeFileSync(badPath, JSON.stringify({ resultSchemaVersion: 99 }), 'utf8');
      const code = await runValidate([badPath]);
      expect(code).toBe(1);
      expect(stderr()).toMatch(/invalid:/);
      expect(stderr()).toMatch(/unknown result schema version 99/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects missing path', async () => {
    await expect(runValidate([])).rejects.toThrow(/missing <result-file>/);
  });
});

// ─── main dispatch ────────────────────────────────────────────────────

describe('main dispatcher', () => {
  it('prints usage and returns 2 with no args', async () => {
    const code = await main([]);
    expect(code).toBe(2);
    expect(stderr()).toMatch(/usage: perf-cli/);
  });

  it('returns 2 on unknown command', async () => {
    const code = await main(['derp']);
    expect(code).toBe(2);
    expect(stderr()).toMatch(/unknown command "derp"/);
  });
});

// runShow is covered via the seam test (writes a result file, then
// reads it) — kept out of this file to avoid double-mocked fs state.
void runShow;
