import { describe, expect, it } from 'vitest';
import { buildPack } from '../exportPackBuilder';
import type { Case } from '../../types/case';
import type { ImportedDataset, LogEntry } from '../../types';

const caseRecord: Case = {
  id: 'case_1',
  title: 'Call setup failure',
  severity: 'high',
  status: 'handoff',
  externalRef: 'INC-4821',
  owner: 'NOC',
  stakeholderTeam: 'Voice Platform',
  summary: 'Calls are failing during setup.',
  impact: 'Inbound calls are intermittently unavailable.',
  createdAt: 1,
  updatedAt: 1,
  attachments: [],
  bookmarks: [
    { id: 'bookmark_1', logId: 7, tag: 'evidence', note: 'First failure observed', timestamp: 1000 },
  ],
  notes: [],
  timeWindow: { start: 1000, end: 2000 },
  state: {
    pivots: ['callId:abc123'],
    filters: { activeCorrelations: [{ type: 'callId', value: 'abc123' }] },
    timeWindow: { start: 1000, end: 2000 },
    selectedLogId: 7,
    activePanel: 'case',
  },
};

const datasets: ImportedDataset[] = [
  {
    id: 'dataset_1',
    importBatchId: 'import_1',
    sourceType: 'datadog',
    sourceLabel: 'Datadog',
    fileName: 'dd-export.csv',
    kind: 'file',
    size: 128,
    importedAt: 100,
    logCount: 1,
    warnings: [],
  },
];

const logs: LogEntry[] = [
  {
    id: 7,
    timestamp: 1500,
    rawTimestamp: '2026-03-08T14:15:16.123Z',
    level: 'ERROR',
    component: 'sip.transport',
    displayComponent: 'SipTransport',
    message: 'Call failed for callId=abc123 contact user@example.com',
    displayMessage: 'Call failed for callId=abc123 contact user@example.com',
    payload: 'Call payload for 555-555-5555',
    type: 'LOG',
    isSip: true,
    sipMethod: '503 Service Unavailable',
    callId: 'abc123',
    fileName: 'dd-export.csv',
    sourceType: 'datadog',
    sourceLabel: 'Datadog',
  },
];

describe('exportPackBuilder', () => {
  it('builds a redacted evidence pack with report and queries', () => {
    const pack = buildPack(caseRecord, logs, datasets, {
      packType: 'full',
      redactionPreset: 'external',
      includePayload: true,
      timeBufferSeconds: 0,
      maxEvents: 100,
    });

    expect(pack.report).toContain('Call setup failure');
    expect(pack.report).toContain('Voice Platform');
    expect(pack.queries).toContain('Datadog');
    expect(pack.queries).toContain('AWS / CloudWatch');
    expect(pack.filteredLogs).toContain('[PHONE]');
    expect(pack.filteredLogs).toContain('[EMAIL]');
    expect(pack.provenance.importedDatasets).toHaveLength(1);
  });
});
