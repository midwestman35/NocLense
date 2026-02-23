/**
 * AI Context - React Context for Gemini AI Integration
 * 
 * Purpose:
 * Manages global AI state including API configuration, conversation history,
 * usage statistics, and provides AI functionality to all components.
 * 
 * Architecture Decision:
 * Context API provides global state consistent with existing LogContext pattern.
 * This enables any component to access AI features without prop drilling and
 * maintains consistency with the rest of the NocLense architecture.
 * 
 * Key Features:
 * - API key management with localStorage persistence
 * - Model selection and configuration
 * - Conversation history management
 * - Usage statistics tracking (daily reset at midnight UTC)
 * - Integration with GeminiService for API calls
 * - Comprehensive error handling with user-friendly messages
 * 
 * State Management:
 * - API key: Persisted in localStorage (with security warnings)
 * - Model preference: Persisted in localStorage
 * - Usage stats: Persisted in localStorage, resets daily at midnight UTC
 * - Conversation history: In-memory (cleared on page refresh)
 * - Enabled state: Persisted in localStorage
 * 
 * Security Notes:
 * - API key stored in localStorage (not fully secure, visible in dev tools)
 * - Security warning shown to users in settings
 * - Future: Use Electron secure storage (electron-store) for production builds
 * - API key never logged to console
 * 
 * Dependencies:
 * - GeminiService: Singleton service for API calls
 * - LogContextBuilder: Formats logs for LLM
 * - Types from src/types/ai.ts
 * 
 * @module contexts/AIContext
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
  InvalidApiKeyError,
  RateLimitError,
  QuotaExceededError,
  TokenLimitExceededError,
  NetworkError,
} from '../types/ai';
import type { LogEntry } from '../types';
import ConsentModal from '../components/ConsentModal';
import QuotaExceededModal from '../components/QuotaExceededModal';

// localStorage keys
// Why: Centralized keys prevent typos and make it easy to change storage strategy
const STORAGE_KEY_API_KEY = 'noclense_ai_api_key';
const STORAGE_KEY_MODEL = 'noclense_ai_model';
const STORAGE_KEY_PROVIDER = 'noclense_ai_provider';
const STORAGE_KEY_ENABLED = 'noclense_ai_enabled';
const STORAGE_KEY_USAGE_STATS = 'noclense_ai_usage_stats';
const STORAGE_KEY_DAILY_LIMIT = 'noclense_ai_daily_limit';
const STORAGE_KEY_CONSENT = 'noclense_ai_consent';

// Default values
// Why: Use free tier max as default so users don't exceed without awareness
const DEFAULT_MODEL: AIConfig['model'] = DEFAULT_MODELS_BY_PROVIDER[DEFAULT_AI_PROVIDER];
const DEFAULT_DAILY_LIMIT = GEMINI_FREE_TIER_DAILY_LIMIT;
const DEFAULT_ENABLED = false; // Opt-in by default for privacy

/**
 * Load API key from localStorage
 * 
 * Why: Persists API key across sessions
 * Security: API key is visible in dev tools - show warning to users
 * 
 * @returns API key or null if not set
 */
function getApiKeyStorageKey(provider: AIProviderId): string {
  return `${STORAGE_KEY_API_KEY}_${provider}`;
}

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

function loadApiKey(provider: AIProviderId): string | null {
  try {
    const providerKey = localStorage.getItem(getApiKeyStorageKey(provider));
    if (providerKey) {
      return providerKey;
    }
    // Backward compatibility: legacy single-provider key maps to Gemini.
    if (provider === 'gemini') {
      return localStorage.getItem(STORAGE_KEY_API_KEY);
    }
    return null;
  } catch (e) {
    console.error('Failed to load API key from localStorage:', e);
    return null;
  }
}

/**
 * Save API key to localStorage
 * 
 * Why: Persists API key across sessions
 * Security: Not fully secure (XSS risk) - warn users
 * 
 * @param apiKey - API key to save
 */
function saveApiKey(provider: AIProviderId, apiKey: string): void {
  try {
    localStorage.setItem(getApiKeyStorageKey(provider), apiKey);
    if (provider === 'gemini') {
      localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
    }
  } catch (e) {
    console.error('Failed to save API key to localStorage:', e);
  }
}

/**
 * Load model preference from localStorage
 * 
 * Why: Remembers user's model choice across sessions
 * 
 * @returns Model ID or default
 */
function loadModel(provider: AIProviderId): AIConfig['model'] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    if (saved && AI_MODELS[saved]?.provider === provider) {
      return saved;
    }
    if (provider === 'gemini' && saved === 'gemini-1.5-flash') {
      saveModel('gemini', 'gemini-3-flash-preview');
      return 'gemini-3-flash-preview';
    }
  } catch (e) {
    console.error('Failed to load model from localStorage:', e);
  }
  return DEFAULT_MODELS_BY_PROVIDER[provider] ?? DEFAULT_MODEL;
}

/**
 * Save model preference to localStorage
 * 
 * @param model - Model ID to save
 */
function saveModel(_provider: AIProviderId, model: AIConfig['model']): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  } catch (e) {
    console.error('Failed to save model to localStorage:', e);
  }
}

/**
 * Load enabled state from localStorage
 * 
 * Why: Remembers if user has enabled AI features
 * 
 * @returns Enabled state or default (false)
 */
function loadEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ENABLED);
    return saved === 'true';
  } catch (e) {
    console.error('Failed to load enabled state from localStorage:', e);
    return DEFAULT_ENABLED;
  }
}

/**
 * Save enabled state to localStorage
 * 
 * @param enabled - Enabled state to save
 */
function saveEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  } catch (e) {
    console.error('Failed to save enabled state to localStorage:', e);
  }
}

/**
 * Load usage stats from localStorage
 * 
 * Why: Persists usage tracking across sessions
 * Daily reset: Checks if new day and resets if needed
 * 
 * @returns Usage stats with daily reset applied if needed
 */
function loadUsageStats(): AIUsageStats {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USAGE_STATS);
    if (saved) {
      const stats: AIUsageStats = JSON.parse(saved);
      
      // Check if we need to reset daily counter
      // Why: Daily limit resets at midnight UTC (per Gemini API)
      const now = Date.now();
      const lastReset = new Date(stats.lastDailyReset);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      // If last reset was before today (UTC), reset daily counter
      if (lastReset < today) {
        const resetStats: AIUsageStats = {
          requestsToday: 0,
          requestsThisMinute: 0,
          totalTokensUsed: stats.totalTokensUsed, // Keep cumulative total
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
  
  // Return default stats
  const now = Date.now();
  return {
    requestsToday: 0,
    requestsThisMinute: 0,
    totalTokensUsed: 0,
    lastDailyReset: now,
    lastMinuteReset: now,
  };
}

/**
 * Save usage stats to localStorage
 * 
 * @param stats - Usage stats to save
 */
function saveUsageStats(stats: AIUsageStats): void {
  try {
    localStorage.setItem(STORAGE_KEY_USAGE_STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save usage stats to localStorage:', e);
  }
}

/**
 * Load daily request limit from localStorage
 * 
 * Why: Allows users to set lower limit than free tier for budget control
 * 
 * @returns Daily limit or default (GEMINI_FREE_TIER_DAILY_LIMIT)
 */
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

/**
 * Save daily request limit to localStorage
 * 
 * @param limit - Daily limit to save
 */
function saveDailyLimit(limit: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_LIMIT, String(limit));
  } catch (e) {
    console.error('Failed to save daily limit to localStorage:', e);
  }
}

/**
 * Load AI consent from localStorage
 *
 * Why: Phase 7 - Consent modal shown once; persist choice to avoid repeated prompts
 * Security: User must explicitly agree before any log data is sent to Google
 *
 * @returns true if user has previously consented, false otherwise
 */
function loadConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_CONSENT) === 'true';
  } catch (e) {
    console.error('Failed to load consent from localStorage:', e);
    return false;
  }
}

/**
 * Save AI consent to localStorage
 *
 * Why: Persists user's consent choice across sessions
 *
 * @param consented - Whether user consented to send log data to Google
 */
function saveConsent(consented: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONSENT, String(consented));
  } catch (e) {
    console.error('Failed to save consent to localStorage:', e);
  }
}

/** Pending AI request stored when user has not yet consented */
interface PendingAIRequest {
  query: string;
  logIds?: number[];
  logs?: LogEntry[];
}

/**
 * AI Context Type
 * 
 * Why: Defines the contract for AI functionality available to components
 * Separates state from actions for clarity
 */
interface AIContextType {
  // State
  /** Whether AI features are enabled (user preference) */
  isEnabled: boolean;
  /** Whether API key is configured */
  apiKeyConfigured: boolean;
  /** Active AI provider */
  provider: AIProviderId;
  /** Currently selected model */
  model: AIConfig['model'];
  /** Conversation history (user + assistant messages) */
  conversationHistory: AIMessage[];
  /** Whether an AI request is currently in progress */
  isLoading: boolean;
  /** Current error message (null if no error) */
  error: string | null;
  /** API usage statistics */
  usageStats: AIUsageStats;
  /** Daily request limit (user-configurable) */
  dailyRequestLimit: number;
  /** Whether user has consented to send log data to Google (Phase 7) */
  hasConsentedToAI: boolean;
  /** Whether consent modal is visible (shown before first AI query) */
  showConsentModal: boolean;
  /** Whether quota exceeded modal is visible (shown when daily limit hit) */
  showQuotaExceededModal: boolean;
  
  // Actions
  /** Ask a question to the AI with optional log context */
  askQuestion: (query: string, logIds?: number[], logs?: LogEntry[]) => Promise<void>;
  /** Set and validate API key */
  setApiKey: (key: string) => Promise<boolean>;
  /** Set model preference */
  setModel: (model: AIConfig['model']) => void;
  /** Set active provider */
  setProvider: (provider: AIProviderId) => void;
  /** Clear conversation history */
  clearHistory: () => void;
  /** Clear current error (dismiss error banner) */
  clearError: () => void;
  /** Get current usage statistics */
  getUsageStats: () => AIUsageStats;
  /** Set daily request limit */
  setDailyRequestLimit: (limit: number) => void;
  /** Enable or disable AI features */
  setEnabled: (enabled: boolean) => void;
  /** User consented to send log data to Google - executes pending request if any */
  consentToAI: () => void;
  /** User declined - dismiss consent modal, clear pending request */
  declineConsent: () => void;
  /** Dismiss quota exceeded modal */
  dismissQuotaExceeded: () => void;
}

const AIContext = createContext<AIContextType | null>(null);

/**
 * useAI Hook
 * 
 * Why: Provides convenient access to AI context
 * Throws error if used outside provider (prevents silent failures)
 * 
 * @returns AIContextType - AI context value
 * @throws Error if used outside AIProvider
 */
export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};

/**
 * AI Provider Component
 * 
 * Why: Provides AI functionality to all child components
 * Manages state, persistence, and API integration
 * 
 * Architecture:
 * - Initializes state from localStorage on mount
 * - Persists changes to localStorage on updates
 * - Integrates with GeminiService for API calls
 * - Handles errors gracefully with user-friendly messages
 */
export const AIProvider = ({ children }: { children: ReactNode }) => {
  // Initialize state from localStorage
  // Why: Restore user preferences and config across sessions
  const [provider, setProviderState] = useState<AIProviderId>(() => loadProvider());
  const [apiKeys, setApiKeysState] = useState<Partial<Record<AIProviderId, string>>>(() => ({
    gemini: loadApiKey('gemini') ?? undefined,
    claude: loadApiKey('claude') ?? undefined,
    codex: loadApiKey('codex') ?? undefined,
  }));
  const [model, setModelState] = useState<AIConfig['model']>(() => loadModel(loadProvider()));
  const [isEnabled, setIsEnabledState] = useState<boolean>(() => loadEnabled());
  const [dailyRequestLimit, setDailyRequestLimitState] = useState<number>(() => loadDailyLimit());
  const [usageStats, setUsageStatsState] = useState<AIUsageStats>(() => loadUsageStats());
  
  // Phase 7: Consent state - persist user's choice before first AI query
  const [hasConsentedToAI, setHasConsentedToAI] = useState<boolean>(() => loadConsent());
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [pendingAIRequest, setPendingAIRequest] = useState<PendingAIRequest | null>(null);
  const [showQuotaExceededModal, setShowQuotaExceededModal] = useState<boolean>(false);
  
  // In-memory state (not persisted)
  // Why: Conversation history is session-only (cleared on refresh)
  // This keeps localStorage clean and prevents privacy concerns
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get GeminiService instance
  // Why: Singleton pattern ensures single API client
  const activeProviderService = useMemo(() => providerRegistry.getProvider(provider), [provider]);
  const contextBuilder = useMemo(() => new LogContextBuilder(), []);
  const embeddingService = useMemo(() => new EmbeddingService(), []);
  const apiKey = apiKeys[provider] ?? null;
  
  // Initialize active provider service when API key is available
  // Why: Lazy initialization - only create API client when needed
  useEffect(() => {
    if (apiKey && isEnabled) {
      try {
        activeProviderService.initialize(apiKey, model);
        activeProviderService.setDailyRequestLimit(dailyRequestLimit);
      } catch (e) {
        console.error('Failed to initialize AI provider service:', e);
        setError('Failed to initialize AI service. Please check your API key.');
      }
    }
  }, [apiKey, model, isEnabled, dailyRequestLimit, activeProviderService]);
  
  // Persist usage stats to localStorage when they change
  // Why: Keep usage tracking persistent across sessions
  useEffect(() => {
    saveUsageStats(usageStats);
  }, [usageStats]);
  
  // Check for daily reset periodically
  // Why: Daily limit resets at midnight UTC - check every minute
  useEffect(() => {
    const checkDailyReset = () => {
      const stats = loadUsageStats();
      if (stats.requestsToday !== usageStats.requestsToday) {
        setUsageStatsState(stats);
      }
    };
    
    const interval = setInterval(checkDailyReset, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [usageStats.requestsToday]);
  
  /**
   * Set API key and validate it
   * 
   * Why: Validates API key before saving to prevent user frustration
   * Shows clear error messages if validation fails
   * 
   * @param key - API key to set
   * @returns Promise<boolean> - True if valid and saved, false otherwise
   */
  const setApiKey = useCallback(async (key: string): Promise<boolean> => {
    setError(null);
    
    if (!key || key.trim().length === 0) {
      setError('API key is required');
      return false;
    }
    
    try {
      // Validate API key by making test request
      // Why: Prevents saving invalid keys that would fail later
      const isValid = await activeProviderService.validateApiKey(key);
      
      if (!isValid) {
        setError('Invalid API key. Please check your API key and try again.');
        return false;
      }
      
      // Save API key
      saveApiKey(provider, key);
      setApiKeysState(prev => ({ ...prev, [provider]: key }));
      
      // Initialize service with new key
      activeProviderService.initialize(key, model);
      activeProviderService.setDailyRequestLimit(dailyRequestLimit);
      
      return true;
    } catch (e) {
      console.error('API key validation error:', e);
      setError('Failed to validate API key. Please check your connection and try again.');
      return false;
    }
  }, [activeProviderService, dailyRequestLimit, model, provider]);
  
  /**
   * Set model preference
   * 
   * Why: Allows users to choose between speed (Flash) and quality (Pro)
   * 
   * @param newModel - Model ID to use
   */
  const setModel = useCallback((newModel: AIConfig['model']): void => {
    saveModel(provider, newModel);
    setModelState(newModel);
    
    // Reinitialize service with new model if API key is set
    if (apiKey && isEnabled) {
      try {
        activeProviderService.initialize(apiKey, newModel);
      } catch (e) {
        console.error('Failed to reinitialize with new model:', e);
        setError('Failed to switch model. Please try again.');
      }
    }
  }, [activeProviderService, apiKey, isEnabled, provider]);

  /**
   * Switch active provider and load provider-scoped defaults.
   */
  const setProvider = useCallback((newProvider: AIProviderId): void => {
    saveProvider(newProvider);
    setProviderState(newProvider);
    setError(null);
    const nextModel = loadModel(newProvider);
    setModelState(nextModel);

    const nextApiKey = loadApiKey(newProvider);
    if (nextApiKey && isEnabled) {
      try {
        const nextProviderService = providerRegistry.getProvider(newProvider);
        nextProviderService.initialize(nextApiKey, nextModel);
        nextProviderService.setDailyRequestLimit(dailyRequestLimit);
      } catch (e) {
        console.error('Failed to initialize selected provider:', e);
        setError('Failed to initialize provider. Verify API key and model settings.');
      }
    }
  }, [dailyRequestLimit, isEnabled]);
  
  /**
   * Set daily request limit
   * 
   * Why: Allows users to set lower limit than free tier for budget control
   * 
   * @param limit - Daily limit (1-1500)
   */
  const setDailyRequestLimit = useCallback((limit: number): void => {
    if (limit < 1 || limit > GEMINI_FREE_TIER_DAILY_LIMIT) {
      setError(`Daily limit must be between 1 and ${GEMINI_FREE_TIER_DAILY_LIMIT.toLocaleString()}`);
      return;
    }
    
    saveDailyLimit(limit);
    setDailyRequestLimitState(limit);
    
    // Update service limit
    if (apiKey && isEnabled) {
      try {
        activeProviderService.setDailyRequestLimit(limit);
      } catch (e) {
        console.error('Failed to set daily limit:', e);
      }
    }
  }, [activeProviderService, apiKey, isEnabled]);
  
  /**
   * Enable or disable AI features
   * 
   * Why: Privacy control - users can disable AI features entirely
   * 
   * @param enabled - Whether to enable AI features
   */
  const setEnabled = useCallback((enabled: boolean): void => {
    saveEnabled(enabled);
    setIsEnabledState(enabled);
    
    // Initialize service if enabling and API key is set
    if (enabled && apiKey) {
      try {
        activeProviderService.initialize(apiKey, model);
        activeProviderService.setDailyRequestLimit(dailyRequestLimit);
      } catch (e) {
        console.error('Failed to initialize AI service:', e);
        setError('Failed to enable AI features. Please check your API key.');
      }
    }
  }, [activeProviderService, apiKey, dailyRequestLimit, model]);
  
  /**
   * Execute AI analysis request (internal)
   *
   * Why: Extracted for Phase 7 consent flow - called after user consents or when already consented
   * Contains the core API call logic without consent check
   *
   * @param query - User's question or analysis request
   * @param logIds - Optional: Specific log IDs to analyze
   * @param logs - Optional: Pre-filtered logs to analyze
   */
  const executeAIRequest = useCallback(async (
    query: string,
    logIds?: number[],
    logs?: LogEntry[]
  ): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        timestamp: Date.now(),
        logIds: logIds || (logs ? logs.map(l => l.id) : undefined),
      };

      setConversationHistory(prev => [...prev, userMessage]);

      let context = '';
      let response: {
        content: string;
        logReferences: number[];
        tokensUsed: number;
        model: string;
      };
      const logsForPrompt = logs ?? [];
      const engineeredQuery = buildPromptFromTemplate(query, logsForPrompt);
      if (logs && logs.length > 0) {
        try {
          const isHierarchical = logs.length > contextBuilder.HIERARCHICAL_THRESHOLD;
          if (isHierarchical) {
            const chunks = contextBuilder.buildHierarchicalContext(logs, {
              maxTokens: 100000,
              prioritizeErrors: true,
              includeSurrounding: 5,
            });
            response = await activeProviderService.analyzeHierarchical(engineeredQuery, chunks, { model });
          } else {
            let logsForContext = logs;

            // Why: retrieval trims medium-large selections to semantically relevant logs.
            if (provider === 'gemini' && apiKey && logs.length > 1000) {
              try {
                embeddingService.initialize(apiKey);
                const candidates = logs.filter(log => log.level === 'ERROR' || log.level === 'WARN' || log.level === 'INFO');
                const retrieved = await embeddingService.retrieveTopKByQuery(
                  engineeredQuery,
                  candidates.length > 0 ? candidates : logs,
                  250
                );
                if (retrieved.length > 0) {
                  logsForContext = retrieved;
                }
                // Background indexing for future queries; non-blocking by design.
                embeddingService.indexLogFile(logs).catch((indexError) => {
                  console.error('Background embedding index failed:', indexError);
                });
              } catch (embeddingError) {
                console.error('Embedding retrieval unavailable, using standard context selection:', embeddingError);
              }
            }

            context = contextBuilder.buildContext(logsForContext, {
              maxTokens: 100000,
              prioritizeErrors: true,
              includeSurrounding: 5,
            });
            response = await activeProviderService.analyzeLog(engineeredQuery, context, { model });
          }
        } catch (e) {
          console.error('Failed to build context:', e);
          setError('Failed to prepare logs for analysis. Please try again.');
          setIsLoading(false);
          return;
        }
      } else {
        response = await activeProviderService.analyzeLog(engineeredQuery, context, { model });
      }

      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        logIds: response.logReferences,
      };

      setConversationHistory(prev => [...prev, assistantMessage]);

      setUsageStatsState(prev => ({
        ...prev,
        requestsToday: prev.requestsToday + 1,
        requestsThisMinute: prev.requestsThisMinute + 1,
        totalTokensUsed: prev.totalTokensUsed + response.tokensUsed,
        lastMinuteReset: Date.now(),
      }));
    } catch (e) {
      console.error('AI analysis error:', e);
      if (e instanceof InvalidApiKeyError) {
        setError('Invalid API key. Please open AI Settings to update your key.');
      } else if (e instanceof RateLimitError) {
        const resetTime = e.resetTime ? new Date(e.resetTime).toLocaleTimeString() : 'about 1 minute';
        setError(`Too many requests. Please try again after ${resetTime}.`);
      } else if (e instanceof QuotaExceededError) {
        setError(e.message);
        setShowQuotaExceededModal(true);
      } else if (e instanceof TokenLimitExceededError) {
        setError('Too many logs selected. Please filter to fewer logs and try again.');
      } else if (e instanceof NetworkError) {
        setError('Network error. Please check your connection and try again.');
      } else {
        const msg = e instanceof Error ? e.message : '';
        setError(msg.startsWith('Model unavailable') ? msg : 'AI analysis failed. Check your connection and try again.');
      }
      setConversationHistory(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [activeProviderService, apiKey, contextBuilder, embeddingService, model, provider]);

  /**
   * Phase 7: User consented - save choice, hide modal, execute pending request if any
   */
  const consentToAI = useCallback((): void => {
    saveConsent(true);
    setHasConsentedToAI(true);
    setShowConsentModal(false);

    const pending = pendingAIRequest;
    setPendingAIRequest(null);

    if (pending) {
      // Check quota before executing - user may have hit limit while modal was open
      if (usageStats.requestsToday >= dailyRequestLimit) {
        setError(`Daily limit reached (${dailyRequestLimit} requests). Try again tomorrow at midnight UTC.`);
        setShowQuotaExceededModal(true);
      } else {
        executeAIRequest(pending.query, pending.logIds, pending.logs);
      }
    }
  }, [pendingAIRequest, usageStats.requestsToday, dailyRequestLimit, executeAIRequest]);

  /**
   * Phase 7: User declined - dismiss modal, clear pending request
   */
  const declineConsent = useCallback((): void => {
    setShowConsentModal(false);
    setPendingAIRequest(null);
  }, []);

  /** Dismiss quota exceeded modal when user acknowledges */
  const dismissQuotaExceeded = useCallback((): void => {
    setShowQuotaExceededModal(false);
  }, []);

  /**
   * Ask a question to the AI
   *
   * Why: Main entry point for AI analysis
   * Phase 7: Gates first AI query behind consent modal
   *
   * Flow:
   * 1. Validate API key, enabled state, logs
   * 2. Phase 7: If not consented, show consent modal and store pending request
   * 3. Otherwise execute AI request
   *
   * @param query - User's question or analysis request
   * @param logIds - Optional: Specific log IDs to analyze
   * @param logs - Optional: Pre-filtered logs to analyze (if not provided, will be empty)
   */
  const askQuestion = useCallback(async (
    query: string,
    logIds?: number[],
    logs?: LogEntry[]
  ): Promise<void> => {
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

    // Daily limit check - show quota modal before attempting request
    if (usageStats.requestsToday >= dailyRequestLimit) {
      setError(`Daily limit reached (${dailyRequestLimit} requests). Try again tomorrow at midnight UTC.`);
      setShowQuotaExceededModal(true);
      return;
    }

    // Phase 7: Consent modal before first AI query
    if (!hasConsentedToAI) {
      setPendingAIRequest({ query, logIds, logs });
      setShowConsentModal(true);
      return;
    }

    await executeAIRequest(query, logIds, logs);
  }, [apiKey, isEnabled, hasConsentedToAI, usageStats.requestsToday, dailyRequestLimit, executeAIRequest]);
  
  /**
   * Clear conversation history
   * 
   * Why: Allows users to start fresh conversation
   */
  const clearHistory = useCallback((): void => {
    setConversationHistory([]);
    setError(null);
  }, []);

  /** Clear error only - allows retry without losing conversation history */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);
  
  /**
   * Get current usage statistics
   * 
   * Why: Provides current usage stats to components
   * 
   * @returns Current usage statistics
   */
  const getUsageStats = useCallback((): AIUsageStats => {
    return usageStats;
  }, [usageStats]);
  
  // Memoize context value to prevent unnecessary re-renders
  // Why: Without memoization, context value is recreated on every render
  // causing all consuming components to re-render unnecessarily
  const contextValue = useMemo<AIContextType>(() => ({
    // State
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
    // Actions
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
  }), [
    isEnabled,
    apiKey,
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
  ]);
  
  return (
    <AIContext.Provider value={contextValue}>
      {children}
      {/* Phase 7: Consent modal before first AI query */}
      {showConsentModal && (
        <ConsentModal onClose={declineConsent} />
      )}
      {/* Quota exceeded modal - when daily limit hit */}
      {showQuotaExceededModal && (
        <QuotaExceededModal onClose={dismissQuotaExceeded} />
      )}
    </AIContext.Provider>
  );
};
