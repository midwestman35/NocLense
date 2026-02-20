/**
 * Unit Tests for Prompt Templates Service
 *
 * Purpose:
 * Ensure prompt template selection and generated prompt structure remain stable.
 *
 * @module services/__tests__/promptTemplates.test
 */

import { describe, it, expect } from 'vitest';
import type { LogEntry } from '../../types';
import {
  buildAnalysisContext,
  inferTemplateType,
  buildPromptFromTemplate,
} from '../promptTemplates';

function mockLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: overrides.id ?? 1,
    timestamp: overrides.timestamp ?? Date.now(),
    rawTimestamp: overrides.rawTimestamp ?? new Date().toISOString(),
    level: overrides.level ?? 'INFO',
    component: overrides.component ?? 'TestService',
    displayComponent: overrides.displayComponent ?? 'TestService',
    message: overrides.message ?? 'test message',
    displayMessage: overrides.displayMessage ?? 'test message',
    payload: overrides.payload ?? '',
    type: overrides.type ?? 'LOG',
    isSip: overrides.isSip ?? false,
    ...overrides,
  };
}

describe('promptTemplates', () => {
  it('buildAnalysisContext returns counts and correlations', () => {
    const logs = [
      mockLog({ id: 1, level: 'ERROR', callId: 'c-1', displayComponent: 'CCS' }),
      mockLog({ id: 2, level: 'WARN', reportId: 'r-1', displayComponent: 'FDX' }),
      mockLog({ id: 3, level: 'INFO', cncID: 'cnc-1', messageID: 'm-1' }),
    ];

    const context = buildAnalysisContext(logs);
    expect(context.logCount).toBe(3);
    expect(context.errorCount).toBe(1);
    expect(context.warningCount).toBe(1);
    expect(context.components.length).toBeGreaterThanOrEqual(2);
    expect(context.correlations.callIds).toContain('c-1');
    expect(context.correlations.reportIds).toContain('r-1');
  });

  it('inferTemplateType picks call flow when sip evidence exists', () => {
    const logs = [mockLog({ isSip: true, callId: 'abc' })];
    expect(inferTemplateType('help me understand this call', logs)).toBe('CALL_FLOW_ANALYSIS');
  });

  it('inferTemplateType picks error analysis for error intent', () => {
    const logs = [mockLog({ level: 'ERROR' })];
    expect(inferTemplateType('why did this fail?', logs)).toBe('ERROR_ANALYSIS');
  });

  it('buildPromptFromTemplate includes constraints and user question', () => {
    const logs = [mockLog({ level: 'ERROR' })];
    const prompt = buildPromptFromTemplate('summarize this incident', logs);

    expect(prompt).toContain('CONTEXT:');
    expect(prompt).toContain('CONSTRAINTS:');
    expect(prompt).toContain('USER QUESTION: summarize this incident');
  });
});

