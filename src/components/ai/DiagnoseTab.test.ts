import { describe, expect, it } from 'vitest';
import {
  DIAGNOSE_PIPELINE_UI_FLAG,
  buildCanonicalInvestigationPreview,
  buildZendeskTicketUrl,
  getDiagnosePipelineProgress,
  readDiagnosePipelineFlag,
} from './diagnose/pipelineUi';
import type { LogEntry } from '../../types';
import type { DiagnosisResult } from '../../types/diagnosis';
import type { ZendeskTicket } from '../../services/zendeskService';

describe('readDiagnosePipelineFlag', () => {
  it('reads the localStorage feature flag', () => {
    expect(
      readDiagnosePipelineFlag({
        getItem: (key: string) => (key === DIAGNOSE_PIPELINE_UI_FLAG ? 'true' : null),
      })
    ).toBe(true);
  });

  it('falls back to false when storage access fails', () => {
    expect(
      readDiagnosePipelineFlag({
        getItem: () => {
          throw new Error('blocked');
        },
      })
    ).toBe(false);
  });
});

describe('getDiagnosePipelineProgress', () => {
  it('maps scanning states to the expected pipeline stage', () => {
    expect(getDiagnosePipelineProgress(1, true, 'Loading 2 attachments…')).toEqual({
      activeStage: 'ingest',
      completedStages: [],
    });
    expect(getDiagnosePipelineProgress(1, true, 'Fetching Datadog logs…')).toEqual({
      activeStage: 'pattern',
      completedStages: ['ingest'],
    });
    expect(getDiagnosePipelineProgress(1, true, 'Analyzing with Unleashed AI…')).toEqual({
      activeStage: 'hypothesize',
      completedStages: ['ingest', 'pattern'],
    });
  });

  it('marks analyze and act once the legacy phases advance', () => {
    expect(getDiagnosePipelineProgress(2, false, 'idle')).toEqual({
      activeStage: 'analyze',
      completedStages: ['ingest', 'pattern', 'hypothesize', 'collect'],
    });
    expect(getDiagnosePipelineProgress(3, false, 'idle')).toEqual({
      activeStage: 'act',
      completedStages: ['ingest', 'pattern', 'hypothesize', 'collect', 'analyze'],
    });
  });
});

describe('buildCanonicalInvestigationPreview', () => {
  it('bridges the diagnosis result into the canonical investigation shape', () => {
    const diagnosisResult: DiagnosisResult = {
      summary: 'Call dropped on station 42',
      rootCause: 'PBX registration failure',
      correlatedLogs: [
        {
          logId: 7,
          index: 0,
          rawTimestamp: '2026-04-20T18:00:00Z',
          level: 'ERROR',
          component: 'PBX',
          message: 'Registration failed',
          reason: 'Registration errors cluster here',
        },
      ],
      logSuggestions: [{ source: 'Datadog', reason: 'Pull the PBX service window' }],
      appliedTroubleshooting: 'Re-registered the extension',
      rawResponse: 'raw',
    };

    const logs: LogEntry[] = [
      {
        id: 7,
        timestamp: 1_745_174_400_000,
        rawTimestamp: '2026-04-20T18:00:00Z',
        level: 'ERROR',
        component: 'PBX',
        displayComponent: 'PBX',
        message: 'Registration failed',
        displayMessage: 'Registration failed',
        payload: '',
        type: 'LOG',
        isSip: false,
        fileName: 'pbx.log',
        lineNumber: 42,
        byteOffset: 1024,
      },
    ];

    const ticket: ZendeskTicket = {
      id: 45892,
      subject: 'Dropped call',
      description: 'Customer reports dropped calls',
      status: 'open',
      priority: null,
      requesterName: 'Taylor',
      requesterEmail: 'taylor@example.com',
      createdAt: '2026-04-20T17:00:00Z',
      tags: [],
      comments: [],
      requesterTimezone: null,
      orgId: 1,
      orgName: 'Acme PSAP',
      orgTimezone: null,
      attachments: [],
    };

    const investigation = buildCanonicalInvestigationPreview({
      diagnosisResult,
      logs,
      ticket,
      zendeskSubdomain: 'carbyne',
    });

    expect(buildZendeskTicketUrl('carbyne', 45892)).toBe(
      'https://carbyne.zendesk.com/agent/tickets/45892'
    );
    expect(investigation.ticketUrl).toBe('https://carbyne.zendesk.com/agent/tickets/45892');
    expect(Object.values(investigation.citations)).toHaveLength(1);
    expect(investigation.blocks.map((block) => block.kind)).toEqual(['context', 'collection', 'action']);
  });
});
