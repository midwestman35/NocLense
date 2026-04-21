import {
  buildInvestigationFromResponse,
  validateUnleashResponse,
  type DiagnoseStage,
  type ResolvedLogLocator,
} from '../../../services/canonicalAdapter';
import type { ZendeskTicket } from '../../../services/zendeskService';
import type { LogEntry } from '../../../types';
import type { Investigation } from '../../../types/canonical';
import type { DiagnosisResult } from '../../../types/diagnosis';

type Phase = 1 | 2 | 3;

export type DiagnosePipelineStage = DiagnoseStage;

export interface StageDefinition {
  id: DiagnosePipelineStage;
  label: string;
  description: string;
}

export interface DiagnosePipelineProgress {
  activeStage: DiagnosePipelineStage | null;
  completedStages: DiagnosePipelineStage[];
}

export interface CanonicalPreviewInput {
  diagnosisResult: DiagnosisResult;
  logs: LogEntry[];
  ticket: ZendeskTicket | null;
  zendeskSubdomain?: string;
}

export const DIAGNOSE_PIPELINE_UI_FLAG = 'noclense.diagnose.pipeline-ui';

export const DIAGNOSE_PIPELINE_STAGES: StageDefinition[] = [
  { id: 'ingest', label: 'Ingest', description: 'Resolve ticket and investigation context' },
  { id: 'pattern', label: 'Pattern', description: 'Search adjacent systems for prior art' },
  { id: 'hypothesize', label: 'Hypothesize', description: 'Rank likely explanations' },
  { id: 'collect', label: 'Collect', description: 'Gather evidence to confirm or rule out' },
  { id: 'analyze', label: 'Analyze', description: 'Assess logs against the working theory' },
  { id: 'act', label: 'Act', description: 'Prepare the handoff or next action' },
];

const PIPELINE_STAGE_ORDER: DiagnosePipelineStage[] = [
  'ingest',
  'pattern',
  'hypothesize',
  'collect',
  'analyze',
  'act',
];

export function readDiagnosePipelineFlag(storage?: Pick<Storage, 'getItem'> | null): boolean {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStorage) {
    return false;
  }

  try {
    return targetStorage.getItem(DIAGNOSE_PIPELINE_UI_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function getDiagnosePipelineProgress(
  phase: Phase,
  scanning: boolean,
  scanStatus: string
): DiagnosePipelineProgress {
  if (scanning) {
    const normalizedStatus = scanStatus.toLowerCase();

    if (normalizedStatus.includes('attachment')) {
      return { activeStage: 'ingest', completedStages: [] };
    }

    if (normalizedStatus.includes('datadog')) {
      return { activeStage: 'pattern', completedStages: ['ingest'] };
    }

    return { activeStage: 'hypothesize', completedStages: ['ingest', 'pattern'] };
  }

  if (phase === 2) {
    return {
      activeStage: 'analyze',
      completedStages: PIPELINE_STAGE_ORDER.slice(0, 4),
    };
  }

  if (phase === 3) {
    return {
      activeStage: 'act',
      completedStages: PIPELINE_STAGE_ORDER.slice(0, 5),
    };
  }

  return { activeStage: null, completedStages: [] };
}

export function buildZendeskTicketUrl(
  zendeskSubdomain: string | undefined,
  ticketId: number | undefined
): string | undefined {
  if (!zendeskSubdomain || ticketId == null) {
    return undefined;
  }

  return `https://${zendeskSubdomain}.zendesk.com/agent/tickets/${ticketId}`;
}

/**
 * Feature-flagged proof-of-life bridge for 01b.2.
 * This keeps the adapter wiring pure and directly testable while the
 * renderer is still a JSON preview.
 */
export function buildCanonicalInvestigationPreview({
  diagnosisResult,
  logs,
  ticket,
  zendeskSubdomain,
}: CanonicalPreviewInput): Investigation {
  const response = validateUnleashResponse(diagnosisResult);
  const logLookup = new Map(logs.map((log) => [log.id, log]));

  return buildInvestigationFromResponse({
    response,
    ticketUrl: buildZendeskTicketUrl(zendeskSubdomain, ticket?.id),
    customer: ticket?.orgName ?? ticket?.requesterName ?? undefined,
    resolveLogLocator: (logId: number): ResolvedLogLocator | null => {
      const log = logLookup.get(logId);
      if (!log?.fileName || log.lineNumber == null || log.byteOffset == null) {
        return null;
      }

      return {
        fileName: log.fileName,
        lineNumber: log.lineNumber,
        byteOffset: log.byteOffset,
      };
    },
  });
}
