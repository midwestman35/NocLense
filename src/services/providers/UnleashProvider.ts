/**
 * UnleashProvider
 *
 * Purpose:
 * Implements the LLMProvider interface for the Unleash AI platform
 * (https://app.unleash.so), Carbyne's company-approved AI with access
 * to the internal Confluence knowledge base.
 *
 * Architecture Decision:
 * Uses the Unleash REST Chat API (POST /chats) with the messages array
 * format required by the OpenAPI spec. Auth is a Bearer token with
 * "impersonate" access mode — no per-user email header required.
 *
 * Why impersonate mode removes the unleash-account header:
 * When an API key is created with "impersonate" access mode in the Unleash
 * Admin Center, the key is already scoped to a user identity, so the
 * unleash-account header (user email) is not required.
 *
 * Dependencies:
 * - src/services/providers/types.ts — LLMProvider interface
 * - src/types/ai.ts — AIProviderId, AIUsageStats
 *
 * @module services/providers/UnleashProvider
 */

import type { AIUsageStats } from '../../types/ai';
import type {
  LLMProvider,
  ProviderAnalyzeOptions,
  ProviderAnalyzeResponse,
  ProviderHierarchicalContextChunk,
} from './types';
import { getUnleashChatsUrl } from '../apiConfig';

interface UnleashMessage {
  text: string;
  role: 'User' | 'Assistant' | 'System';
}

interface UnleashChatBody {
  messages: UnleashMessage[];
  assistantId?: string;
}

/**
 * Extracts the text response from a Unleash ChatCompletionResponse.
 *
 * @param data - Raw JSON response from the Unleash API
 * @returns The assistant's text content
 */
function extractContent(data: unknown): string {
  if (typeof data !== 'object' || data === null) return String(data);
  const d = data as Record<string, unknown>;

  // Official schema: message.parts[].text (type === 'Text')
  const parts = (d.message as Record<string, unknown> | undefined)?.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    const text = parts
      .filter((p: unknown) => {
        const part = p as Record<string, unknown>;
        return part.type === 'Text' || part.text !== undefined;
      })
      .map((p: unknown) => {
        const part = p as Record<string, unknown>;
        return String(part.text ?? part.content ?? '');
      })
      .join('');
    if (text) return text;
  }

  // Fallbacks for alternative response shapes
  if (typeof d.answer === 'string') return d.answer;
  if (typeof (d.message as Record<string, unknown> | undefined)?.text === 'string') {
    return (d.message as Record<string, unknown>).text as string;
  }
  return JSON.stringify(data);
}

export class UnleashProvider implements LLMProvider {
  public readonly providerId = 'unleash' as const;

  private token = '';
  private assistantId = '';
  private requestsToday = 0;
  private requestsThisMinute = 0;
  private lastMinuteReset = Date.now();
  private lastDailyReset = Date.now();
  private totalTokensUsed = 0;
  private dailyLimit = 0; // 0 = unlimited (managed by Unleash platform)

  /**
   * Initialises the provider with a Bearer token.
   * The model parameter is repurposed as the optional Unleash assistantId.
   *
   * @param apiKey - Unleash Bearer token from Admin Center → API Keys
   * @param model  - Optional Unleash assistantId (leave blank for default assistant)
   */
  public initialize(apiKey: string, model?: string): void {
    this.token = apiKey;
    this.assistantId = model && model !== 'unleash-default' ? model : '';
  }

  /**
   * Validates a Bearer token for Unleash.
   *
   * Why no live test call:
   * Unleash tokens with "impersonate" access mode require meaningful queries
   * to respond successfully — a simple "Hello" probe can return 4xx/5xx even
   * for valid tokens. We trust the token if it's non-empty; real validation
   * happens on first analysis request.
   *
   * @param apiKey - Token to validate
   * @returns true if the token string is non-empty
   */
  public async validateApiKey(apiKey: string): Promise<boolean> {
    return apiKey.trim().length > 0;
  }

  public setDailyRequestLimit(limit: number): void {
    this.dailyLimit = limit;
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

  /**
   * Analyses a log context string against a user query.
   *
   * @param query   - Natural language question from the user
   * @param context - Pre-built log context string from logContextBuilder
   * @returns AI response with content and empty logReferences (Unleash doesn't return log IDs)
   * @throws Error if token is missing or the API returns a non-2xx status
   */
  public async analyzeLog(
    query: string,
    context: string,
    _options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    const messages: UnleashMessage[] = [
      {
        role: 'User',
        text: `You are a NOC (Network Operations Center) log analyst for Carbyne.\n\nLOG CONTEXT:\n${context}\n\nQUESTION: ${query}`,
      },
    ];
    return this.sendMessages(messages);
  }

  /**
   * Analyses log context provided as multiple chunks (large-file / hierarchical mode).
   *
   * @param query  - Natural language question
   * @param chunks - Time-windowed context chunks from logContextBuilder
   * @returns AI response
   * @throws Error on API failure
   */
  public async analyzeHierarchical(
    query: string,
    chunks: ProviderHierarchicalContextChunk[],
    _options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    const combinedContext = chunks
      .map(c => `[${c.timeWindow}]\n${c.context}`)
      .join('\n\n');

    const messages: UnleashMessage[] = [
      {
        role: 'User',
        text: `You are a NOC log analyst for Carbyne. Analyse the following time-windowed log data and answer the question.\n\nLOG DATA:\n${combinedContext}\n\nQUESTION: ${query}`,
      },
    ];
    return this.sendMessages(messages);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async sendMessages(messages: UnleashMessage[]): Promise<ProviderAnalyzeResponse> {
    if (!this.token) {
      throw new Error('Unleash token not configured. Go to AI Settings and paste your Bearer token.');
    }

    this.checkRateLimits();

    const res = await this.fetchChat(messages, this.token);

    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      throw new Error(`Unleash API error (${res.status}): ${detail || res.statusText}`);
    }

    const data: unknown = await res.json();
    const content = extractContent(data);
    this.incrementUsage(0);

    return {
      content,
      logReferences: [],
      tokensUsed: 0,
      model: 'unleash-default',
    };
  }

  private fetchChat(messages: UnleashMessage[], token: string): Promise<Response> {
    const url = getUnleashChatsUrl();
    const body: UnleashChatBody = { messages };
    if (this.assistantId) body.assistantId = this.assistantId;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  private trackRequest(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60000) {
      this.requestsThisMinute = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastDailyReset > 24 * 60 * 60 * 1000) {
      this.requestsToday = 0;
      this.lastDailyReset = now;
    }
  }

  private checkRateLimits(): void {
    this.trackRequest();
    if (this.requestsThisMinute >= 15) {
      throw new Error('Too many requests. Please try again shortly.');
    }
    if (this.dailyLimit > 0 && this.requestsToday >= this.dailyLimit) {
      throw new Error(`Daily limit reached (${this.dailyLimit} requests).`);
    }
  }

  private incrementUsage(tokensUsed: number): void {
    this.requestsToday += 1;
    this.requestsThisMinute += 1;
    this.totalTokensUsed += tokensUsed;
  }
}
