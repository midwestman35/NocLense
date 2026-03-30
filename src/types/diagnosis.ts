export type IncidentPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type PositionAffected = 'Single Station' | 'Several Stations' | 'Entire PSAP';

export interface AiCorrelatedLog {
  /** LogEntry.id — stable across filter changes */
  logId: number;
  /** 1-based index used in the diagnosis prompt */
  index: number;
  rawTimestamp: string;
  level: string;
  component: string;
  message: string;
  /** AI explanation for why this log is relevant */
  reason: string;
}

export interface LogSuggestion {
  /** e.g. "Datadog", "HOMER", "CCS AWS", "PC logs", "Firewall" */
  source: string;
  reason: string;
  /** Optional search query or filter hint */
  query?: string;
}

export interface DiagnosisResult {
  summary: string;
  rootCause: string;
  correlatedLogs: AiCorrelatedLog[];
  logSuggestions: LogSuggestion[];
  appliedTroubleshooting: string;
  rawResponse: string;
}

export interface JiraTicketDraft {
  faultDescription: string;
  priority: IncidentPriority;
  failureTimeFrame: string;
  positionAffected: PositionAffected;
  evidence: string;
  appliedTroubleshooting: string;
}
