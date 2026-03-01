/**
 * Codex CLI Provider - LLM provider backed by local Codex CLI binary.
 *
 * Uses `codex exec` in Electron main process via IPC. No per-user API keys when
 * Codex is authenticated via `codex login` (Enterprise/OAuth). Optional
 * CODEX_API_KEY for CI-style runs.
 *
 * @module services/providers/CodexCLIProvider
 */

import {
  InvalidApiKeyError,
  NetworkError,
  QuotaExceededError,
  RateLimitError,
  TokenLimitExceededError,
  type AIUsageStats,
} from '../../types/ai';
import type {
  LLMProvider,
  ProviderAnalyzeOptions,
  ProviderAnalyzeResponse,
  ProviderHierarchicalContextChunk,
} from './types';
import { extractLogReferences } from './providerUtils';

const DEFAULT_DAILY_REQUEST_LIMIT = 1500;

function isCodexBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI?.codexAnalyze === 'function';
}

export class CodexCLIProvider implements LLMProvider {
  public readonly providerId = 'codex' as const;
  private apiKey: string | null = null;
  private currentModelId = 'gpt-4.1-mini';
  private dailyRequestLimit = DEFAULT_DAILY_REQUEST_LIMIT;
  private requestsToday = 0;
  private requestsThisMinute = 0;
  private lastMinuteReset = Date.now();
  private lastDailyReset = Date.now();
  private totalTokensUsed = 0;

  /**
   * Initialize Codex CLI provider.
   * apiKey optional: when using codex login, pass null; for CODEX_API_KEY override, pass key.
   */
  public initialize(apiKey: string | null, model?: string): void {
    this.apiKey = apiKey ?? null;
    this.currentModelId = model ?? this.currentModelId;
    this.resetRateLimits();
  }

  /**
   * Validate Codex CLI: binary exists and is authenticated.
   * For CLI mode, we call codexHealth via IPC; apiKey param ignored when using codex login.
   */
  public async validateApiKey(_apiKey: string): Promise<boolean> {
    if (!isCodexBridgeAvailable()) {
      return false;
    }
    try {
      const result = await window.electronAPI!.codexHealth!();
      return Boolean(result?.ok && result.available);
    } catch {
      return false;
    }
  }

  public setDailyRequestLimit(limit: number): void {
    this.dailyRequestLimit = Math.max(1, limit);
  }

  public getUsageStats(): AIUsageStats {
    return {
      requestsToday: this.requestsToday,
      requestsThisMinute: this.requestsThisMinute,
      totalTokensUsed: this.totalTokensUsed,
      lastDailyReset: this.lastDailyReset,
      lastMinuteReset: this.lastMinuteReset,
    };
  }

  public async analyzeLog(
    query: string,
    context: string,
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    if (!isCodexBridgeAvailable()) {
      throw new NetworkError(
        'Codex CLI is not available. Run NocLense in Electron and install Codex: npm i -g @openai/codex'
      );
    }
    this.checkRateLimits();

    const prompt = this.buildPrompt(query, context);
    const result = await window.electronAPI!.codexAnalyze!({
      query,
      context: prompt,
      model: options?.model ?? this.currentModelId,
      apiKey: this.apiKey ?? undefined,
    });

    if (!result.ok) {
      throw this.mapError(result.error ?? 'Codex analysis failed');
    }

    this.incrementRateLimits();
    const tokensUsed = result.tokensUsed ?? Math.ceil((prompt.length + (result.content?.length ?? 0)) / 4);
    this.totalTokensUsed += tokensUsed;

    return {
      content: result.content?.trim() || 'No response returned.',
      logReferences: extractLogReferences(result.content ?? ''),
      tokensUsed,
      model: options?.model ?? this.currentModelId,
    };
  }

  public async analyzeHierarchical(
    query: string,
    chunks: ProviderHierarchicalContextChunk[],
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    if (chunks.length === 0) {
      return this.analyzeLog(query, 'No logs available for analysis.', options);
    }
    const summaries: string[] = [];
    for (const chunk of chunks) {
      const chunkPrompt = `Summarize this log time-window for later synthesis.\nTime window: ${chunk.timeWindow}\nQuestion: ${query}`;
      const chunkResult = await this.analyzeLog(chunkPrompt, chunk.context, options);
      summaries.push(`### ${chunk.timeWindow}\n${chunkResult.content}`);
    }
    return this.analyzeLog(
      `Synthesize these summaries into one final answer.\nOriginal question: ${query}`,
      summaries.join('\n\n'),
      options
    );
  }

  private buildPrompt(query: string, context: string): string {
    return `You are an expert in telecommunications and VoIP log analysis.

CONTEXT:
${context}

QUESTION:
${query}

INSTRUCTIONS:
- Provide actionable findings.
- Reference specific log IDs when possible.
- Be concise and use markdown.`;
  }

  private resetRateLimits(): void {
    this.requestsThisMinute = 0;
    this.requestsToday = 0;
    this.lastMinuteReset = Date.now();
    this.lastDailyReset = Date.now();
  }

  private checkRateLimits(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60000) {
      this.requestsThisMinute = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastDailyReset > 24 * 60 * 60 * 1000) {
      this.requestsToday = 0;
      this.lastDailyReset = now;
    }
    if (this.requestsThisMinute >= 15) {
      throw new RateLimitError('Too many requests. Please try again shortly.', this.lastMinuteReset + 60000);
    }
    if (this.requestsToday >= this.dailyRequestLimit) {
      throw new QuotaExceededError(`Daily limit reached (${this.dailyRequestLimit} requests).`);
    }
  }

  private incrementRateLimits(): void {
    this.requestsThisMinute += 1;
    this.requestsToday += 1;
  }

  private mapError(message: string): Error {
    const lower = message.toLowerCase();
    if (lower.includes('invalid') || lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
      return new InvalidApiKeyError('Codex not authenticated. Run `codex login` in a terminal.');
    }
    if (lower.includes('rate') || lower.includes('429')) {
      return new RateLimitError('Too many requests. Please wait and try again.', Date.now() + 60000);
    }
    if (lower.includes('quota')) {
      return new QuotaExceededError('Daily quota exceeded. Please check your Codex limits.');
    }
    if (lower.includes('token') || lower.includes('context')) {
      return new TokenLimitExceededError('Context too large. Please select fewer logs.');
    }
    if (lower.includes('not found') || lower.includes('command') || lower.includes('install')) {
      return new NetworkError(
        'Codex CLI not found. Install with: npm i -g @openai/codex, then run codex login.'
      );
    }
    return new NetworkError(message || 'Codex analysis failed. Check your connection and try again.');
  }
}
