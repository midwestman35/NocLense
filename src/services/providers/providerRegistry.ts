import type { AIProviderId } from '../../types/ai';
import { ClaudeProvider } from './ClaudeProvider';
import { CodexCLIProvider } from './CodexCLIProvider';
import { GeminiProvider } from './GeminiProvider';
import type { LLMProvider } from './types';

/**
 * Singleton provider registry for runtime provider resolution.
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private readonly providers: Map<AIProviderId, LLMProvider>;

  private constructor() {
    this.providers = new Map<AIProviderId, LLMProvider>([
      ['gemini', new GeminiProvider()],
      ['claude', new ClaudeProvider()],
      ['codex', new CodexCLIProvider()],
    ]);
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public getProvider(providerId: AIProviderId): LLMProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unsupported AI provider: ${providerId}`);
    }
    return provider;
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
