import { describe, expect, it, vi, beforeEach } from 'vitest';
import { importFiles, importPastedLogs } from '../importService';

// Prevent IndexedDB calls in tests (only reached for >50MB files; our test
// files are tiny, so this mock is a safety net, not the load-bearing path).
vi.mock('../../utils/indexedDB', () => ({
  dbManager: {
    init: vi.fn().mockResolvedValue(undefined),
    addLogsBatch: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockResolvedValue(null),
    updateMetadata: vi.fn().mockResolvedValue(undefined),
    getMaxLogId: vi.fn().mockResolvedValue(0),
    updateLogsByIdRange: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── paste path (existing) ────────────────────────────────────────────────────

describe('importPastedLogs', () => {
  it('parses pasted AWS console lines into annotated log entries', async () => {
    const result = await importPastedLogs(
      '2026-03-08T14:15:16.123Z requestId=abc123 Something happened\n2026-03-08T14:15:17.123Z requestId=abc123 Next event',
      {
        sourceType: 'aws',
        startId: 100,
        label: 'aws-incident.log',
      }
    );

    expect(result.logs).toHaveLength(2);
    expect(result.logs[0].id).toBe(100);
    expect(result.logs[0].sourceType).toBe('aws');
    expect(result.logs[0].sourceLabel).toBe('AWS Console');
    expect(result.logs[0].fileName).toBe('aws-incident.log');
    expect(result.dataset.logCount).toBe(2);
  });

  it('falls back to line-by-line import when AWS paste format is weak', async () => {
    const result = await importPastedLogs('plain line one\nplain line two', {
      sourceType: 'aws',
      startId: 1,
      label: 'fallback.log',
    });

    expect(result.logs).toHaveLength(2);
    expect(result.warnings[0]).toMatch(/fallback/i);
    expect(result.logs[0].component).toBe('AWS Console');
  });
});

// ─── upload path (new) ────────────────────────────────────────────────────────

describe('importFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to line-by-line import for a plain-text .log file not matching strict parsers', async () => {
    const content = 'plain line one\nplain line two\nplain line three';
    const file = new File([content], 'incident.log', { type: 'text/plain' });

    const result = await importFiles([file], { sourceType: 'apex', startId: 1, useIndexedDB: false });

    expect(result.logs).toHaveLength(3);
    expect(result.datasets[0].logCount).toBe(3);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/did not match a known log format/i);
    expect(result.warnings[0]).toMatch(/incident\.log/);
    expect(result.usedIndexedDB).toBe(false);
  });

  it('falls back to line-by-line import for a plain-text .txt file', async () => {
    const content = 'event alpha\nevent beta';
    const file = new File([content], 'events.txt', { type: 'text/plain' });

    const result = await importFiles([file], { sourceType: 'apex', startId: 10, useIndexedDB: false });

    expect(result.logs).toHaveLength(2);
    expect(result.datasets[0].logCount).toBe(2);
    expect(result.warnings[0]).toMatch(/did not match a known log format/i);
  });

  it('annotates fallback logs with the correct dataset metadata', async () => {
    const content = 'something happened';
    const file = new File([content], 'test.log', { type: 'text/plain' });

    const result = await importFiles([file], { sourceType: 'datadog', startId: 5, useIndexedDB: false });

    expect(result.logs[0].sourceType).toBe('datadog');
    expect(result.logs[0].importBatchId).toBe(result.datasets[0].importBatchId);
  });

  it('adds warning to dataset.warnings when fallback import is used', async () => {
    const file = new File(['unrecognized text'], 'plain.log', { type: 'text/plain' });
    const result = await importFiles([file], { sourceType: 'apex', startId: 1, useIndexedDB: false });

    expect(result.datasets[0].warnings).toHaveLength(1);
    expect(result.datasets[0].warnings[0]).toMatch(/standalone events/i);
  });

  it('parses a valid Datadog CSV without triggering fallback', async () => {
    // CSV double-double-quote encoding: "" inside a quoted field represents one "
    const csv = [
      '"Date","Host","Service","Content"',
      '"2026-03-08T14:00:00.000Z","host1","service1","{""log"":{""message"":""hello"",""logLevel"":""INFO"",""logSource"":""MyService""}}"',
    ].join('\n');
    const file = new File([csv], 'logs.csv', { type: 'text/csv' });

    const result = await importFiles([file], { sourceType: 'datadog', startId: 1, useIndexedDB: false });

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not silently succeed when a CSV returns zero rows', async () => {
    // A CSV with only a header and no data rows → structured parser returns []
    // but CSV files are excluded from fallback (malformed CSV should stay empty)
    const csv = '"Date","Host","Service","Content"\n';
    const file = new File([csv], 'empty.csv', { type: 'text/csv' });

    const result = await importFiles([file], { sourceType: 'datadog', startId: 1, useIndexedDB: false });

    // No fallback for CSV; logCount is 0 and no warning injected
    expect(result.datasets[0].logCount).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles multi-file import where one file uses fallback and one does not', async () => {
    const plainContent = 'line one\nline two';
    const csvContent = [
      '"Date","Host","Service","Content"',
      '"2026-03-08T14:00:00.000Z","h","s","{""log"":{""message"":""hi"",""logLevel"":""INFO"",""logSource"":""S""}}"',
    ].join('\n');

    const plainFile = new File([plainContent], 'plain.log', { type: 'text/plain' });
    const csvFile = new File([csvContent], 'data.csv', { type: 'text/csv' });

    const result = await importFiles([plainFile, csvFile], { sourceType: 'apex', startId: 1, useIndexedDB: false });

    expect(result.datasets).toHaveLength(2);
    // First dataset: 2 fallback lines
    expect(result.datasets[0].logCount).toBe(2);
    // Second dataset: 1 parsed CSV row
    expect(result.datasets[1].logCount).toBeGreaterThan(0);
    // One warning for the plain text fallback
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/plain\.log/);
  });

  it('rejects files with invalid extensions before attempting any parsing', async () => {
    const file = new File(['{}'], 'bad.json', { type: 'application/json' });

    await expect(importFiles([file], { sourceType: 'apex', startId: 1 })).rejects.toThrow(
      'Invalid file type'
    );
  });
});
