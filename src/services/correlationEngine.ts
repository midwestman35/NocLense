/**
 * CorrelationEngine — Phase 5
 *
 * Purpose:
 * Stateful SIP correlation engine that evaluates a set of rules against a
 * sorted list of log entries and returns structured `CorrelationMatch` results.
 *
 * Supported rule types:
 * - PAIR: INVITE→200 OK, INVITE→4xx (per Call-ID, within time window)
 * - THRESHOLD: 5+ 408s in 60 s (global sliding window count)
 * - SEQUENCE: INVITE→183→200 (ordered steps per Call-ID, within window)
 *
 * Architecture decisions:
 * - Pure class, no React dependencies — safe to import in both context and tests.
 * - All methods are O(n) or O(n·steps) — no nested loops over the full log set.
 * - SIP method matching is prefix-aware: '200' matches '200 OK', '4' matches '4xx'.
 *
 * @module services/correlationEngine
 */

import type { LogEntry } from '../types';
import type {
  CorrelationMatch,
  CorrelationRule,
  SIPPairRule,
  SIPSequenceRule,
  SIPThresholdRule,
} from '../types/correlationRules';

/**
 * Returns true when `candidate` starts with `prefix` (case-insensitive).
 * Allows '200' to match '200 OK', '4' to match '408 Request Timeout', etc.
 */
function methodMatches(prefix: string, candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  return candidate.toUpperCase().startsWith(prefix.toUpperCase());
}

export class CorrelationEngine {
  /**
   * Evaluate all rules against the supplied logs and return every match found.
   *
   * @param logs - Chronologically sorted log entries
   * @param rules - Rules to evaluate
   * @returns Flat list of all correlation matches
   */
  public evaluateRules(logs: LogEntry[], rules: CorrelationRule[]): CorrelationMatch[] {
    if (logs.length === 0 || rules.length === 0) return [];

    const results: CorrelationMatch[] = [];
    for (const rule of rules) {
      switch (rule.type) {
        case 'PAIR':
          results.push(...this.detectPairs(logs, rule));
          break;
        case 'THRESHOLD':
          results.push(...this.detectThreshold(logs, rule));
          break;
        case 'SEQUENCE':
          results.push(...this.detectSequence(logs, rule));
          break;
      }
    }
    return results;
  }

  /**
   * Detect PAIR matches: for every log matching `startMethod`, look forward
   * within `windowMs` for a log matching `endMethod` on the same Call-ID
   * (when `callIdRequired` is true).
   *
   * Each startMethod log can produce at most one match (the earliest endMethod hit).
   *
   * @param logs - Chronologically sorted log entries
   * @param rule - PAIR rule definition
   */
  public detectPairs(logs: LogEntry[], rule: SIPPairRule): CorrelationMatch[] {
    const matches: CorrelationMatch[] = [];

    // Group SIP logs by Call-ID for O(1) lookup; fallback group '' for non-Call-ID matching
    const byCallId = new Map<string, LogEntry[]>();
    for (const log of logs) {
      if (!log.isSip) continue;
      const key = rule.callIdRequired ? (log.callId ?? '') : '';
      if (!byCallId.has(key)) byCallId.set(key, []);
      byCallId.get(key)!.push(log);
    }

    for (const [callId, group] of byCallId) {
      // Skip empty-key group when callId is required (no Call-ID available)
      if (rule.callIdRequired && callId === '') continue;

      for (let i = 0; i < group.length; i++) {
        const start = group[i];
        if (!methodMatches(rule.startMethod, start.sipMethod)) continue;

        // Scan forward for the first matching end within the time window
        for (let j = i + 1; j < group.length; j++) {
          const end = group[j];
          if (end.timestamp - start.timestamp > rule.windowMs) break;
          if (!methodMatches(rule.endMethod, end.sipMethod)) continue;

          const duration = end.timestamp - start.timestamp;
          matches.push({
            ruleType: 'PAIR',
            label: rule.label,
            logIds: [start.id, end.id],
            callId: callId || undefined,
            duration,
            triggeredAt: new Date(start.timestamp),
            summary: callId
              ? `${rule.startMethod}→${rule.endMethod} (${duration} ms) — ${callId.slice(0, 16)}…`
              : `${rule.startMethod}→${rule.endMethod} in ${duration} ms`,
          });
          break; // each start event produces at most one match
        }
      }
    }

    return matches;
  }

  /**
   * Detect THRESHOLD matches: count occurrences of `method` in a sliding window.
   * Emits one match per window group that reaches or exceeds `count`.
   *
   * Uses a sliding-window pointer approach for O(n) time.
   *
   * @param logs - Chronologically sorted log entries
   * @param rule - THRESHOLD rule definition
   */
  public detectThreshold(logs: LogEntry[], rule: SIPThresholdRule): CorrelationMatch[] {
    const matches: CorrelationMatch[] = [];

    // Collect only matching SIP log entries
    const candidates = logs.filter(
      (l) => l.isSip && methodMatches(rule.method, l.sipMethod)
    );

    if (candidates.length < rule.count) return matches;

    let windowStart = 0;
    const windowLogIds: number[] = [];
    const emittedWindows = new Set<number>(); // keyed by first-log id to avoid duplicates

    for (let right = 0; right < candidates.length; right++) {
      const rightLog = candidates[right];
      windowLogIds.push(rightLog.id);

      // Evict entries that have fallen outside the window
      while (
        windowStart <= right &&
        rightLog.timestamp - candidates[windowStart].timestamp > rule.windowMs
      ) {
        windowLogIds.shift();
        windowStart++;
      }

      // Fire when the window has accumulated enough entries
      if (windowLogIds.length >= rule.count) {
        const firstId = windowLogIds[0];
        if (!emittedWindows.has(firstId)) {
          emittedWindows.add(firstId);
          const firstTs = candidates[windowStart].timestamp;
          matches.push({
            ruleType: 'THRESHOLD',
            label: rule.label,
            logIds: [...windowLogIds],
            triggeredAt: new Date(firstTs),
            summary: `${windowLogIds.length}× ${rule.method} within ${rule.windowMs / 1000}s`,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Detect SEQUENCE matches: for each Call-ID, find occurrences of all `steps`
   * appearing in order within `windowMs`.
   *
   * @param logs - Chronologically sorted log entries
   * @param rule - SEQUENCE rule definition
   */
  public detectSequence(logs: LogEntry[], rule: SIPSequenceRule): CorrelationMatch[] {
    if (rule.steps.length === 0) return [];
    const matches: CorrelationMatch[] = [];

    // Group by Call-ID (sequences require Call-ID context)
    const byCallId = new Map<string, LogEntry[]>();
    for (const log of logs) {
      if (!log.isSip || !log.callId) continue;
      if (!byCallId.has(log.callId)) byCallId.set(log.callId, []);
      byCallId.get(log.callId)!.push(log);
    }

    for (const [callId, group] of byCallId) {
      // Scan through the group looking for the first step
      for (let i = 0; i < group.length; i++) {
        if (!methodMatches(rule.steps[0], group[i].sipMethod)) continue;

        // Try to complete the full sequence from this starting point
        const matchedLogIds: number[] = [group[i].id];
        let stepIdx = 1;
        const startTs = group[i].timestamp;

        for (let j = i + 1; j < group.length && stepIdx < rule.steps.length; j++) {
          if (group[j].timestamp - startTs > rule.windowMs) break;
          if (methodMatches(rule.steps[stepIdx], group[j].sipMethod)) {
            matchedLogIds.push(group[j].id);
            stepIdx++;
          }
        }

        if (stepIdx === rule.steps.length) {
          // All steps matched
          const lastLog = logs.find((l) => l.id === matchedLogIds[matchedLogIds.length - 1]);
          const duration = lastLog ? lastLog.timestamp - startTs : undefined;
          matches.push({
            ruleType: 'SEQUENCE',
            label: rule.label,
            logIds: matchedLogIds,
            callId,
            duration,
            triggeredAt: new Date(startTs),
            summary: `${rule.steps.join('→')} (${duration != null ? duration + ' ms' : '?'}) — ${callId.slice(0, 16)}…`,
          });
          // Advance past this matched start to avoid double-counting
          i += matchedLogIds.length - 1;
        }
      }
    }

    return matches;
  }
}

/** Singleton instance for use throughout the app. */
export const correlationEngine = new CorrelationEngine();

/**
 * Built-in default rules applied to every set of filtered logs.
 *
 * Why built-in defaults:
 * - Users get immediate value without manual configuration.
 * - The most common SIP patterns (INVITE→200, INVITE→4xx, 408 storms) cover
 *   80%+ of the call-flow analysis use cases in a VoIP/UC environment.
 */
export const DEFAULT_CORRELATION_RULES: CorrelationRule[] = [
  {
    type: 'PAIR',
    label: 'Successful Call Setup',
    startMethod: 'INVITE',
    endMethod: '200',
    windowMs: 30_000,
    callIdRequired: true,
  },
  {
    type: 'PAIR',
    label: 'Call Failure (4xx)',
    startMethod: 'INVITE',
    endMethod: '4',
    windowMs: 30_000,
    callIdRequired: true,
  },
  {
    type: 'PAIR',
    label: 'Server Error (5xx)',
    startMethod: 'INVITE',
    endMethod: '5',
    windowMs: 30_000,
    callIdRequired: true,
  },
  {
    type: 'THRESHOLD',
    label: '408 Timeout Storm',
    method: '408',
    count: 5,
    windowMs: 60_000,
  },
  {
    type: 'SEQUENCE',
    label: 'Full Call Setup (INVITE→183→200)',
    steps: ['INVITE', '183', '200'],
    windowMs: 30_000,
  },
];
