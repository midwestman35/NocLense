/**
 * Log Context Builder Service
 *
 * Prepares log data for LLM consumption by formatting, optimizing, and prioritizing.
 * Separated from LLM service for reusability, testability, and clear separation of concerns.
 *
 * @module services/logContextBuilder
 */

import type { LogEntry } from '../types';
import type { ContextOptions } from '../types/ai';

export class LogContextBuilder {
  public readonly HIERARCHICAL_THRESHOLD = 5000;
  private static readonly SIP_FAILURE_SIGNALS = new Set([
    // SIP 4xx client errors
    '400', '401', '403', '404', '408', '480', '481', '482', '483', '484', '485',
    '486', '487', '488', '491', '493',
    // SIP 5xx server errors
    '500', '502', '503', '504', '513',
    // SIP 6xx global failures
    '600', '603', '604', '606',
    // SIP methods (high value for call-flow debugging)
    'invite', 'bye', 'cancel', 'register', 'options', 'refer', 'notify', 'subscribe',
    // Connection/transport failure terms
    'timeout', 'timed out', 'unreachable', 'refused', 'failed', 'failure', 'rejected',
    'unavailable', 'not found', 'forbidden', 'unauthorized',
    // Media/RTP terms
    'sdp', 'rtp', 'codec', 'media', 'ice', 'stun', 'turn',
    // VoIP-specific operational terms
    'registration', 'auth', 'authentication', 'dialog', 'transaction',
  ]);

  private static readonly KEY_SIP_HEADERS = [
    'SIP/2.0',
    'INVITE',
    'BYE',
    'CANCEL',
    'REGISTER',
    'OPTIONS',
    'REFER',
    'NOTIFY',
    'Call-ID',
    'CSeq',
    'From',
    'To',
    'Via',
    'Contact',
    'Authorization',
    'WWW-Authenticate',
    'Reason',
    'Warning',
    'Content-Type',
    'Content-Length',
  ];

  /**
   * Build optimized context from logs, prioritizing errors and respecting token limits.
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
      selectedLogs = this.prioritizeLogs(logs, maxTokens);
    } else {
      selectedLogs = this.selectLogsByTokenLimit(logs, maxTokens, includePayloads);
    }

    selectedLogs = this.removeDuplicates(selectedLogs);
    return this.formatLogsAsMarkdown(selectedLogs, includePayloads);
  }

  /**
   * Split logs into time-window chunks for hierarchical multi-pass analysis.
   * Preserves coverage on large log sets while keeping each call within token limits.
   *
   * @param logs - Full log set
   * @param options - Context construction options
   * @returns Ordered context chunks by time window
   */
  public buildHierarchicalContext(
    logs: LogEntry[],
    options: ContextOptions = {}
  ): Array<{ timeWindow: string; context: string }> {
    if (logs.length === 0) {
      return [];
    }

    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    const windowMs = 15 * 60 * 1000; // 15-minute windows
    const minTs = sortedLogs[0].timestamp;
    const maxTs = sortedLogs[sortedLogs.length - 1].timestamp;
    const chunks: Array<{ timeWindow: string; context: string }> = [];

    for (let windowStart = minTs; windowStart <= maxTs; windowStart += windowMs) {
      const windowEnd = windowStart + windowMs;
      const windowLogs = sortedLogs.filter(
        log => log.timestamp >= windowStart && log.timestamp < windowEnd
      );
      if (windowLogs.length === 0) {
        continue;
      }

      const startStr = new Date(windowStart).toISOString();
      const endStr = new Date(Math.min(windowEnd, maxTs)).toISOString();
      const context = this.buildContext(windowLogs, {
        ...options,
        maxTokens: Math.floor((options.maxTokens ?? 100000) / 4),
      });
      chunks.push({ timeWindow: `${startStr} -> ${endStr}`, context });
    }

    return chunks;
  }
  
  /**
   * Build context focused on a specific log with temporal context from surrounding logs.
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

    const startIndex = Math.max(0, focusIndex - surrounding);
    const endIndex = Math.min(logs.length, focusIndex + surrounding + 1);
    const contextLogs = logs.slice(startIndex, endIndex);

    const selectedLogs = this.selectLogsByTokenLimit(contextLogs, maxTokens, includePayloads);
    return this.formatLogsAsMarkdown(selectedLogs, includePayloads, focusLogId);
  }
  
  /**
   * Prioritize logs by level: ERROR > WARN > INFO (20% of capacity) > DEBUG (excluded).
   *
   * @param logs - All logs
   * @param maxTokens - Maximum tokens to use
   * @returns Prioritized log subset
   */
  private prioritizeLogs(logs: LogEntry[], maxTokens: number): LogEntry[] {
    const errors: LogEntry[] = [];
    const sipSignalWarnings: LogEntry[] = [];
    const warnings: LogEntry[] = [];
    const info: LogEntry[] = [];
    
    // Categorize logs
    for (const log of logs) {
      if (log.level === 'ERROR') {
        errors.push(log);
      } else if (log.level === 'WARN') {
        if (this.hasSipFailureSignal(log)) {
          sipSignalWarnings.push(log);
        } else {
          warnings.push(log);
        }
      } else if (log.level === 'INFO') {
        if (this.hasSipFailureSignal(log)) {
          sipSignalWarnings.push(log);
        } else {
          info.push(log);
        }
      }
      // Skip DEBUG logs (too verbose for AI analysis)
    }
    
    let selected: LogEntry[] = [...errors, ...sipSignalWarnings, ...warnings];
    selected = this.addSurroundingContext(logs, selected, 5);

    const remainingCapacity = maxTokens - this.estimateTokens(selected);
    const infoLimit = Math.floor(remainingCapacity * 0.2);
    const selectedInfo = this.selectLogsByTokenLimit(info, infoLimit, true);
    selected.push(...selectedInfo);

    return this.selectLogsByTokenLimit(selected, maxTokens, true);
  }

  /**
   * Detect SIP/VoIP failure signals in log text for prioritization.
   * SIP-relevant WARN/INFO logs are often more diagnostic than generic warnings.
   *
   * @param log - Log entry to inspect
   * @returns True if the log includes SIP failure indicators
   */
  private hasSipFailureSignal(log: LogEntry): boolean {
    const text = `${log.message} ${log.component ?? ''}`.toLowerCase();
    for (const signal of LogContextBuilder.SIP_FAILURE_SIGNALS) {
      if (text.includes(signal)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Expand error logs with N surrounding logs before/after to provide causal context.
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

    for (const log of errorLogs) {
      logMap.set(log.id, log);
    }

    for (const errorLog of errorLogs) {
      const errorIndex = allLogs.findIndex(log => log.id === errorLog.id);
      if (errorIndex === -1) continue;

      const startIndex = Math.max(0, errorIndex - surrounding);
      const endIndex = Math.min(allLogs.length, errorIndex + surrounding + 1);

      for (let i = startIndex; i < endIndex; i++) {
        logMap.set(allLogs[i].id, allLogs[i]);
      }
    }

    return Array.from(logMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Select logs up to token limit (with 10% buffer for prompt overhead).
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
    const buffer = maxTokens * 0.1;
    const targetTokens = maxTokens - buffer;

    for (const log of logs) {
      const logTokens = this.estimateLogTokens(log, includePayloads);
      if (currentTokens + logTokens > targetTokens) break;
      selected.push(log);
      currentTokens += logTokens;
    }
    
    return selected;
  }
  
  /**
   * Estimate tokens for a single log entry (1 token ≈ 4 characters).
   * Approximation is sufficient; a full tokenizer would add complexity with minimal gain.
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
   * Estimate total tokens for log array.
   *
   * @param logs - Log entries
   * @returns Estimated token count
   */
  private estimateTokens(logs: LogEntry[]): number {
    return logs.reduce((sum, log) => sum + this.estimateLogTokens(log, true), 0);
  }
  
  /**
   * Remove duplicate log messages, keeping first occurrence with count.
   *
   * @param logs - Logs to deduplicate
   * @returns Deduplicated logs with counts
   */
  private removeDuplicates(logs: LogEntry[]): LogEntry[] {
    const seen = new Map<string, { log: LogEntry; count: number }>();
    
    for (const log of logs) {
      // Normalize variable fields so semantically identical messages dedupe together.
      const normalizedMessage = this.normalizeMessageForDedup(log.message);
      const key = `${log.level}|${log.component}|${normalizedMessage}`;
      
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
   * Normalize variable values in messages for template-style deduplication.
   *
   * Why: SIP errors frequently differ only by endpoint/IDs/timestamps, which
   * should not prevent duplicate collapsing.
   *
   * @param message - Raw log message
   * @returns Normalized message suitable for deduplication keying
   */
  private normalizeMessageForDedup(message: string): string {
    return message
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?\b/g, '<ADDR>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
      .replace(/z9hG4bK[a-zA-Z0-9]+/g, '<BRANCH>')
      .replace(/\b\d{5,}\b/g, '<NUM>')
      .replace(/\b[0-9a-f]{4,16}\b/gi, '<HEX>');
  }
  
  /**
   * Format logs as markdown with sections grouped by level for LLM consumption.
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
   * Group logs by level for organization in markdown output.
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
   * Format a group of logs as markdown with metadata and optional payload.
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
   * Intelligently truncate payloads: full text if < 400 chars, else head + "..." + tail.
   * SIP payloads get custom extraction. Long payloads waste tokens without proportional gain.
   *
   * @param payload - Payload to truncate
   * @returns Truncated payload
   */
  private truncatePayload(payload: string): string {
    const maxLength = 400;
    
    if (payload.length <= maxLength) {
      return payload;
    }

    const isSipPayload = /^(SIP\/2\.0|INVITE|BYE|CANCEL|REGISTER|OPTIONS|REFER|NOTIFY|SUBSCRIBE|PRACK|UPDATE|ACK)/m
      .test(payload.substring(0, 100));

    if (isSipPayload) {
      return this.extractSipPayload(payload);
    }

    // Keep full head lines so the model receives parseable structured fragments.
    const lines = payload.split('\n');
    const headLines: string[] = [];
    let headChars = 0;

    for (const line of lines) {
      if (headChars + line.length > 200) {
        break;
      }
      headLines.push(line);
      headChars += line.length + 1;
    }

    const head = headLines.join('\n');
    const omittedChars = payload.length - maxLength;
    return `${head}\n... [truncated ${omittedChars} characters] ...`;
  }

  /**
   * Extract high-signal SIP headers to reduce token usage.
   * Full SDP tails are expensive and rarely improve diagnostic quality.
   *
   * @param payload - SIP payload text
   * @returns Compact SIP-focused payload summary
   */
  private extractSipPayload(payload: string): string {
    const lines = payload.split('\n');
    const extracted: string[] = [];

    if (lines.length > 0) {
      extracted.push(lines[0].trim());
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') {
        break;
      }

      const isKeyHeader = LogContextBuilder.KEY_SIP_HEADERS.some(
        header => line.startsWith(`${header}:`) || line.startsWith(`${header} `)
      );

      if (isKeyHeader) {
        extracted.push(line.length > 120 ? `${line.substring(0, 120)}...` : line);
      }

      if (extracted.length >= 12) {
        break;
      }
    }

    const headerBoundary = lines.findIndex(line => line.trim() === '');
    const totalHeaders = headerBoundary > 0 ? headerBoundary : lines.length;
    const omittedHeaders = totalHeaders - extracted.length;
    if (omittedHeaders > 0) {
      extracted.push(`[+${omittedHeaders} headers omitted]`);
    }

    return extracted.join('\n');
  }
  
  /**
   * Format first and last log timestamps as a human-readable range.
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

    const counts = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
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

export const logContextBuilder = new LogContextBuilder();
