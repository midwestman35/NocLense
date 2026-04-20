#!/usr/bin/env node
/**
 * perf-cli.ts — small CLI wrapping the perf-harness library.
 *
 * Phase 01a checkpoint 5 addresses Codex's "Thin CLI" structural
 * suggestion. Replaces the broken README pseudocode with real,
 * testable commands.
 *
 * Invocation: `node --experimental-strip-types scripts/perf-cli.ts <cmd> …`
 *
 * Commands:
 *   generate --rows <n> --seed <n> --scenario <s> --out <path>
 *       Writes fixture text + `<path>.manifest.json`.
 *
 *   submit --phase <p> --scenario <s> [--fixture-id <id>]
 *          [--build-sha <sha>] [--app-version <v>] [--build-mode <m>]
 *       Reads ScrollSamples JSON from stdin, validates, builds a
 *       HarnessResult, writes it to docs/perf/, prints the path.
 *
 *   validate <result-file>
 *       Reads a result file, runs validateHarnessResult, reports
 *       pass/fail with path-precise errors.
 *
 *   show <result-file>
 *       Prints scenario, pass state, key metrics, and provenance.
 */

import { readFileSync } from 'node:fs';
import {
  FIXTURE_GENERATOR_VERSION,
  generateSyntheticLogFixture,
  readResult,
  submitScrollSamples,
  validateScrollSamples,
  validateHarnessResult,
  writeFixture,
  writeResult,
  type BuildMode,
  type HarnessConfig,
  type HarnessPhase,
  type HarnessScenario,
  type ScrollSamples,
} from './perf-harness.ts';

function parseArgs(argv: readonly string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const PHASES: readonly HarnessPhase[] = ['01a', '01b', '01c', '02', '03', '04', '05'];
const SCENARIOS: readonly HarnessScenario[] = [
  'scroll-100k',
  'parse-50mb',
  'parse-200mb-indexeddb',
  'citation-jump-latency',
  'ai-diagnose-turnaround',
  'evidence-export-20-items',
  'memory-idle-10min',
];
const BUILD_MODES: readonly BuildMode[] = [
  'electron-production',
  'electron-dev',
  'vite-dev',
  'unknown',
];

function assertOneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`invalid ${label} "${value}"; must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function requireFlag(flags: Record<string, string>, name: string): string {
  const v = flags[name];
  if (!v) throw new Error(`missing required --${name}`);
  return v;
}

function optionalFlag(flags: Record<string, string>, name: string): string | undefined {
  return flags[name];
}

function readStdin(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

export async function runGenerate(flags: Record<string, string>): Promise<number> {
  const rows = Number.parseInt(requireFlag(flags, 'rows'), 10);
  if (!Number.isFinite(rows) || rows <= 0) throw new Error('--rows must be a positive integer');
  const seed = Number.parseInt(requireFlag(flags, 'seed'), 10);
  if (!Number.isFinite(seed)) throw new Error('--seed must be an integer');
  const scenario = assertOneOf(requireFlag(flags, 'scenario'), SCENARIOS, 'scenario');
  const out = requireFlag(flags, 'out');
  const result = generateSyntheticLogFixture({ rowCount: rows, seed, intendedScenario: scenario });
  const { fixturePath, manifestPath } = writeFixture(out, result);
  process.stdout.write(
    `wrote fixture: ${fixturePath}\n` +
      `wrote manifest: ${manifestPath}\n` +
      `rows=${rows} seed=${seed} generator-version=${FIXTURE_GENERATOR_VERSION} sha256=${result.manifest.contentSha256.slice(0, 12)}…\n`,
  );
  return 0;
}

export async function runSubmit(flags: Record<string, string>, input: string): Promise<number> {
  const phase = assertOneOf(requireFlag(flags, 'phase'), PHASES, 'phase');
  const scenario = assertOneOf(requireFlag(flags, 'scenario'), SCENARIOS, 'scenario');
  if (scenario !== 'scroll-100k') {
    throw new Error(
      `submit: scenario "${scenario}" not yet supported (only scroll-100k in checkpoint 5). ` +
        'Other scenarios unlock as their Phase lands.',
    );
  }
  // Validate args BEFORE parsing samples, so bad flags fail fast
  // with specific errors (not "your JSON doesn't match the sample
  // schema" when the real issue is a typo in --build-mode).
  const buildModeFlag = optionalFlag(flags, 'build-mode');
  const buildMode = buildModeFlag ? assertOneOf(buildModeFlag, BUILD_MODES, 'build-mode') : undefined;
  const raw = JSON.parse(input);
  const samples: ScrollSamples = validateScrollSamples(raw);
  const config: HarnessConfig<'scroll-100k'> = {
    phase,
    scenario: 'scroll-100k',
    fixturePaths: [optionalFlag(flags, 'fixture-path') ?? 'n/a'],
    buildSha: optionalFlag(flags, 'build-sha'),
    fixtureId: optionalFlag(flags, 'fixture-id'),
    appVersion: optionalFlag(flags, 'app-version'),
    buildMode,
  };
  const result = submitScrollSamples({ config, samples, buildMode, appVersion: optionalFlag(flags, 'app-version') });
  const outPath = writeResult(result);
  process.stdout.write(
    `wrote ${outPath}\n` +
      `passed=${result.passed}\n` +
      (result.failures.length > 0 ? `failures:\n  - ${result.failures.join('\n  - ')}\n` : ''),
  );
  return result.passed ? 0 : 1;
}

export async function runValidate(positional: string[]): Promise<number> {
  if (positional.length === 0) throw new Error('validate: missing <result-file>');
  const path = positional[0];
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  try {
    validateHarnessResult(raw);
    process.stdout.write(`valid: ${path}\n`);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`invalid: ${path}\n  ${message}\n`);
    return 1;
  }
}

export async function runShow(positional: string[]): Promise<number> {
  if (positional.length === 0) throw new Error('show: missing <result-file>');
  const path = positional[0];
  const result = readResult(path);
  const metrics = result.metrics as unknown as { kind: string; [k: string]: unknown };
  process.stdout.write(
    [
      `file:      ${path}`,
      `scenario:  ${result.scenario}`,
      `phase:     ${result.phase}`,
      `passed:    ${result.passed}`,
      `hardware:  ${result.hardware.cpuModel} / ${result.hardware.totalMemoryGb}GB / GPU=${result.hardware.gpuDescription}`,
      `provenance:`,
      `  mode=${result.provenance.measurementMode} source=${result.provenance.captureSource}`,
      `  scroll=${result.provenance.scrollMethod} rows=${result.provenance.actualRowsLoaded} samples=${result.provenance.sampleCount}`,
      `  build=${result.provenance.buildMode} fixture=${result.provenance.fixtureId ?? 'n/a'}`,
      `metrics (kind=${metrics.kind}): ${JSON.stringify(metrics)}`,
      result.failures.length > 0 ? `failures:\n  - ${result.failures.join('\n  - ')}` : '',
    ]
      .filter(Boolean)
      .join('\n') + '\n',
  );
  return result.passed ? 0 : 1;
}

export async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 0) {
    process.stderr.write(
      'usage: perf-cli <generate|submit|validate|show> [args]\n' +
        '  generate --rows N --seed N --scenario S --out PATH\n' +
        '  submit --phase P --scenario S [--fixture-id ID] [--build-sha SHA]\n' +
        '         [--app-version V] [--build-mode M] < samples.json\n' +
        '  validate <result-file>\n' +
        '  show <result-file>\n',
    );
    return 2;
  }
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  try {
    switch (command) {
      case 'generate':
        return await runGenerate(flags);
      case 'submit':
        return await runSubmit(flags, await readStdin());
      case 'validate':
        return await runValidate(positional);
      case 'show':
        return await runShow(positional);
      default:
        process.stderr.write(`unknown command "${command}"\n`);
        return 2;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    return 1;
  }
}

// Allow `node scripts/perf-cli.ts …` direct invocation without re-export churn.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
