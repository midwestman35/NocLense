/**
 * Prompt Templates Service
 *
 * Centralizes prompt engineering for consistent, actionable AI responses.
 * Separation from UI/API logic allows evolution of prompt quality independently.
 *
 * @module services/promptTemplates
 */

import type { LogEntry } from '../types';

export interface AnalysisContext {
  timeRange: { start: string; end: string } | null;
  logCount: number;
  errorCount: number;
  warningCount: number;
  components: string[];
  correlations: {
    callIds: string[];
    reportIds: string[];
    operatorIds: string[];
    cncIds: string[];
    messageIds: string[];
  };
}

export type PromptTemplateType =
  | 'ERROR_ANALYSIS'
  | 'PATTERN_RECOGNITION'
  | 'CALL_FLOW_ANALYSIS'
  | 'TIMELINE_ANALYSIS'
  | 'CORRELATION_ANALYSIS'
  | 'GENERAL_QUERY';

/**
 * Build analysis metadata from logs to improve LLM response quality via structured context.
 */
export function buildAnalysisContext(logs: LogEntry[]): AnalysisContext {
  if (logs.length === 0) {
    return {
      timeRange: null,
      logCount: 0,
      errorCount: 0,
      warningCount: 0,
      components: [],
      correlations: {
        callIds: [],
        reportIds: [],
        operatorIds: [],
        cncIds: [],
        messageIds: [],
      },
    };
  }

  const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const start = new Date(sorted[0].timestamp).toISOString();
  const end = new Date(sorted[sorted.length - 1].timestamp).toISOString();
  const errorCount = logs.filter((l) => l.level === 'ERROR').length;
  const warningCount = logs.filter((l) => l.level === 'WARN').length;

  return {
    timeRange: { start, end },
    logCount: logs.length,
    errorCount,
    warningCount,
    components: Array.from(new Set(logs.map((l) => l.displayComponent || l.component))).slice(0, 20),
    correlations: {
      callIds: Array.from(new Set(logs.map((l) => l.callId).filter(Boolean) as string[])).slice(0, 10),
      reportIds: Array.from(new Set(logs.map((l) => l.reportId).filter(Boolean) as string[])).slice(0, 10),
      operatorIds: Array.from(new Set(logs.map((l) => l.operatorId).filter(Boolean) as string[])).slice(0, 10),
      cncIds: Array.from(new Set(logs.map((l) => l.cncID).filter(Boolean) as string[])).slice(0, 10),
      messageIds: Array.from(new Set(logs.map((l) => l.messageID).filter(Boolean) as string[])).slice(0, 10),
    },
  };
}

function commonContextBlock(context: AnalysisContext): string {
  const timeRange = context.timeRange
    ? `${context.timeRange.start} to ${context.timeRange.end}`
    : 'Not available';

  // When no errors present, guide AI toward patterns/insights rather than failure analysis
  const noErrorsNote =
    context.errorCount === 0 && context.warningCount === 0 && context.logCount > 0
      ? '\nNOTE: These logs contain no ERROR or WARN entries. Focus on patterns, trends, and operational insights rather than failure analysis.'
      : '';

  // Phase 6.2: Very short logs - analysis may be limited; proceed anyway (don't block)
  const shortLogsNote =
    context.logCount > 0 && context.logCount < 10
      ? '\nNOTE: Few logs provided. Analysis may be limited; work with what is available.'
      : '';

  return [
    'CONTEXT:',
    `- System: NocLense (telecommunications / VoIP log analyzer)`,
    `- Time Range: ${timeRange}`,
    `- Total Logs: ${context.logCount}`,
    `- Error Logs: ${context.errorCount}`,
    `- Warning Logs: ${context.warningCount}`,
    `- Components: ${context.components.join(', ') || 'Unknown'}`,
    `- Correlations: callId(${context.correlations.callIds.length}), reportId(${context.correlations.reportIds.length}), operatorId(${context.correlations.operatorIds.length}), cncID(${context.correlations.cncIds.length}), messageID(${context.correlations.messageIds.length})`,
    noErrorsNote,
    shortLogsNote,
  ].join('\n');
}

function outputConstraintsBlock(): string {
  return [
    'CONSTRAINTS:',
    '- Be concise and actionable.',
    '- Reference specific log IDs using [Log #123] when possible.',
    '- If evidence is weak, state assumptions explicitly.',
    '- Prefer root-cause reasoning over generic advice.',
  ].join('\n');
}

export function errorAnalysisTemplate(userQuery: string, context: AnalysisContext): string {
  return [
    'You are a telecommunications and VoIP log analysis expert.',
    commonContextBlock(context),
    '',
    'TASK:',
    '- Identify primary failure signals and likely root cause.',
    '- Explain sequence of events that led to errors.',
    '- Provide prioritized remediation steps.',
    '',
    'OUTPUT FORMAT:',
    '1) Error Summary',
    '2) Root Cause',
    '3) Impact',
    '4) Recommended Actions',
    '',
    outputConstraintsBlock(),
    '',
    `USER QUESTION: ${userQuery}`,
  ].join('\n');
}

export function patternRecognitionTemplate(userQuery: string, context: AnalysisContext): string {
  return [
    'You are a telecom reliability analyst focused on recurring operational patterns.',
    commonContextBlock(context),
    '',
    'TASK:',
    '- Identify repeated signatures, bursts, and anomaly windows.',
    '- Group likely duplicates and distinguish symptom vs cause.',
    '- Suggest monitoring or alert rules to detect recurrence earlier.',
    '',
    outputConstraintsBlock(),
    '',
    `USER QUESTION: ${userQuery}`,
  ].join('\n');
}

export function callFlowAnalysisTemplate(userQuery: string, context: AnalysisContext): string {
  return [
    'You are a SIP/VoIP call flow troubleshooting expert.',
    commonContextBlock(context),
    '',
    'TASK:',
    '- Focus on SIP signaling outcomes and failure transitions.',
    '- Explain probable call path issues (auth, routing, timeout, media setup).',
    '- Point out missing or suspicious signaling evidence.',
    '',
    outputConstraintsBlock(),
    '',
    `USER QUESTION: ${userQuery}`,
  ].join('\n');
}

export function timelineAnalysisTemplate(userQuery: string, context: AnalysisContext): string {
  return [
    'You are a timeline-based incident investigator for telecom systems.',
    commonContextBlock(context),
    '',
    'TASK:',
    '- Build an event timeline highlighting turning points.',
    '- Mark pre-failure indicators and post-failure effects.',
    '- Explain what happened first, next, and why it matters.',
    '',
    outputConstraintsBlock(),
    '',
    `USER QUESTION: ${userQuery}`,
  ].join('\n');
}

export function correlationAnalysisTemplate(userQuery: string, context: AnalysisContext): string {
  return [
    'You are an expert in cross-system correlation analysis for telecom logs.',
    commonContextBlock(context),
    '',
    'TASK:',
    '- Use correlation IDs (callId, reportId, operatorId, cncID, messageID) to connect events.',
    '- Explain relationships across components and identify likely propagation chains.',
    '- Separate causal links from coincidental co-occurrence.',
    '',
    outputConstraintsBlock(),
    '',
    `USER QUESTION: ${userQuery}`,
  ].join('\n');
}

export function generalQueryTemplate(userQuery: string, context: AnalysisContext): string {
  return [
    'You are a telecommunications log analysis assistant.',
    commonContextBlock(context),
    '',
    'TASK:',
    '- Answer the user question using available log evidence.',
    '- Keep analysis structured and practical for incident response.',
    '',
    outputConstraintsBlock(),
    '',
    `USER QUESTION: ${userQuery}`,
  ].join('\n');
}

/**
 * Selects the best template for a user query.
 *
 * Why:
 * A lightweight heuristic keeps UX simple while still improving prompt quality.
 */
export function inferTemplateType(userQuery: string, logs: LogEntry[]): PromptTemplateType {
  const q = userQuery.toLowerCase();
  const hasSip = logs.some((l) => l.isSip || !!l.callId || !!l.sipMethod);
  const hasCorrelations = logs.some((l) => l.callId || l.reportId || l.cncID || l.messageID);

  if (q.includes('timeline') || q.includes('what happened') || q.includes('sequence')) {
    return 'TIMELINE_ANALYSIS';
  }
  if (q.includes('pattern') || q.includes('recurring') || q.includes('repeat')) {
    return 'PATTERN_RECOGNITION';
  }
  if (q.includes('call') || q.includes('sip') || q.includes('invite') || hasSip) {
    return 'CALL_FLOW_ANALYSIS';
  }
  if (q.includes('correlation') || q.includes('related') || q.includes('linked') || hasCorrelations) {
    return 'CORRELATION_ANALYSIS';
  }
  if (q.includes('error') || q.includes('fail') || q.includes('root cause') || q.includes('why')) {
    return 'ERROR_ANALYSIS';
  }
  return 'GENERAL_QUERY';
}

/**
 * Main entrypoint used by context/service layers.
 */
export function buildPromptFromTemplate(userQuery: string, logs: LogEntry[]): string {
  const context = buildAnalysisContext(logs);
  const template = inferTemplateType(userQuery, logs);

  switch (template) {
    case 'ERROR_ANALYSIS':
      return errorAnalysisTemplate(userQuery, context);
    case 'PATTERN_RECOGNITION':
      return patternRecognitionTemplate(userQuery, context);
    case 'CALL_FLOW_ANALYSIS':
      return callFlowAnalysisTemplate(userQuery, context);
    case 'TIMELINE_ANALYSIS':
      return timelineAnalysisTemplate(userQuery, context);
    case 'CORRELATION_ANALYSIS':
      return correlationAnalysisTemplate(userQuery, context);
    case 'GENERAL_QUERY':
    default:
      return generalQueryTemplate(userQuery, context);
  }
}

