/**
 * Maximum daily requests for Gemini API free tier.
 * Used as default limit so users don't accidentally exceed without awareness.
 * See: https://ai.google.dev/gemini-api/docs/rate-limits
 */
export const GEMINI_FREE_TIER_DAILY_LIMIT = 1500;

/**
 * Supported LLM providers.
 */
export type AIProviderId = 'gemini' | 'claude' | 'codex';

/**
 * Default provider used for first-run and migration paths.
 */
export const DEFAULT_AI_PROVIDER: AIProviderId = 'gemini';

/**
 * AI Integration Type Definitions
 * 
 * Purpose:
 * TypeScript type definitions for Google Gemini AI integration in NocLense.
 * These types define the structure for AI messages, configuration, requests, responses,
 * and usage tracking.
 * 
 * Architecture Decision:
 * Separate AI types from core log types to maintain clear separation of concerns.
 * This allows AI features to evolve independently and makes the API contract explicit.
 * 
 * Key Types:
 * - AIMessage: Chat conversation messages
 * - AIConfig: User configuration (API key, model, limits)
 * - AIAnalysisRequest/Response: Request/response structures for log analysis
 * - AIUsageStats: API usage tracking for quota management
 * 
 * @module types/ai
 */

import type { LogEntry } from '../types';

/**
 * Represents a message in the AI conversation
 * 
 * Why: Enables chat-style interaction with conversation history.
 * This allows users to ask follow-up questions and maintain context across queries.
 * 
 * Design decisions:
 * - id: Unique identifier for React key prop and message tracking
 * - role: Distinguishes user queries from AI responses
 * - timestamp: Enables chronological ordering and time-based filtering
 * - logIds: Optional association with specific logs provides context for the conversation
 */
export interface AIMessage {
  /** Unique identifier for this message */
  id: string;
  /** Role of the message sender */
  role: 'user' | 'assistant';
  /** Message content (user query or AI response) */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Optional: Associated log IDs that were analyzed in this conversation */
  logIds?: number[];
}

/**
 * Configuration for AI service
 * 
 * Why: Allows users to control API usage, costs, and model selection.
 * This gives users control over their API consumption and enables different
 * quality/speed trade-offs via model selection.
 * 
 * Design decisions:
 * - apiKey: Required for API access (stored securely with warnings)
 * - model: Different models offer different speed/quality trade-offs
 * - dailyRequestLimit: Allows users to set lower limits than free tier for budget control
 * - enabled: Privacy control - users can disable AI features entirely
 */
export interface AIConfig {
  /** Active provider API key (required for AI features) */
  apiKey: string;
  /** Selected LLM provider */
  provider: AIProviderId;
  /** Model id for the selected provider */
  model: string;
  /** Optional provider-scoped API key map (for multi-provider setups) */
  providerApiKeys?: Partial<Record<AIProviderId, string>>;
  /** 
   * Maximum requests per day (free tier limit is 1,500 RPD)
   * Allows users to set lower limit for budget control
   */
  dailyRequestLimit: number;
  /** Enable/disable AI features (respects user privacy preferences) */
  enabled: boolean;
  /** Embedding model ID for semantic retrieval (defaults to 'gemini-embedding-2-preview') */
  embeddingModel?: string;
}

/**
 * Request structure for analyzing logs with AI
 * 
 * Why: Structured request format ensures all necessary context is provided.
 * Separates user query from log data and options for better organization.
 * 
 * Design decisions:
 * - query: User's question or analysis request
 * - logs: Pre-filtered logs to analyze (not all logs, just relevant ones)
 * - focusLogId: Optional focus on specific log for detailed analysis
 * - includeCorrelations: Whether to include correlated logs for context
 */
export interface AIAnalysisRequest {
  /** User's question or analysis request */
  query: string;
  /** Pre-filtered logs to analyze (should be relevant subset, not all logs) */
  logs: LogEntry[];
  /** Optional: Focus analysis on specific log ID */
  focusLogId?: number;
  /** Whether to include correlated logs for additional context */
  includeCorrelations?: boolean;
  /** Maximum tokens to use for context (default: 100,000) */
  maxContextTokens?: number;
}

/**
 * Response structure from AI analysis
 * 
 * Why: Structured response enables consistent UI rendering and parsing.
 * Separates content from metadata for better handling.
 * 
 * Design decisions:
 * - content: Main response text (markdown formatted)
 * - logReferences: Specific log IDs referenced in the response
 * - confidence: Optional confidence score (if API provides)
 * - tokensUsed: Track token usage for quota management
 */
export interface AIAnalysisResponse {
  /** AI response content (markdown formatted for rich display) */
  content: string;
  /** Log IDs referenced in the response (for linking back to logs) */
  logReferences: number[];
  /** Optional confidence score (0-1) if provided by API */
  confidence?: number;
  /** Number of tokens used for this request (for usage tracking) */
  tokensUsed: number;
  /** Model used for this response */
  model: string;
}

/**
 * API usage statistics for quota management
 * 
 * Why: Track API usage to prevent quota exhaustion and provide user feedback.
 * Free tier has limits (15 RPM, 1,500 RPD) that must be monitored.
 * 
 * Design decisions:
 * - requestsToday: Track daily usage (resets at midnight UTC)
 * - requestsThisMinute: Track per-minute usage (for rate limiting)
 * - totalTokensUsed: Cumulative token usage for cost estimation
 * - lastReset: Timestamp of last reset (for accurate tracking)
 */
export interface AIUsageStats {
  /** Number of requests made today (resets at midnight UTC) */
  requestsToday: number;
  /** Number of requests in current minute (for rate limiting) */
  requestsThisMinute: number;
  /** Total tokens used across all requests */
  totalTokensUsed: number;
  /** Timestamp of last daily reset (milliseconds) */
  lastDailyReset: number;
  /** Timestamp of last minute reset (milliseconds) */
  lastMinuteReset: number;
}

/**
 * Options for building log context for LLM
 * 
 * Why: Provides fine-grained control over context building process.
 * Different analysis scenarios need different context strategies.
 * 
 * Design decisions:
 * - focusLogId: Center context around specific log
 * - maxTokens: Hard limit to prevent exceeding API limits
 * - includeSurrounding: How many logs before/after errors to include
 * - prioritizeErrors: Whether to prioritize ERROR/WARN logs
 */
export interface ContextOptions {
  /** Optional: Focus context around specific log ID */
  focusLogId?: number;
  /** Maximum tokens to use for context (default: 100,000) */
  maxTokens?: number;
  /** Number of surrounding logs to include before/after errors (default: 5) */
  includeSurrounding?: number;
  /** Whether to prioritize ERROR and WARN level logs (default: true) */
  prioritizeErrors?: boolean;
  /** Whether to include log payloads (default: true, set false for privacy) */
  includePayloads?: boolean;
  /** User query used by retrieval-based context selection */
  query?: string;
}

/**
 * One hierarchical context chunk for two-pass analysis.
 */
export interface HierarchicalContextChunk {
  timeWindow: string;
  context: string;
}

/**
 * Error types for AI service
 * 
 * Why: Custom error classes enable type-safe error handling and user-friendly messages.
 * Different error types require different handling strategies.
 */
export class InvalidApiKeyError extends Error {
  constructor(message: string = 'Invalid API key. Please check your settings.') {
    super(message);
    this.name = 'InvalidApiKeyError';
  }
}

export class RateLimitError extends Error {
  public readonly resetTime?: number;
  constructor(
    message: string = 'Rate limit exceeded. Please try again later.',
    resetTime?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string = 'Daily quota exceeded. Free tier allows 1,500 requests per day.') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class TokenLimitExceededError extends Error {
  public readonly maxTokens?: number;
  public readonly requestedTokens?: number;
  constructor(
    message: string = 'Context too large. Please select fewer logs.',
    maxTokens?: number,
    requestedTokens?: number
  ) {
    super(message);
    this.name = 'TokenLimitExceededError';
    this.maxTokens = maxTokens;
    this.requestedTokens = requestedTokens;
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Model information for display and selection
 * 
 * Why: Provides metadata about available models for UI display.
 * Helps users understand trade-offs between models.
 */
export interface AIModelInfo {
  /** Model identifier */
  id: string;
  /** Provider identifier */
  provider: AIProviderId;
  /** Display name */
  name: string;
  /** Description of model capabilities */
  description: string;
  /** Speed characteristic */
  speed: 'fast' | 'medium' | 'slow';
  /** Quality characteristic */
  quality: 'good' | 'excellent' | 'best';
  /** Context window size in tokens */
  contextWindow: number;
}

/**
 * Provider metadata for UI selection/help links.
 */
export interface AIProviderInfo {
  id: AIProviderId;
  name: string;
  keyLabel: string;
  helpUrl: string;
  privacyNoticeName: string;
}

/**
 * Known providers and UX metadata.
 */
export const AI_PROVIDERS: Record<AIProviderId, AIProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    keyLabel: 'Google Gemini API Key',
    helpUrl: 'https://ai.google.dev',
    privacyNoticeName: 'Google',
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    keyLabel: 'Anthropic API Key',
    helpUrl: 'https://console.anthropic.com',
    privacyNoticeName: 'Anthropic',
  },
  codex: {
    id: 'codex',
    name: 'ChatGPT (OpenAI)',
    keyLabel: 'OpenAI API Key',
    helpUrl: 'https://platform.openai.com/api-keys',
    privacyNoticeName: 'OpenAI',
  },
} as const;

/**
 * Predefined model information
 * 
 * Why: Centralized model metadata for consistent UI display.
 * Makes it easy to add new models or update descriptions.
 */
export const AI_MODELS: Record<string, AIModelInfo> = {
  'gemini-3.1-flash-lite-preview': {
    id: 'gemini-3.1-flash-lite-preview',
    provider: 'gemini',
    name: 'Gemini 3.1 Flash-Lite',
    description: 'Recommended: Fastest 3.1 model, 1M context, low latency',
    speed: 'fast',
    quality: 'excellent',
    contextWindow: 1000000,
  },
  'gemini-3-flash-preview': {
    id: 'gemini-3-flash-preview',
    provider: 'gemini',
    name: 'Gemini 3 Flash',
    description: 'Stable: Well-tested, production-ready fallback',
    speed: 'fast',
    quality: 'excellent',
    contextWindow: 1000000,
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    provider: 'gemini',
    name: 'Gemini 3.1 Pro',
    description: 'Most capable: Advanced reasoning for complex log analysis',
    speed: 'medium',
    quality: 'best',
    contextWindow: 1000000,
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    provider: 'claude',
    name: 'Claude Sonnet 4.6',
    description: 'Best combination of speed and intelligence',
    speed: 'fast',
    quality: 'excellent',
    contextWindow: 200000,
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    provider: 'claude',
    name: 'Claude Haiku 4.5',
    description: 'Fastest model with near-frontier intelligence',
    speed: 'fast',
    quality: 'good',
    contextWindow: 200000,
  },
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    provider: 'claude',
    name: 'Claude Opus 4.6',
    description: 'Most intelligent model for complex analysis',
    speed: 'medium',
    quality: 'best',
    contextWindow: 200000,
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    provider: 'codex',
    name: 'GPT-4.1',
    description: 'High-capability OpenAI model for complex analysis',
    speed: 'medium',
    quality: 'best',
    contextWindow: 128000,
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    provider: 'codex',
    name: 'GPT-4.1 Mini',
    description: 'Faster OpenAI model for routine analysis',
    speed: 'fast',
    quality: 'good',
    contextWindow: 128000,
  },
} as const;

/**
 * Provider default models.
 */
export const DEFAULT_MODELS_BY_PROVIDER: Record<AIProviderId, string> = {
  gemini: 'gemini-3.1-flash-lite-preview',
  claude: 'claude-sonnet-4-6',
  codex: 'gpt-4.1-mini',
};

/**
 * Helper to return only models for one provider.
 */
export function getModelsForProvider(provider: AIProviderId): AIModelInfo[] {
  return Object.values(AI_MODELS).filter((model) => model.provider === provider);
}
