import { describe, expect, it } from 'vitest';
import { importPastedLogs } from '../importService';

describe('importService', () => {
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
