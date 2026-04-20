/**
 * Prompt and AI Analysis Type Definitions
 *
 * Purpose:
 * Consolidates types related to prompt templates, analysis context, and AI-specific
 * data structures that drive log analysis and conversation flows.
 *
 * @module types/prompts
 */

import type { LogEntry } from './index';

// ─── Analysis Context ────────────────────────────────────────────────────────

export interface AnalysisContext {
  /** Time range of logs being analyzed */
  timeRange: { start: string; end: string } | null;
  /** Total number of logs being analyzed */
  logCount: number;
  /** Count of ERROR-level logs */
  errorCount: number;
  /** Count of WARN-level logs */
  warningCount: number;
  /** Unique components/services in the log set */
  components: string[];
  /** Aggregated correlation IDs found in logs */
  correlations: {
    callIds: string[];
    reportIds: string[];
    operatorIds: string[];
    cncIds: string[];
    messageIds: string[];
  };
}

// ─── Prompt Template Types ──────────────────────────────────────────────────

export type PromptTemplateType =
  | 'ERROR_ANALYSIS'
  | 'PATTERN_RECOGNITION'
  | 'CALL_FLOW_ANALYSIS'
  | 'TIMELINE_ANALYSIS'
  | 'CORRELATION_ANALYSIS'
  | 'GENERAL_QUERY';

/**
 * Metadata about a specific prompt template.
 * Used for template selection and validation.
 */
export interface PromptTemplateMetadata {
  id: PromptTemplateType;
  name: string;
  description: string;
  minLogs?: number;
  maxLogs?: number;
  requiresErrors?: boolean;
}

// ─── Chat Message (consolidated from unleashService) ──────────────────────────

export interface ChatMessage {
  role: 'User' | 'Assistant';
  text: string;
}
