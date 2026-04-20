/**
 * Utility Type Definitions
 *
 * Purpose:
 * Consolidates types from utility modules (animation, theming, token estimation, etc.)
 * to improve code organization and discoverability.
 *
 * @module types/utils
 */

// ─── Animation Types ────────────────────────────────────────────────────────

export interface StaggerOptions {
  /** Delay between each item in milliseconds */
  delay: number;
  /** Total duration for the entire stagger in milliseconds */
  duration?: number;
  /** Easing function name (e.g., "easeInOutQuad") */
  easing?: string;
}

export interface TimelineStep {
  /** Step name/label */
  name: string;
  /** Duration of this step in milliseconds */
  duration: number;
  /** Optional target value */
  value?: number;
  /** Optional easing for this step */
  easing?: string;
}

// ─── Theme Types ────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'red';

// ─── Token Estimation Types ─────────────────────────────────────────────────

export interface TokenUsage {
  /** Estimated tokens used for this content */
  tokens: number;
  /** Breakdown by component (prompt, context, response, etc.) */
  breakdown?: {
    prompt?: number;
    context?: number;
    response?: number;
    [key: string]: number | undefined;
  };
  /** Model used for estimation (e.g., "gpt-4", "claude-3") */
  model?: string;
}

// ─── Message Cleanup Types ──────────────────────────────────────────────────

export interface ServiceMappings {
  /** Map of old service name patterns to new/standardized names */
  [oldName: string]: string;
}

export interface CleanupResult {
  /** Original input value */
  original: string;
  /** Cleaned/standardized output value */
  cleaned: string;
  /** Whether any transformations were applied */
  modified: boolean;
  /** Type of transformation applied */
  transformationType?: 'mapping' | 'normalization' | 'trim';
}

// ─── Field/Structured Data Types ────────────────────────────────────────────

export interface FieldEntry {
  /** Field name */
  name: string;
  /** Field value */
  value: string | number | boolean | null;
  /** Data type of the field */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'unknown';
  /** Whether this field is a key field (appears frequently) */
  isKey?: boolean;
}
