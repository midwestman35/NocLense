import type { AIProviderId } from '../../types/ai';
import { UnleashProvider } from './UnleashProvider';
import type { LLMProvider } from './types';

/**
 * Provider Registry - Simplified
 *
 * After removing legacy provider implementations (ClaudeProvider, CodexProvider, GeminiProvider),
 * this registry now serves as a compatibility shim that maps all provider IDs to UnleashProvider.
 *
 * Historical note:
 * - Removed: ClaudeProvider, CodexProvider, GeminiProvider (legacy implementations)
 * - These were never actively used; the system defaults to 'unleash'
 * - Keeping this registry for AIContext compatibility (AIContext.tsx references it)
 *
 * Future: Consider refactoring AIContext to call UnleashProvider directly
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private readonly unleashProvider: LLMProvider;

  private constructor() {
    this.unleashProvider = new UnleashProvider();
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Get provider by ID. All provider IDs now map to UnleashProvider.
   * Legacy support: 'gemini', 'claude', 'codex' are no longer supported as separate implementations.
   */
  public getProvider(providerId: AIProviderId): LLMProvider {
    // All providers now use Unleash implementation
    // This maintains backward compatibility with AIContext while removing legacy code
    return this.unleashProvider;
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
