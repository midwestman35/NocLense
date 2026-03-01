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

export class ClaudeProvider implements LLMProvider {
  public readonly providerId = 'claude' as const;
  private apiKey: string | null = null;
  private currentModelId = 'claude-sonnet-4-6';
  private dailyRequestLimit = 1500;
  private requestsToday = 0;
  private requestsThisMinute = 0;
  private lastMinuteReset = Date.now();
  private lastDailyReset = Date.now();
  private totalTokensUsed = 0;

  public initialize(apiKey: string | null, model: string = 'claude-sonnet-4-6'): void {
    if (!apiKey || apiKey.trim().length < 10) {
      throw new InvalidApiKeyError('API key is required');
    }
    this.apiKey = apiKey;
    this.currentModelId = model;
    this.resetRateLimits();
  }

  public async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.trim().length < 10) {
      return false;
    }
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 8,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (response.ok) {
        return true;
      }

      const body = await response.text();
      // Log status and response for debugging (no API key); explains 401 vs 404 vs other.
      console.warn('[Claude validation]', { status: response.status, body: body.slice(0, 500) });

      // Why: only classify explicit auth failures as invalid keys.
      if (response.status === 401 || response.status === 403) {
        return false;
      }

      throw this.mapHttpError(response.status, body);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('failed to fetch') || message.includes('network') || message.includes('cors')) {
        throw new NetworkError('Unable to reach Anthropic API. Check connection, firewall, or CORS/browser restrictions.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new NetworkError('Unable to validate Claude API key due to a network error.');
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
    this.ensureInitialized();
    this.checkRateLimits();

    const prompt = this.buildPrompt(query, context);
    const response = await this.callAnthropic(prompt, options);
    this.incrementRateLimits();
    return response;
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

  private ensureInitialized(): void {
    if (!this.apiKey) {
      throw new InvalidApiKeyError('Claude provider not initialized');
    }
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

  private async callAnthropic(
    prompt: string,
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: options?.model ?? this.currentModelId,
          max_tokens: Math.min(options?.maxTokens ?? 2048, 4096),
          temperature: options?.temperature ?? 0.2,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw this.mapHttpError(response.status, body);
      }

      const json = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = (json.content ?? [])
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text as string)
        .join('\n')
        .trim();
      const tokensUsed = (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);
      this.totalTokensUsed += tokensUsed;
      return {
        content: text || 'No response returned.',
        logReferences: extractLogReferences(text),
        tokensUsed,
        model: options?.model ?? this.currentModelId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('failed to fetch') || message.includes('network') || message.includes('cors')) {
        throw new NetworkError('Unable to reach Anthropic API. Check connection, firewall, or CORS/browser restrictions.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new NetworkError('Claude request failed');
    }
  }

  private mapHttpError(status: number, body: string): Error {
    const lower = body.toLowerCase();
    if (status === 401 || status === 403) {
      return new InvalidApiKeyError('Invalid API key. Please check your settings.');
    }
    if (status === 404) {
      return new Error(
        'Anthropic API returned 404 (endpoint or model not found). Check API version and model name.'
      );
    }
    if (lower.includes('dangerous-direct-browser-access') || lower.includes('browser')) {
      return new NetworkError(
        'Anthropic blocked this browser request. Ensure browser access is enabled and try again.'
      );
    }
    if (status === 429) {
      return new RateLimitError('Too many requests. Please wait and try again.', Date.now() + 60000);
    }
    if (status >= 500) {
      return new NetworkError('Provider service is temporarily unavailable.');
    }
    if (lower.includes('quota')) {
      return new QuotaExceededError('Daily quota exceeded. Please check your provider limits.');
    }
    if (lower.includes('token')) {
      return new TokenLimitExceededError('Context too large. Please select fewer logs.');
    }
    return new Error('AI analysis failed. Check your connection and try again.');
  }
}
