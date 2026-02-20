/**
 * Log Context Builder Service
 * 
 * Purpose:
 * Prepares log data for sending to LLM by formatting, optimizing, and prioritizing logs.
 * This service transforms raw LogEntry arrays into structured markdown context that
 * maximizes AI response quality while respecting token limits.
 * 
 * Architecture Decision:
 * Separate context builder from LLM service to:
 * - Enable reuse across different AI queries
 * - Test context building logic in isolation
 * - Easier to optimize and refine context strategies
 * - Clear separation of concerns (data prep vs API calls)
 * 
 * Key Features:
 * - Prioritizes ERROR and WARN logs (most relevant for troubleshooting)
 * - Includes temporal context (logs before/after errors)
 * - Truncates long payloads intelligently
 * - Removes duplicate messages
 * - Formats for LLM readability (structured markdown)
 * - Token estimation and optimization
 * 
 * Dependencies:
 * - LogEntry type from src/types.ts
 * - ContextOptions from src/types/ai.ts
 * 
 * @module services/logContextBuilder
 */

import type { LogEntry } from '../types';
import type { ContextOptions } from '../types/ai';

/**
 * Log Context Builder
 * 
 * Why separate context builder?
 * - Separates data preparation from API calls
 * - Reusable across different AI queries
 * - Testable in isolation
 * - Easier to optimize and refine
 */
export class LogContextBuilder {
  /**
   * Build optimized context from logs
   * 
   * Strategy:
   * 1. Prioritize errors (most relevant for troubleshooting)
   * 2. Add surrounding context (understand what led to errors)
   * 3. Include correlations (related logs across files/components)
   * 4. Format for LLM (structured, readable markdown)
   * 
   * Why this approach?
   * - Focuses AI attention on actionable issues
   * - Provides causal context without overwhelming with data
   * - Respects token limits while maximizing information density
   * 
   * @param logs - Pre-filtered logs to analyze
   * @param options - Context options (focus log, max tokens, etc.)
   * @returns Formatted markdown context ready for LLM
   */
  public buildContext(logs: LogEntry[], options: ContextOptions = {}): string {
    if (logs.length === 0) {
      return 'No logs available for analysis.';
    }
    
    const {
      focusLogId,
      maxTokens = 100000,
      includeSurrounding = 5,
      prioritizeErrors = true,
      includePayloads = true,
    } = options;
    
    // If focusing on specific log, build context around it
    if (focusLogId !== undefined) {
      return this.buildFocusedContext(logs, focusLogId, includeSurrounding, includePayloads, maxTokens);
    }
    
    // Otherwise, build optimized context from all logs
    let selectedLogs: LogEntry[];
    
    if (prioritizeErrors) {
      // Prioritize ERROR and WARN logs, but include some INFO for context
      selectedLogs = this.prioritizeLogs(logs, maxTokens);
    } else {
      // Use all logs (up to token limit)
      selectedLogs = this.selectLogsByTokenLimit(logs, maxTokens, includePayloads);
    }
    
    // Remove duplicates
    selectedLogs = this.removeDuplicates(selectedLogs);
    
    // Format as markdown
    return this.formatLogsAsMarkdown(selectedLogs, includePayloads);
  }
  
  /**
   * Build context focused on specific log
   * 
   * Why: Users often want to understand a specific error in detail
   * Including surrounding logs provides temporal context
   * 
   * @param logs - All available logs
   * @param focusLogId - ID of log to focus on
   * @param surrounding - Number of logs before/after to include
   * @param includePayloads - Whether to include log payloads
   * @param maxTokens - Maximum tokens to use
   * @returns Formatted context
   */
  private buildFocusedContext(
    logs: LogEntry[],
    focusLogId: number,
    surrounding: number,
    includePayloads: boolean,
    maxTokens: number
  ): string {
    const focusIndex = logs.findIndex(log => log.id === focusLogId);
    
    if (focusIndex === -1) {
      return `Log #${focusLogId} not found in selected logs.`;
    }
    
    // Get surrounding logs
    const startIndex = Math.max(0, focusIndex - surrounding);
    const endIndex = Math.min(logs.length, focusIndex + surrounding + 1);
    const contextLogs = logs.slice(startIndex, endIndex);
    
    // Select logs within token limit
    const selectedLogs = this.selectLogsByTokenLimit(contextLogs, maxTokens, includePayloads);
    
    return this.formatLogsAsMarkdown(selectedLogs, includePayloads, focusLogId);
  }
  
  /**
   * Prioritize logs by level (ERROR > WARN > INFO > DEBUG)
   * 
   * Why: Errors are most relevant for troubleshooting
   * Including some INFO logs provides context without overwhelming
   * 
   * Strategy:
   * - Include all ERROR logs
   * - Include all WARN logs
   * - Include up to 20% INFO logs (for context)
   * - Exclude DEBUG logs (too verbose)
   * 
   * @param logs - All logs
   * @param maxTokens - Maximum tokens to use
   * @returns Prioritized log subset
   */
  private prioritizeLogs(logs: LogEntry[], maxTokens: number): LogEntry[] {
    const errors: LogEntry[] = [];
    const warnings: LogEntry[] = [];
    const info: LogEntry[] = [];
    
    // Categorize logs
    for (const log of logs) {
      if (log.level === 'ERROR') {
        errors.push(log);
      } else if (log.level === 'WARN') {
        warnings.push(log);
      } else if (log.level === 'INFO') {
        info.push(log);
      }
      // Skip DEBUG logs (too verbose for AI analysis)
    }
    
    // Start with errors and warnings
    let selected: LogEntry[] = [...errors, ...warnings];
    
    // Add surrounding context for errors
    selected = this.addSurroundingContext(logs, selected, 5);
    
    // Add some INFO logs for context (up to 20% of remaining capacity)
    const remainingCapacity = maxTokens - this.estimateTokens(selected);
    const infoLimit = Math.floor(remainingCapacity * 0.2);
    const selectedInfo = this.selectLogsByTokenLimit(info, infoLimit, true);
    selected.push(...selectedInfo);
    
    // Trim to token limit
    return this.selectLogsByTokenLimit(selected, maxTokens, true);
  }
  
  /**
   * Add surrounding context for error logs
   * 
   * Why: Errors don't exist in isolation - understanding what happened before/after
   * helps AI identify root causes
   * 
   * @param allLogs - All available logs
   * @param errorLogs - Error logs to add context for
   * @param surrounding - Number of logs before/after each error
   * @returns Logs with surrounding context added
   */
  private addSurroundingContext(
    allLogs: LogEntry[],
    errorLogs: LogEntry[],
    surrounding: number
  ): LogEntry[] {
    const logMap = new Map<number, LogEntry>();
    
    // Add error logs
    for (const log of errorLogs) {
      logMap.set(log.id, log);
    }
    
    // Add surrounding logs for each error
    for (const errorLog of errorLogs) {
      const errorIndex = allLogs.findIndex(log => log.id === errorLog.id);
      if (errorIndex === -1) continue;
      
      const startIndex = Math.max(0, errorIndex - surrounding);
      const endIndex = Math.min(allLogs.length, errorIndex + surrounding + 1);
      
      for (let i = startIndex; i < endIndex; i++) {
        logMap.set(allLogs[i].id, allLogs[i]);
      }
    }
    
    // Sort by timestamp to maintain chronological order
    return Array.from(logMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Select logs within token limit
   * 
   * Why: Must respect API token limits to prevent request failures
   * 
   * Strategy:
   * - Estimate tokens for each log
   * - Add logs until approaching limit
   * - Leave 10% buffer for prompt overhead
   * 
   * @param logs - Logs to select from
   * @param maxTokens - Maximum tokens
   * @param includePayloads - Whether payloads are included (affects token count)
   * @returns Selected logs within token limit
   */
  private selectLogsByTokenLimit(
    logs: LogEntry[],
    maxTokens: number,
    includePayloads: boolean
  ): LogEntry[] {
    const selected: LogEntry[] = [];
    let currentTokens = 0;
    const buffer = maxTokens * 0.1; // 10% buffer for prompt overhead
    const targetTokens = maxTokens - buffer;
    
    for (const log of logs) {
      const logTokens = this.estimateLogTokens(log, includePayloads);
      
      if (currentTokens + logTokens > targetTokens) {
        break;
      }
      
      selected.push(log);
      currentTokens += logTokens;
    }
    
    return selected;
  }
  
  /**
   * Estimate tokens for a single log entry
   * 
   * Why: Need accurate token estimation to stay within limits
   * 
   * Estimation: 1 token ≈ 4 characters (rough approximation)
   * More accurate would require tokenizer, but this is sufficient for our needs
   * 
   * @param log - Log entry
   * @param includePayload - Whether to include payload in count
   * @returns Estimated token count
   */
  private estimateLogTokens(log: LogEntry, includePayload: boolean): number {
    let text = `${log.level} ${log.component} ${log.message}`;
    
    if (includePayload && log.payload) {
      // Truncate payload for estimation (we'll truncate properly later)
      text += ' ' + log.payload.substring(0, 200);
    }
    
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Estimate total tokens for log array
   * 
   * @param logs - Log entries
   * @returns Estimated token count
   */
  private estimateTokens(logs: LogEntry[]): number {
    return logs.reduce((sum, log) => sum + this.estimateLogTokens(log, true), 0);
  }
  
  /**
   * Remove duplicate log messages
   * 
   * Why: Duplicate logs add noise without value
   * Keep first occurrence and add count
   * 
   * @param logs - Logs to deduplicate
   * @returns Deduplicated logs with counts
   */
  private removeDuplicates(logs: LogEntry[]): LogEntry[] {
    const seen = new Map<string, { log: LogEntry; count: number }>();
    
    for (const log of logs) {
      // Create key from level, component, and message (ignore timestamp)
      const key = `${log.level}|${log.component}|${log.message}`;
      
      if (seen.has(key)) {
        seen.get(key)!.count++;
      } else {
        seen.set(key, { log, count: 1 });
      }
    }
    
    // Return logs with duplicate counts stored in a way we can use
    // Note: We'll add count to formatted output
    return Array.from(seen.values()).map(({ log, count }) => {
      // Store count in a way we can access during formatting
      // Using a custom property (we'll handle this in formatting)
      return { ...log, _duplicateCount: count > 1 ? count : undefined } as LogEntry & { _duplicateCount?: number };
    });
  }
  
  /**
   * Format logs as markdown for LLM
   * 
   * Why: Markdown formatting improves LLM comprehension
   * Structured format with clear sections and hierarchy
   * 
   * Format:
   * - Section headers for log groups
   * - Code blocks for log entries
   * - Clear timestamps and levels
   * - Truncated payloads for readability
   * 
   * @param logs - Logs to format
   * @param includePayloads - Whether to include payloads
   * @param focusLogId - Optional log ID to highlight
   * @returns Formatted markdown string
   */
  private formatLogsAsMarkdown(
    logs: LogEntry[],
    includePayloads: boolean,
    focusLogId?: number
  ): string {
    if (logs.length === 0) {
      return 'No logs to display.';
    }
    
    // Group logs by level for better organization
    const grouped = this.groupLogsByLevel(logs);
    
    let markdown = `# Log Analysis Context\n\n`;
    markdown += `Total logs: ${logs.length}\n`;
    markdown += `Time range: ${this.formatTimeRange(logs)}\n\n`;
    
    // Format each group
    if (grouped.ERROR.length > 0) {
      markdown += `## Errors (${grouped.ERROR.length})\n\n`;
      markdown += this.formatLogGroup(grouped.ERROR, includePayloads, focusLogId);
      markdown += '\n';
    }
    
    if (grouped.WARN.length > 0) {
      markdown += `## Warnings (${grouped.WARN.length})\n\n`;
      markdown += this.formatLogGroup(grouped.WARN, includePayloads, focusLogId);
      markdown += '\n';
    }
    
    if (grouped.INFO.length > 0) {
      markdown += `## Info Logs (${grouped.INFO.length})\n\n`;
      markdown += this.formatLogGroup(grouped.INFO, includePayloads, focusLogId);
      markdown += '\n';
    }
    
    if (grouped.DEBUG.length > 0) {
      markdown += `## Debug Logs (${grouped.DEBUG.length})\n\n`;
      markdown += this.formatLogGroup(grouped.DEBUG, includePayloads, focusLogId);
      markdown += '\n';
    }
    
    return markdown;
  }
  
  /**
   * Group logs by level
   * 
   * @param logs - Logs to group
   * @returns Grouped logs by level
   */
  private groupLogsByLevel(logs: LogEntry[]): Record<string, LogEntry[]> {
    const grouped: Record<string, LogEntry[]> = {
      ERROR: [],
      WARN: [],
      INFO: [],
      DEBUG: [],
    };
    
    for (const log of logs) {
      grouped[log.level]?.push(log);
    }
    
    return grouped;
  }
  
  /**
   * Format a group of logs
   * 
   * @param logs - Logs to format
   * @param includePayloads - Whether to include payloads
   * @param focusLogId - Optional log ID to highlight
   * @returns Formatted markdown string
   */
  private formatLogGroup(
    logs: LogEntry[],
    includePayloads: boolean,
    focusLogId?: number
  ): string {
    let markdown = '';
    
    for (const log of logs) {
      const isFocused = log.id === focusLogId;
      const duplicateCount = (log as any)._duplicateCount;
      
      markdown += `### [Log #${log.id}]${isFocused ? ' ⭐ FOCUS' : ''}${duplicateCount ? ` (×${duplicateCount})` : ''}\n\n`;
      markdown += `**Timestamp:** ${new Date(log.timestamp).toISOString()}\n`;
      markdown += `**Level:** ${log.level}\n`;
      markdown += `**Component:** ${log.component}\n`;
      markdown += `**Message:** ${log.message}\n`;
      
      if (includePayloads && log.payload) {
        const truncatedPayload = this.truncatePayload(log.payload);
        markdown += `**Payload:**\n\`\`\`\n${truncatedPayload}\n\`\`\`\n`;
      }
      
      // Add correlation fields if present
      const correlations: string[] = [];
      if (log.callId) correlations.push(`Call-ID: ${log.callId}`);
      if (log.reportId) correlations.push(`Report-ID: ${log.reportId}`);
      if (log.operatorId) correlations.push(`Operator-ID: ${log.operatorId}`);
      if (log.extensionId) correlations.push(`Extension-ID: ${log.extensionId}`);
      if (log.stationId) correlations.push(`Station-ID: ${log.stationId}`);
      
      if (correlations.length > 0) {
        markdown += `**Correlations:** ${correlations.join(', ')}\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }
  
  /**
   * Truncate long payloads intelligently
   * 
   * Why: Long payloads consume tokens without proportional value
   * Keep first and last portions to preserve structure
   * 
   * Strategy:
   * - If payload < 400 chars: keep as-is
   * - Otherwise: keep first 200 chars + "..." + last 200 chars
   * 
   * @param payload - Payload to truncate
   * @returns Truncated payload
   */
  private truncatePayload(payload: string): string {
    const maxLength = 400;
    
    if (payload.length <= maxLength) {
      return payload;
    }
    
    const start = payload.substring(0, 200);
    const end = payload.substring(payload.length - 200);
    return `${start}\n... [truncated ${payload.length - 400} characters] ...\n${end}`;
  }
  
  /**
   * Format time range for logs
   * 
   * @param logs - Logs to get time range from
   * @returns Formatted time range string
   */
  private formatTimeRange(logs: LogEntry[]): string {
    if (logs.length === 0) {
      return 'N/A';
    }
    
    const timestamps = logs.map(log => log.timestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    
    return `${new Date(min).toISOString()} to ${new Date(max).toISOString()}`;
  }
  
  /**
   * Generate statistical summary of logs
   * 
   * Why: Provides high-level overview for AI context
   * Helps AI understand log distribution and patterns
   * 
   * @param logs - Logs to summarize
   * @returns Summary markdown string
   */
  public generateSummary(logs: LogEntry[]): string {
    if (logs.length === 0) {
      return 'No logs to summarize.';
    }
    
    const counts = {
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
    };
    
    const components = new Set<string>();
    const sipLogs = logs.filter(log => log.isSip).length;
    
    for (const log of logs) {
      counts[log.level]++;
      components.add(log.component);
    }
    
    let summary = `# Log Summary\n\n`;
    summary += `**Total Logs:** ${logs.length}\n`;
    summary += `**Time Range:** ${this.formatTimeRange(logs)}\n`;
    summary += `**Log Levels:** ERROR: ${counts.ERROR}, WARN: ${counts.WARN}, INFO: ${counts.INFO}, DEBUG: ${counts.DEBUG}\n`;
    summary += `**Unique Components:** ${components.size}\n`;
    summary += `**SIP Logs:** ${sipLogs} (${Math.round((sipLogs / logs.length) * 100)}%)\n`;
    
    return summary;
  }
}

/**
 * Export singleton instance
 * 
 * Why: Provides convenient access without importing class
 */
export const logContextBuilder = new LogContextBuilder();
