/**
 * AI Context - React Context for LLM integration.
 */

import { createContext, useContext, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { LogContextBuilder } from '../services/logContextBuilder';
import { EmbeddingService } from '../services/embeddingService';
import { buildPromptFromTemplate } from '../services/promptTemplates';
import { providerRegistry } from '../services/providers/providerRegistry';
import {
  type AIProviderId,
  type AIMessage,
  type AIConfig,
  type AIUsageStats,
  AI_MODELS,
  DEFAULT_AI_PROVIDER,
  DEFAULT_MODELS_BY_PROVIDER,
  GEMINI_FREE_TIER_DAILY_LIMIT,
  type RateLimitError,
} from '../types/ai';
import type { LogEntry } from '../types';
import type { SimilarPastTicket } from '../types/diagnosis';
import ConsentModal from '../components/ConsentModal';
import QuotaExceededModal from '../components/QuotaExceededModal';
import {
  loadApiKey as loadStoredApiKey,
  saveApiKey as saveStoredApiKey,
  migrateFromLocalStorage as migrateApiKeysFromLocalStorage,
} from '../store/apiKeyStorage';

const STORAGE_KEY_MODEL = 'noclense_ai_model';
const STORAGE_KEY_PROVIDER = 'noclense_ai_provider';
const STORAGE_KEY_ENABLED = 'noclense_ai_enabled';
const STORAGE_KEY_USAGE_STATS = 'noclense_ai_usage_stats';
const STORAGE_KEY_DAILY_LIMIT = 'noclense_ai_daily_limit';
const STORAGE_KEY_CONSENT = 'noclense_ai_consent';
const STORAGE_KEY_ONBOARDING_COMPLETED = 'noclense-ai-onboarded';

const DEFAULT_MODEL: AIConfig['model'] = DEFAULT_MODELS_BY_PROVIDER[DEFAULT_AI_PROVIDER];
const DEFAULT_DAILY_LIMIT = GEMINI_FREE_TIER_DAILY_LIMIT;
const DEFAULT_ENABLED = false;

function loadProvider(): AIProviderId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROVIDER);
    if (saved === 'gemini' || saved === 'claude' || saved === 'codex') {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load provider from localStorage:', e);
  }
  return DEFAULT_AI_PROVIDER;
}

function saveProvider(provider: AIProviderId): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
  } catch (e) {
    console.error('Failed to save provider to localStorage:', e);
  }
}

function loadModel(provider: AIProviderId): AIConfig['model'] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    if (saved && AI_MODELS[saved]?.provider === provider) {
      return saved;
    }
    if (provider === 'gemini') {
      if (saved === 'gemini-3-pro-preview') {
        saveModel('gemini', 'gemini-3.1-pro-preview');
        return 'gemini-3.1-pro-preview';
      }
      if (saved === 'gemini-2.0-flash' || saved === 'gemini-1.5-pro' || saved === 'gemini-1.5-flash') {
        saveModel('gemini', 'gemini-3.1-flash-lite-preview');
        return 'gemini-3.1-flash-lite-preview';
      }
    }
    if (provider === 'claude' && (saved === 'claude-3-5-sonnet-latest' || saved === 'claude-3-5-haiku-latest')) {
      const next = saved === 'claude-3-5-haiku-latest' ? 'claude-haiku-4-5' : 'claude-sonnet-4-6';
      saveModel('claude', next);
      return next;
    }
  } catch (e) {
    console.error('Failed to load model from localStorage:', e);
  }
  return DEFAULT_MODELS_BY_PROVIDER[provider] ?? DEFAULT_MODEL;
}

function saveModel(_provider: AIProviderId, model: AIConfig['model']): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  } catch (e) {
    console.error('Failed to save model to localStorage:', e);
  }
}

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_ENABLED) === 'true';
  } catch (e) {
    console.error('Failed to load enabled state from localStorage:', e);
    return DEFAULT_ENABLED;
  }
}

function saveEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  } catch (e) {
    console.error('Failed to save enabled state to localStorage:', e);
  }
}

function loadUsageStats(): AIUsageStats {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USAGE_STATS);
    if (saved) {
      const stats: AIUsageStats = JSON.parse(saved);
      const now = Date.now();
      const lastReset = new Date(stats.lastDailyReset);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (lastReset < today) {
        const resetStats: AIUsageStats = {
          requestsToday: 0,
          requestsThisMinute: 0,
          totalTokensUsed: stats.totalTokensUsed,
          lastDailyReset: now,
          lastMinuteReset: now,
        };
        saveUsageStats(resetStats);
        return resetStats;
      }
      return stats;
    }
  } catch (e) {
    console.error('Failed to load usage stats from localStorage:', e);
  }

  const now = Date.now();
  return {
    requestsToday: 0,
    requestsThisMinute: 0,
    totalTokensUsed: 0,
    lastDailyReset: now,
    lastMinuteReset: now,
  };
}

function saveUsageStats(stats: AIUsageStats): void {
  try {
    localStorage.setItem(STORAGE_KEY_USAGE_STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save usage stats to localStorage:', e);
  }
}

function loadDailyLimit(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DAILY_LIMIT);
    if (saved) {
      const limit = parseInt(saved, 10);
      if (limit >= 1 && limit <= GEMINI_FREE_TIER_DAILY_LIMIT) {
        return limit;
      }
    }
  } catch (e) {
    console.error('Failed to load daily limit from localStorage:', e);
  }
  return DEFAULT_DAILY_LIMIT;
}

function saveDailyLimit(limit: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_LIMIT, String(limit));
  } catch (e) {
    console.error('Failed to save daily limit to localStorage:', e);
  }
}

function loadConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
  } catch (e) {
    console.error('Failed to load consent from localStorage:', e);
    return false;
  }
}

function saveConsent(consented: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONSENT, String(consented));
  } catch (e) {
    console.error('Failed to save consent to localStorage:', e);
  }
}

function loadOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_ONBOARDING_COMPLETED) === 'true';
  } catch (e) {
    console.error('Failed to load onboarding state from localStorage:', e);
    return false;
  }
}

function saveOnboardingCompleted(completed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_ONBOARDING_COMPLETED, String(completed));
  } catch (e) {
    console.error('Failed to save onboarding state to localStorage:', e);
  }
}

interface PendingAIRequest {
  query: string;
  logIds?: number[];
  logs?: LogEntry[];
}

interface AIContextType {
  isEnabled: boolean;
  apiKeyConfigured: boolean;
  provider: AIProviderId;
  model: AIConfig['model'];
  conversationHistory: AIMessage[];
  isLoading: boolean;
  error: string | null;
  usageStats: AIUsageStats;
  dailyRequestLimit: number;
  hasConsentedToAI: boolean;
  showConsentModal: boolean;
  showQuotaExceededModal: boolean;
  onboardingCompleted: boolean;
  askQuestion: (query: string, logIds?: number[], logs?: LogEntry[]) => Promise<void>;
  setApiKey: (key: string) => Promise<boolean>;
  setModel: (model: AIConfig['model']) => void;
  setProvider: (provider: AIProviderId) => void;
  clearHistory: () => void;
  clearError: () => void;
  getUsageStats: () => AIUsageStats;
  setDailyRequestLimit: (limit: number) => void;
  setEnabled: (enabled: boolean) => void;
  consentToAI: () => void;
  declineConsent: () => void;
  dismissQuotaExceeded: () => void;
  setOnboardingCompleted: (completed?: boolean) => void;
  /** Similar past tickets found during diagnosis — shared so WorkspaceCards can render them */
  similarPastTickets: SimilarPastTicket[];
  setSimilarPastTickets: (tickets: SimilarPastTicket[]) => void;
}

const AIContext = createContext<AIContextType | null>(null);

export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};

export const AIProvider = ({ children }: { children: ReactNode }) => {
  const [provider, setProviderState] = useState<AIProviderId>(() => loadProvider());
  const [apiKeys, setApiKeysState] = useState<Partial<Record<AIProviderId, string>>>({});
  const [model, setModelState] = useState<AIConfig['model']>(() => loadModel(loadProvider()));
  const [isEnabled, setIsEnabledState] = useState<boolean>(() => {
    // Auto-enable when Unleash env token is present so no manual setup is needed
    const envToken = import.meta.env.VITE_UNLEASH_TOKEN as string | undefined;
    if (envToken && envToken !== 'paste_your_token_here') {
      saveEnabled(true);
      return true;
    }
    return loadEnabled();
  });
  const [dailyRequestLimit, setDailyRequestLimitState] = useState<number>(() => loadDailyLimit());
  const [usageStats, setUsageStatsState] = useState<AIUsageStats>(() => loadUsageStats());
  const [hasConsentedToAI, setHasConsentedToAI] = useState<boolean>(() => loadConsent());
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [pendingAIRequest, setPendingAIRequest] = useState<PendingAIRequest | null>(null);
  const [showQuotaExceededModal, setShowQuotaExceededModal] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean>(() => {
    // Unleash is a pre-configured company provider — no onboarding wizard needed
    if (provider === 'unleash') {
      saveOnboardingCompleted(true);
      return true;
    }
    return loadOnboardingCompleted();
  });
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [similarPastTickets, setSimilarPastTicketsState] = useState<SimilarPastTicket[]>([]);

  const setSimilarPastTickets = useCallback((tickets: SimilarPastTicket[]) => {
    setSimilarPastTicketsState(tickets);
  }, []);

  const activeProviderService = useMemo(() => providerRegistry.getProvider(provider), [provider]);
  const contextBuilder = useMemo(() => new LogContextBuilder(), []);
  const embeddingService = useMemo(() => new EmbeddingService(), []);
  const apiKey = apiKeys[provider] ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadPersistedApiKeys = async () => {
      try {
        await migrateApiKeysFromLocalStorage();
        const [geminiKey, claudeKey, codexKey, storedUnleashKey] = await Promise.all([
          loadStoredApiKey('gemini'),
          loadStoredApiKey('claude'),
          loadStoredApiKey('codex'),
          loadStoredApiKey('unleash'),
        ]);

        // Use env var as the default Unleash token; stored key overrides it if set
        const envUnleashToken = import.meta.env.VITE_UNLEASH_TOKEN as string | undefined;
        const unleashKey = storedUnleashKey ?? (envUnleashToken && envUnleashToken !== 'paste_your_token_here' ? envUnleashToken : undefined);

        if (!cancelled) {
          setApiKeysState((prev) => ({
            ...prev,
            unleash: unleashKey ?? prev.unleash ?? undefined,
            gemini: geminiKey ?? prev.gemini ?? undefined,
            claude: claudeKey ?? prev.claude ?? undefined,
            codex: codexKey ?? prev.codex ?? undefined,
          }));
        }
      } catch (e) {
        console.error('Failed to load persisted API keys:', e);
      }
    };

    loadPersistedApiKeys();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiKey || !isEnabled) return;
    try {
      activeProviderService.initialize(apiKey, model);
      activeProviderService.setDailyRequestLimit(dailyRequestLimit);
    } catch (e) {
      console.error('Failed to initialize AI provider service:', e);
      setError('Failed to initialize AI service. Please check your API key.');
    }
  }, [activeProviderService, apiKey, dailyRequestLimit, isEnabled, model]);

  useEffect(() => {
    saveUsageStats(usageStats);
  }, [usageStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = loadUsageStats();
      if (stats.requestsToday !== usageStats.requestsToday) {
        setUsageStatsState(stats);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [usageStats.requestsToday]);

  const setApiKey = useCallback(async (key: string): Promise<boolean> => {
    setError(null);
    if (!key || key.trim().length === 0) {
      setError('API key is required');
      return false;
    }

    try {
      const isValid = await activeProviderService.validateApiKey(key);
      if (!isValid) {
        setError('Invalid API key. Please check your API key and try again.');
        return false;
      }

      await saveStoredApiKey(provider, key);
      setApiKeysState((prev) => ({ ...prev, [provider]: key }));
      activeProviderService.initialize(key, model);
      activeProviderService.setDailyRequestLimit(dailyRequestLimit);
      return true;
    } catch (e) {
      console.error('API key validation error:', e);
      const errName = e instanceof Error ? e.name : '';
      if (errName === 'InvalidApiKeyError') {
        setError('Invalid API key. Please check your API key and try again.');
      } else if (errName === 'RateLimitError' || errName === 'QuotaExceededError' || errName === 'NetworkError') {
        setError((e as Error).message);
      } else {
        const details = e instanceof Error ? e.message : '';
        setError(details || 'Failed to validate API key. Please check your connection and try again.');
      }
      return false;
    }
  }, [activeProviderService, dailyRequestLimit, model, provider]);

  const setModel = useCallback((newModel: AIConfig['model']): void => {
    saveModel(provider, newModel);
    setModelState(newModel);
    if (!apiKey || !isEnabled) return;
    try {
      activeProviderService.initialize(apiKey, newModel);
    } catch (e) {
      console.error('Failed to reinitialize with new model:', e);
      setError('Failed to switch model. Please try again.');
    }
  }, [activeProviderService, apiKey, isEnabled, provider]);

  const setProvider = useCallback((newProvider: AIProviderId): void => {
    saveProvider(newProvider);
    setProviderState(newProvider);
    setError(null);
    const nextModel = loadModel(newProvider);
    setModelState(nextModel);

    const nextApiKey = apiKeys[newProvider] ?? null;
    if (!nextApiKey || !isEnabled) return;
    try {
      const nextProviderService = providerRegistry.getProvider(newProvider);
      nextProviderService.initialize(nextApiKey, nextModel);
      nextProviderService.setDailyRequestLimit(dailyRequestLimit);
    } catch (e) {
      console.error('Failed to initialize selected provider:', e);
      setError('Failed to initialize provider. Verify API key and model settings.');
    }
  }, [apiKeys, dailyRequestLimit, isEnabled]);

  const setDailyRequestLimit = useCallback((limit: number): void => {
    if (limit < 1 || limit > GEMINI_FREE_TIER_DAILY_LIMIT) {
      setError(`Daily limit must be between 1 and ${GEMINI_FREE_TIER_DAILY_LIMIT.toLocaleString()}`);
      return;
    }

    saveDailyLimit(limit);
    setDailyRequestLimitState(limit);
    if (!apiKey || !isEnabled) return;
    try {
      activeProviderService.setDailyRequestLimit(limit);
    } catch (e) {
      console.error('Failed to set daily limit:', e);
    }
  }, [activeProviderService, apiKey, isEnabled]);

  const setEnabled = useCallback((enabled: boolean): void => {
    saveEnabled(enabled);
    setIsEnabledState(enabled);
    if (!enabled || !apiKey) return;
    try {
      activeProviderService.initialize(apiKey, model);
      activeProviderService.setDailyRequestLimit(dailyRequestLimit);
    } catch (e) {
      console.error('Failed to initialize AI service:', e);
      setError('Failed to enable AI features. Please check your API key.');
    }
  }, [activeProviderService, apiKey, dailyRequestLimit, model]);

  const executeAIRequest = useCallback(async (query: string, logIds?: number[], logs?: LogEntry[]): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        timestamp: Date.now(),
        logIds: logIds || (logs ? logs.map((log) => log.id) : undefined),
      };
      setConversationHistory((prev) => [...prev, userMessage]);

      const engineeredQuery = buildPromptFromTemplate(query, logs ?? []);
      let response: { content: string; logReferences: number[]; tokensUsed: number; model: string };

      if (logs && logs.length > 0) {
        if (logs.length > contextBuilder.HIERARCHICAL_THRESHOLD) {
          const chunks = contextBuilder.buildHierarchicalContext(logs, {
            maxTokens: 100000,
            prioritizeErrors: true,
            includeSurrounding: 5,
          });
          response = await activeProviderService.analyzeHierarchical(engineeredQuery, chunks, { model });
        } else {
          let logsForContext = logs;
          if (provider === 'gemini' && apiKey && logs.length > 1000) {
            try {
              embeddingService.initialize(apiKey);
              const candidates = logs.filter((log) => log.level === 'ERROR' || log.level === 'WARN' || log.level === 'INFO');
              const retrieved = await embeddingService.retrieveTopKByQuery(
                engineeredQuery,
                candidates.length > 0 ? candidates : logs,
                250
              );
              if (retrieved.length > 0) {
                logsForContext = retrieved;
              }
              embeddingService.indexLogFile(logs).catch((indexError) => {
                console.error('Background embedding index failed:', indexError);
              });
            } catch (embeddingError) {
              console.error('Embedding retrieval unavailable, using standard context selection:', embeddingError);
            }
          }

          const context = contextBuilder.buildContext(logsForContext, {
            maxTokens: 100000,
            prioritizeErrors: true,
            includeSurrounding: 5,
          });
          response = await activeProviderService.analyzeLog(engineeredQuery, context, { model });
        }
      } else {
        response = await activeProviderService.analyzeLog(engineeredQuery, '', { model });
      }

      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        logIds: response.logReferences,
      };
      setConversationHistory((prev) => [...prev, assistantMessage]);
      setUsageStatsState((prev) => ({
        ...prev,
        requestsToday: prev.requestsToday + 1,
        requestsThisMinute: prev.requestsThisMinute + 1,
        totalTokensUsed: prev.totalTokensUsed + response.tokensUsed,
        lastMinuteReset: Date.now(),
      }));
    } catch (e) {
      console.error('AI analysis error:', e);
      // Use e.name instead of instanceof to survive module-mock boundaries
      const errName = e instanceof Error ? e.name : '';
      if (errName === 'InvalidApiKeyError') {
        setError('Invalid API key. Please open AI Settings to update your key.');
      } else if (errName === 'RateLimitError') {
        const resetTime = (e as RateLimitError).resetTime ? new Date((e as RateLimitError).resetTime!).toLocaleTimeString() : 'about 1 minute';
        setError(`Too many requests. Please try again after ${resetTime}.`);
      } else if (errName === 'QuotaExceededError') {
        setError((e as Error).message);
        setShowQuotaExceededModal(true);
      } else if (errName === 'TokenLimitExceededError') {
        setError('Too many logs selected. Please filter to fewer logs and try again.');
      } else if (errName === 'NetworkError') {
        setError('Network error. Please check your connection and try again.');
      } else {
        const message = e instanceof Error ? e.message : '';
        setError(message.startsWith('Model unavailable') ? message : 'AI analysis failed. Check your connection and try again.');
      }
      setConversationHistory((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [activeProviderService, apiKey, contextBuilder, embeddingService, model, provider]);

  const consentToAI = useCallback((): void => {
    saveConsent(true);
    setHasConsentedToAI(true);
    setShowConsentModal(false);

    const pending = pendingAIRequest;
    setPendingAIRequest(null);
    if (!pending) return;

    if (usageStats.requestsToday >= dailyRequestLimit) {
      setError(`Daily limit reached (${dailyRequestLimit} requests). Try again tomorrow at midnight UTC.`);
      setShowQuotaExceededModal(true);
      return;
    }

    void executeAIRequest(pending.query, pending.logIds, pending.logs);
  }, [dailyRequestLimit, executeAIRequest, pendingAIRequest, usageStats.requestsToday]);

  const declineConsent = useCallback((): void => {
    setShowConsentModal(false);
    setPendingAIRequest(null);
  }, []);

  const dismissQuotaExceeded = useCallback((): void => {
    setShowQuotaExceededModal(false);
  }, []);

  const setOnboardingCompleted = useCallback((completed: boolean = true): void => {
    saveOnboardingCompleted(completed);
    setOnboardingCompletedState(completed);
  }, []);

  const askQuestion = useCallback(async (query: string, logIds?: number[], logs?: LogEntry[]): Promise<void> => {
    if (!apiKey) {
      setError('API key not configured. Please set your API key in settings.');
      return;
    }
    if (!isEnabled) {
      setError('AI features are disabled. Please enable them in settings.');
      return;
    }
    if (Array.isArray(logs) && logs.length === 0) {
      setError('No logs to analyze. Please load logs or adjust your filters first.');
      return;
    }
    if (usageStats.requestsToday >= dailyRequestLimit) {
      setError(`Daily limit reached (${dailyRequestLimit} requests). Try again tomorrow at midnight UTC.`);
      setShowQuotaExceededModal(true);
      return;
    }
    if (!hasConsentedToAI) {
      setPendingAIRequest({ query, logIds, logs });
      setShowConsentModal(true);
      return;
    }
    await executeAIRequest(query, logIds, logs);
  }, [apiKey, dailyRequestLimit, executeAIRequest, hasConsentedToAI, isEnabled, usageStats.requestsToday]);

  const clearHistory = useCallback((): void => {
    setConversationHistory([]);
    setError(null);
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const getUsageStats = useCallback((): AIUsageStats => usageStats, [usageStats]);

  const contextValue = useMemo<AIContextType>(() => ({
    isEnabled,
    apiKeyConfigured: !!apiKey,
    provider,
    model,
    conversationHistory,
    isLoading,
    error,
    usageStats,
    dailyRequestLimit,
    hasConsentedToAI,
    showConsentModal,
    showQuotaExceededModal,
    onboardingCompleted,
    askQuestion,
    setApiKey,
    setModel,
    setProvider,
    clearHistory,
    clearError,
    getUsageStats,
    setDailyRequestLimit,
    setEnabled,
    consentToAI,
    declineConsent,
    dismissQuotaExceeded,
    setOnboardingCompleted,
    similarPastTickets,
    setSimilarPastTickets,
  }), [
    apiKey,
    askQuestion,
    clearError,
    clearHistory,
    consentToAI,
    dailyRequestLimit,
    declineConsent,
    dismissQuotaExceeded,
    error,
    getUsageStats,
    hasConsentedToAI,
    isEnabled,
    isLoading,
    model,
    onboardingCompleted,
    provider,
    setApiKey,
    setDailyRequestLimit,
    setEnabled,
    setModel,
    setOnboardingCompleted,
    setProvider,
    setSimilarPastTickets,
    showConsentModal,
    showQuotaExceededModal,
    similarPastTickets,
    conversationHistory,
    usageStats,
  ]);

  return (
    <AIContext.Provider value={contextValue}>
      {children}
      {showConsentModal && <ConsentModal onClose={declineConsent} />}
      {showQuotaExceededModal && <QuotaExceededModal onClose={dismissQuotaExceeded} />}
    </AIContext.Provider>
  );
};
