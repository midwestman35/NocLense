/**
 * Correlation Rule Type Definitions — Phase 5
 *
 * Purpose:
 * Defines the rule types used by the SIP correlation engine to detect temporal
 * call sequences, error thresholds, and multi-step SIP flows in log data.
 *
 * Rule types:
 * - PAIR: Detects start→end method transitions per Call-ID (e.g., INVITE→200)
 * - THRESHOLD: Fires when a method appears N times within a rolling window
 * - SEQUENCE: Matches an ordered list of methods per Call-ID within a window
 *
 * @module types/correlationRules
 */

/**
 * Detects a two-event SIP transaction (e.g., INVITE followed by 200 OK).
 * Matches are scoped per Call-ID when `callIdRequired` is true.
 */
export interface SIPPairRule {
  type: 'PAIR';
  /** Label shown in the UI (e.g., "INVITE → 200 OK") */
  label: string;
  /** The initiating SIP method (e.g., 'INVITE') */
  startMethod: string;
  /** The completing SIP method or response (e.g., '200') */
  endMethod: string;
  /** Maximum milliseconds between startMethod and endMethod */
  windowMs: number;
  /** When true, start and end must share the same Call-ID */
  callIdRequired: boolean;
}

/**
 * Fires when a specific SIP method/response occurs N or more times
 * within a rolling time window — useful for detecting storms (e.g., 408 floods).
 */
export interface SIPThresholdRule {
  type: 'THRESHOLD';
  /** Label shown in the UI */
  label: string;
  /** The SIP method or response code prefix to count (e.g., '408', '5') */
  method: string;
  /** How many occurrences trigger the rule */
  count: number;
  /** Rolling window duration in milliseconds */
  windowMs: number;
}

/**
 * Matches an ordered chain of SIP methods per Call-ID within a time window
 * (e.g., INVITE → 183 → 200 for a successful call setup).
 */
export interface SIPSequenceRule {
  type: 'SEQUENCE';
  /** Label shown in the UI */
  label: string;
  /** Ordered SIP methods that must appear in sequence (e.g., ['INVITE', '183', '200']) */
  steps: string[];
  /** Maximum milliseconds from the first step to the last */
  windowMs: number;
}

/** Union of all supported rule types */
export type CorrelationRule = SIPPairRule | SIPThresholdRule | SIPSequenceRule;

/**
 * A single detection result produced by the correlation engine.
 * Returned from `CorrelationEngine.evaluateRules()`.
 */
export interface CorrelationMatch {
  /** Which rule type produced this match */
  ruleType: 'PAIR' | 'THRESHOLD' | 'SEQUENCE';
  /** Human-readable rule label */
  label: string;
  /** IDs of the log entries involved in this match */
  logIds: number[];
  /** Call-ID involved (when the rule is per-Call-ID) */
  callId?: string;
  /** Duration in milliseconds between first and last event (for PAIR/SEQUENCE) */
  duration?: number;
  /** When the match was first triggered */
  triggeredAt: Date;
  /** One-line description suitable for the sidebar */
  summary: string;
}
