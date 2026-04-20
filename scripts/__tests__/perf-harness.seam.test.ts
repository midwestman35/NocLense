/**
 * perf-harness.seam.test.ts — integration-seam tests for the manual
 * measurement path.
 *
 * Locks three things that are hard to catch with pure-function tests:
 *   1. The probe attribute names the TS harness resolves are exactly
 *      the names the DevTools snippet queries for. Drift between them
 *      silently breaks the capture path.
 *   2. resolveLogViewerProbe works against a representative DOM
 *      fragment (jsdom) and fails loudly when the probe is missing
 *      or the row count is malformed.
 *   3. A snippet-shaped payload round-trips through
 *      validateScrollSamples → submitScrollSamples → writeResult
 *      without rejection, producing a result that itself validates.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LOG_VIEWER_ROWS_PROBE,
  LOG_VIEWER_SCROLL_PROBE,
  SAMPLES_SCHEMA_VERSION,
  resolveLogViewerProbe,
  submitScrollSamples,
  validateHarnessResult,
  validateScrollSamples,
  type HarnessConfig,
  type ScrollSamples,
} from '../perf-harness';

const SNIPPET_PATH = join(__dirname, '..', 'perf-harness-snippet.js');

function clearBody(): void {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
}

afterEach(clearBody);

describe('snippet ↔ harness probe contract', () => {
  const snippet = readFileSync(SNIPPET_PATH, 'utf8');

  it('snippet uses the same scroll-probe attribute as the harness', () => {
    expect(snippet).toContain(`'${LOG_VIEWER_SCROLL_PROBE}'`);
  });

  it('snippet uses the same row-count probe as the harness', () => {
    expect(snippet).toContain(`'${LOG_VIEWER_ROWS_PROBE}'`);
  });

  it('snippet declares the same samples schema version as the harness', () => {
    expect(snippet).toContain(`SAMPLES_SCHEMA_VERSION = ${SAMPLES_SCHEMA_VERSION}`);
  });

  it('snippet identifies itself as programmatic-scrollby (matches measurement doctrine)', () => {
    expect(snippet).toContain("'programmatic-scrollby'");
  });
});

describe('resolveLogViewerProbe (DOM fragment)', () => {
  function makeScrollable({ rows }: { rows: string | null }): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-log-viewer-scroll', '');
    if (rows !== null) el.setAttribute('data-log-viewer-rows', rows);
    el.style.height = '400px';
    el.style.overflowY = 'auto';
    const inner = document.createElement('div');
    inner.style.height = '10000px';
    el.appendChild(inner);
    return el;
  }

  it('finds the scroll element and returns the DOM row count', () => {
    document.body.appendChild(makeScrollable({ rows: '42' }));
    const probe = resolveLogViewerProbe(document);
    expect(probe.rowsLoaded).toBe(42);
    expect(probe.probeId).toBe('data-log-viewer-scroll');
    expect(probe.element.getAttribute('data-log-viewer-rows')).toBe('42');
  });

  it('throws a clear error when the probe is missing', () => {
    const decoy = document.createElement('div');
    decoy.textContent = 'no probe here';
    document.body.appendChild(decoy);
    expect(() => resolveLogViewerProbe(document)).toThrow(
      /\[data-log-viewer-scroll\] not found/,
    );
  });

  it('throws when the row count attribute is absent', () => {
    document.body.appendChild(makeScrollable({ rows: null }));
    expect(() => resolveLogViewerProbe(document)).toThrow(
      /\[data-log-viewer-rows\] missing/,
    );
  });

  it('throws on a garbled row count', () => {
    document.body.appendChild(makeScrollable({ rows: 'lots' }));
    expect(() => resolveLogViewerProbe(document)).toThrow(
      /invalid row count "lots"/,
    );
  });
});

describe('snippet payload shape round-trips through submission', () => {
  function snippetPayload(): ScrollSamples {
    const frameTimestamps = Array.from({ length: 601 }, (_, i) => i * 16.67);
    return {
      samplesSchemaVersion: SAMPLES_SCHEMA_VERSION,
      rowsLoaded: 100_000,
      scrollDurationMs: 10_000,
      frameTimestamps,
      meta: {
        captureSource: 'perf-harness-snippet.js@ckpt5',
        probeId: LOG_VIEWER_SCROLL_PROBE,
        scrollMethod: 'programmatic-scrollby',
        startScrollTop: 0,
        endScrollTop: 8_000,
        captureUnixMs: 1_745_000_000_000,
      },
    };
  }

  it('validates as ScrollSamples, builds a result, and the result validates', () => {
    const raw = snippetPayload();
    const samples = validateScrollSamples(raw);
    const config: HarnessConfig<'scroll-100k'> = {
      phase: '01a',
      scenario: 'scroll-100k',
      fixturePaths: ['docs/perf/fixtures/scroll-100k.log'],
      fixtureId: 'synthetic-100k-seed42',
    };
    const result = submitScrollSamples({ config, samples, buildMode: 'electron-production' });
    expect(result.passed).toBe(true);
    expect(() => validateHarnessResult(result)).not.toThrow();
  });

  it('hand-edited invalid payload is rejected with a path-precise error', () => {
    const bad = snippetPayload();
    (bad.meta as { scrollMethod: string }).scrollMethod = 'mouse-wheel';
    expect(() => validateScrollSamples(bad)).toThrow(/\$\.meta\.scrollMethod/);
  });
});
