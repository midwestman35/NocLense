import { GeminiService } from '../llmService';
import { InvalidApiKeyError, type AIUsageStats } from '../../types/ai';
import type {
  LLMProvider,
  ProviderAnalyzeOptions,
  ProviderAnalyzeResponse,
  ProviderHierarchicalContextChunk,
} from './types';

export class GeminiProvider implements LLMProvider {
  public readonly providerId = 'gemini' as const;
  private readonly service: GeminiService;

  constructor(service?: GeminiService) {
    this.service = service ?? GeminiService.getInstance();
  }

  public initialize(apiKey: string | null, model?: string): void {
    if (!apiKey || apiKey.trim().length < 10) {
      throw new InvalidApiKeyError('API key is required');
    }
    this.service.initialize(apiKey, model);
  }

  public validateApiKey(apiKey: string): Promise<boolean> {
    return this.service.validateApiKey(apiKey);
  }

  public setDailyRequestLimit(limit: number): void {
    this.service.setDailyRequestLimit(limit);
  }

  public getUsageStats(): AIUsageStats {
    return this.service.getUsageStats();
  }

  public analyzeLog(
    query: string,
    context: string,
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    return this.service.analyzeLog(query, context, options);
  }

  public analyzeHierarchical(
    query: string,
    chunks: ProviderHierarchicalContextChunk[],
    options?: ProviderAnalyzeOptions
  ): Promise<ProviderAnalyzeResponse> {
    return this.service.analyzeHierarchical(query, chunks, options);
  }
}
