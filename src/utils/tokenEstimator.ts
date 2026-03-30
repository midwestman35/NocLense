/**
 * tokenEstimator.ts
 *
 * Rough token counting for LLM context windows.
 * Uses the ~4 chars/token heuristic for English text.
 * Tracks cumulative usage across sessions via localStorage.
 */

const STORAGE_KEY = 'noclense_token_usage';

export interface TokenUsage {
  /** Total estimated tokens sent (input) */
  totalInput: number;
  /** Total estimated tokens received (output) */
  totalOutput: number;
  /** Number of API calls made */
  totalCalls: number;
  /** Timestamp of first tracked call */
  firstCallAt: string;
  /** Timestamp of most recent call */
  lastCallAt: string;
}

/**
 * Estimate the number of tokens in a string.
 * Uses ~4 characters per token (reasonable for English + code).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Load cumulative token usage from localStorage.
 */
export function loadTokenUsage(): TokenUsage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TokenUsage;
  } catch { /* ignore */ }
  return { totalInput: 0, totalOutput: 0, totalCalls: 0, firstCallAt: '', lastCallAt: '' };
}

/**
 * Record a new API call's token usage.
 */
export function recordTokenUsage(inputTokens: number, outputTokens: number): void {
  const usage = loadTokenUsage();
  const now = new Date().toISOString();
  usage.totalInput += inputTokens;
  usage.totalOutput += outputTokens;
  usage.totalCalls += 1;
  if (!usage.firstCallAt) usage.firstCallAt = now;
  usage.lastCallAt = now;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch { /* ignore */ }
}

/**
 * Reset the token usage counter.
 */
export function resetTokenUsage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Format token count for display (e.g. "12.3k" or "1.2M").
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}
