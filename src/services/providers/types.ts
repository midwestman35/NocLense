import type { AIProviderId, AIUsageStats } from '../../types/ai';

export interface ProviderAnalyzeOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderAnalyzeResponse {
  content: string;
  logReferences: number[];
  tokensUsed: number;
  model: string;
}

export interface ProviderHierarchicalContextChunk {
  timeWindow: string;
  context: string;
}

/**
 * Common contract for pluggable LLM providers.
 */
export interface LLMProvider {
  readonly providerId: AIProviderId;
  initialize(apiKey: string, model?: string): void;
  validateApiKey(apiKey: string): Promise<boolean>;
  setDailyRequestLimit(limit: number): void;
  getUsageStats(): AIUsageStats;
  analyzeLog(
    query: string,
    context: string,
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse>;
  analyzeHierarchical(
    query: string,
    chunks: ProviderHierarchicalContextChunk[],
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse>;
}
