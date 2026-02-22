/**
 * LLM Service - Google Gemini Integration
 * 
 * Purpose:
 * Manages all interactions with Google Gemini API including initialization,
 * request/response handling, rate limiting, and error management.
 * 
 * Architecture Decision:
 * Singleton pattern ensures single API client instance across the app,
 * which is necessary for accurate rate limiting and quota tracking.
 * This prevents multiple concurrent API connections and simplifies state management.
 * 
 * Key Features:
 * - Rate limiting (15 RPM, 1,500 RPD for free tier)
 * - Automatic retry with exponential backoff for transient failures
 * - Token estimation and context optimization
 * - Response streaming for better UX
 * - Comprehensive error handling with user-friendly messages
 * 
 * Dependencies:
 * - @google/generative-ai: Official Google SDK for Gemini API
 * - logContextBuilder: Formats logs for LLM (will be created in Phase 1.4)
 * 
 * Security Notes:
 * - API key is passed at initialization (stored securely by caller)
 * - API key is never logged to console
 * - All API calls use HTTPS
 * 
 * @module services/llmService
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import {
  GEMINI_FREE_TIER_DAILY_LIMIT,
  InvalidApiKeyError,
  RateLimitError,
  QuotaExceededError,
  TokenLimitExceededError,
  NetworkError,
  type AIUsageStats,
  type HierarchicalContextChunk,
} from '../types/ai';

/**
 * Singleton service for managing Gemini AI interactions
 * 
 * Why Singleton?
 * - Ensures single API client instance across the app
 * - Centralizes rate limiting and usage tracking
 * - Prevents multiple concurrent API connections
 * - Simplifies state management for API quota
 * 
 * Alternative considered: Multiple instances
 * - Rejected because rate limiting would be inaccurate across instances
 * - Would require shared state (localStorage) which adds complexity
 */
export class GeminiService {
  private static instance: GeminiService;
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private currentModelId: string = 'gemini-3-flash-preview';
  
  // Rate limiting state
  // Why: Free tier has 15 RPM, 1,500 RPD limits - must track to avoid quota errors
  // Trade-off: In-memory tracking means limits reset on app restart (acceptable for this use case)
  private requestsThisMinute: number = 0;
  private requestsToday: number = 0;
  private lastMinuteReset: number = Date.now();
  private lastDayReset: number = Date.now();
  
  // Usage tracking
  private totalTokensUsed: number = 0;
  
  // Configuration
  private dailyRequestLimit: number = GEMINI_FREE_TIER_DAILY_LIMIT;
  
  /**
   * Get singleton instance
   * 
   * Why: Ensures only one service instance exists
   * Pattern: Standard singleton implementation
   */
  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }
  
  /**
   * Initialize the Gemini client with API key
   * 
   * Why: Separate initialization allows lazy setup (only when user enables AI)
   * This prevents unnecessary API client creation if AI features are disabled.
   * 
   * @param apiKey - Google Gemini API key
   * @param model - Model to use (default: 'gemini-3-flash-preview')
   * @throws InvalidApiKeyError - If API key is empty or invalid format
   */
  public initialize(apiKey: string, model: string = 'gemini-3-flash-preview'): void {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new InvalidApiKeyError('API key is required');
    }
    
    // Basic validation: API keys typically start with specific prefixes
    // Note: Full validation happens on first API call
    if (apiKey.length < 20) {
      throw new InvalidApiKeyError('API key appears to be invalid');
    }
    
    this.client = new GoogleGenerativeAI(apiKey);
    this.currentModelId = model;
    this.model = this.client.getGenerativeModel({ model });
    this.resetPromptCache();
    
    // Reset rate limiting on new initialization (user may have changed API key)
    this.resetRateLimits();
  }
  
  /**
   * Validate API key by making a test request
   * 
   * Why: Validates API key before saving to prevent user frustration.
   * Uses minimal token request to keep validation fast and cheap.
   * 
   * @param apiKey - API key to validate
   * @returns Promise<boolean> - True if valid, false otherwise
   */
  public async validateApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }
    
    try {
      const testClient = new GoogleGenerativeAI(apiKey);
      // Use gemini-3-flash-preview for validation; 2.0-flash no longer available to new users
      const testModel = testClient.getGenerativeModel({ model: 'gemini-3-flash-preview' });
      
      // Minimal test request (just "test" prompt)
      const result = await testModel.generateContent('test');
      return result.response !== null;
    } catch (error) {
      // Log error for debugging but don't expose to user
      console.error('API key validation failed:', error);
      return false;
    }
  }
  
  /**
   * Check and enforce rate limits
   * 
   * RATE LIMITING STRATEGY:
   * Why: Free tier limits are 15 RPM, 1,500 RPD - must enforce to prevent quota errors
   * How: Track requests in-memory with time windows
   * Trade-off: In-memory means limits reset on app restart (acceptable for this use case)
   * 
   * Alternative considered: Sliding window
   * - More accurate but adds complexity
   * - Current approach is sufficient given typical usage patterns
   * 
   * @throws RateLimitError - If per-minute limit exceeded
   * @throws QuotaExceededError - If daily limit exceeded
   */
  private checkRateLimits(): void {
    const now = Date.now();
    
    // Reset minute counter if 60 seconds elapsed
    // Why: Sliding window would be more accurate but adds complexity
    // This simpler approach is sufficient given typical usage patterns
    if (now - this.lastMinuteReset > 60000) {
      this.requestsThisMinute = 0;
      this.lastMinuteReset = now;
    }
    
    // Reset daily counter if 24 hours elapsed (or new day UTC)
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - this.lastDayReset > dayMs) {
      this.requestsToday = 0;
      this.lastDayReset = now;
    }
    
    // Check minute limit (15 RPM for free tier)
    if (this.requestsThisMinute >= 15) {
      const resetTime = this.lastMinuteReset + 60000;
      throw new RateLimitError(
        'Exceeded 15 requests per minute. Please wait before trying again.',
        resetTime
      );
    }
    
    // Check daily limit
    // Why: Clear limit helps user understand; suggest upgrade for power users
    if (this.requestsToday >= this.dailyRequestLimit) {
      throw new QuotaExceededError(
        `Daily limit reached (${this.dailyRequestLimit} requests). Free tier allows up to ${GEMINI_FREE_TIER_DAILY_LIMIT.toLocaleString()}/day. Try again tomorrow or upgrade for higher limits.`
      );
    }
  }
  
  /**
   * Increment rate limit counters after successful request
   * 
   * Why: Called after successful API call to track usage
   * Separate from checkRateLimits to avoid double-counting on retries
   */
  private incrementRateLimits(): void {
    this.requestsThisMinute++;
    this.requestsToday++;
  }
  
  /**
   * Reset rate limit counters
   * 
   * Why: Called on initialization or when user changes API key
   * Provides fresh start for rate limiting
   */
  private resetRateLimits(): void {
    this.requestsThisMinute = 0;
    this.requestsToday = 0;
    this.lastMinuteReset = Date.now();
    this.lastDayReset = Date.now();
  }
  
  /**
   * Set daily request limit
   * 
   * Why: Allows users to set lower limit than free tier for budget control
   * Useful for organizations that want to limit API usage
   * 
   * @param limit - Maximum requests per day
   */
  public setDailyRequestLimit(limit: number): void {
    if (limit < 1 || limit > GEMINI_FREE_TIER_DAILY_LIMIT) {
      throw new Error(`Daily request limit must be between 1 and ${GEMINI_FREE_TIER_DAILY_LIMIT.toLocaleString()}`);
    }
    this.dailyRequestLimit = limit;
  }
  
  /**
   * Analyze logs using Gemini AI
   * 
   * Why this approach?
   * - Accepts pre-formatted context to separate concerns (context building is separate service)
   * - Returns structured response for consistent UI rendering
   * - Implements retry logic for transient failures
   * - Tracks token usage for quota management
   * 
   * @param query - User's question or analysis request
   * @param context - Pre-formatted log context (from LogContextBuilder)
   * @param options - Optional config (model override, temperature, etc.)
   * @returns Promise<AIAnalysisResponse> - Structured analysis result
   * @throws RateLimitError - When API quota exceeded
   * @throws InvalidApiKeyError - When API key is invalid/expired
   * @throws NetworkError - When network request fails
   * @throws TokenLimitExceededError - When context exceeds token limit
   * 
   * @example
   * ```typescript
   * const response = await geminiService.analyzeLog(
   *   "Why did these calls fail?",
   *   formattedContext,
   *   { model: 'gemini-1.5-pro' }
   * );
   * ```
   */
  public async analyzeLog(
    query: string,
    context: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{
    content: string;
    logReferences: number[];
    tokensUsed: number;
    model: string;
  }> {
    if (!this.client || !this.model) {
      throw new Error('GeminiService not initialized. Call initialize() first.');
    }
    
    // Check rate limits before making request
    this.checkRateLimits();
    
    try {
      // Build prompt with context
      const selectedModelId = options?.model || this.currentModelId;
      const defaultModel = options?.model
        ? this.client.getGenerativeModel({ model: options.model })
        : this.model;
      const cachedModel = await this.getCachedModelIfAvailable(selectedModelId);

      // Why: when prompt cache is available, avoid resending static role/instruction text.
      const modelToUse = cachedModel ?? defaultModel;
      const prompt = cachedModel
        ? this.buildPromptWithoutRole(query, context)
        : this.buildPrompt(query, context);

      const maxTokens = options?.maxTokens ?? 100000;

      // Use exact model-side token counting when available.
      // Why: character heuristics can materially under/over-estimate structured SIP context.
      const tokenCountResult =
        typeof modelToUse.countTokens === 'function'
          ? await this.makeApiCallWithRetry(() => modelToUse.countTokens(prompt))
          : null;

      const exactTokens =
        tokenCountResult?.totalTokens ??
        Math.ceil(prompt.length / 4);

      if (exactTokens > maxTokens) {
        throw new TokenLimitExceededError(
          `Context too large (${exactTokens.toLocaleString()} tokens, limit ${maxTokens.toLocaleString()}). Please select fewer logs.`,
          maxTokens,
          exactTokens
        );
      }
      
      // Make API call with retry logic
      const result = await this.makeApiCallWithRetry(
        () => modelToUse.generateContent(prompt)
      );
      
      // Extract response
      // Why: response.text() can throw on malformed/empty responses - never crash the app
      const response = result.response;
      let text: string;
      try {
        text = response?.text?.() ?? '';
      } catch (extractError) {
        console.error('Gemini API: failed to extract response text', extractError);
        throw new Error('AI returned an invalid response. Please try again.');
      }
      // Why: Empty responses indicate API issues; fail loudly so user can retry
      if (typeof text !== 'string' || !text.trim()) {
        console.error('Gemini API: empty or missing response');
        throw new Error('AI returned no response. Please try again.');
      }

      // Track usage
      this.incrementRateLimits();
      const tokensUsed =
        result.response.usageMetadata?.totalTokenCount ??
        (exactTokens + Math.ceil(text.length / 4));
      this.totalTokensUsed += tokensUsed;
      
      // Extract log references from response (if any)
      const logReferences = this.extractLogReferences(text);
      
      return {
        content: text,
        logReferences,
        tokensUsed,
        model: options?.model || this.currentModelId,
      };
    } catch (error) {
      // Classify and re-throw with user-friendly message
      throw this.handleApiError(error);
    }
  }

  /**
   * Analyze very large datasets via two-pass hierarchical summarization.
   *
   * Why: keeps each model call bounded while preserving global timeline coverage.
   *
   * @param query - User's analysis question
   * @param chunks - Time-window context chunks
   * @param options - Optional model/token options
   * @returns Final synthesized analysis response
   */
  public async analyzeHierarchical(
    query: string,
    chunks: HierarchicalContextChunk[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{
    content: string;
    logReferences: number[];
    tokensUsed: number;
    model: string;
  }> {
    if (chunks.length === 0) {
      return this.analyzeLog(query, 'No logs available for analysis.', options);
    }

    const chunkSummaries: string[] = [];
    const maxCallsPerMinute = 14; // keep headroom under 15 RPM free-tier limit
    let callsInWindow = 0;
    let windowStart = Date.now();

    for (const chunk of chunks) {
      if (callsInWindow >= maxCallsPerMinute) {
        const elapsed = Date.now() - windowStart;
        const waitMs = Math.max(0, 60000 - elapsed);
        if (waitMs > 0) {
          await this.sleep(waitMs);
        }
        callsInWindow = 0;
        windowStart = Date.now();
      }

      const chunkPrompt = `Summarize this time-window of logs for later synthesis.
Focus on key failures, protocol events, and probable causes.
User question: ${query}
Time window: ${chunk.timeWindow}`;

      const chunkResult = await this.analyzeLog(chunkPrompt, chunk.context, options);
      chunkSummaries.push(`### ${chunk.timeWindow}\n${chunkResult.content}`);
      callsInWindow++;
    }

    const synthesisContext = chunkSummaries.join('\n\n');
    const synthesisQuery = `Synthesize all time-window summaries into one final answer for the user's request.
Highlight root-cause timeline, repeated patterns, and concrete remediation steps.
Original user question: ${query}`;

    return this.analyzeLog(synthesisQuery, synthesisContext, options);
  }
  
  /**
   * Stream response for better UX
   * 
   * Why: Streaming improves perceived performance by showing partial results immediately
   * Users see progress instead of waiting for complete response
   * 
   * @param query - User's question
   * @param context - Pre-formatted log context
   * @param onChunk - Callback for each text chunk
   * @param options - Optional config
   * @returns Promise<void> - Resolves when streaming complete
   */
  public async streamResponse(
    query: string,
    context: string,
    onChunk: (chunk: string) => void,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<void> {
    if (!this.client || !this.model) {
      throw new Error('GeminiService not initialized. Call initialize() first.');
    }
    
    // Check rate limits
    this.checkRateLimits();
    
    try {
      const selectedModelId = options?.model || this.currentModelId;
      const defaultModel = options?.model
        ? this.client.getGenerativeModel({ model: options.model })
        : this.model;
      const cachedModel = await this.getCachedModelIfAvailable(selectedModelId);
      const modelToUse = cachedModel ?? defaultModel;
      const prompt = cachedModel
        ? this.buildPromptWithoutRole(query, context)
        : this.buildPrompt(query, context);
      
      // Stream response - use retry for transient failures (per .cursorrules)
      const result = await this.makeApiCallWithRetry(
        () => modelToUse.generateContentStream(prompt)
      );
      
      // Track that request was made
      this.incrementRateLimits();
      
      // Process stream chunks
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          onChunk(text);
        }
      }
      
      // Track tokens (rough estimate)
      const estimatedTokens = Math.ceil((query.length + context.length) / 4);
      this.totalTokensUsed += estimatedTokens;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }
  
  /**
   * Build prompt with context for LLM
   * 
   * Why: Structured prompt improves AI response quality
   * Provides role, context, and clear instructions
   * 
   * @param query - User's question
   * @param context - Formatted log context
   * @returns Formatted prompt string
   */
  private buildPrompt(query: string, context: string): string {
    return `You are an expert in telecommunications and VoIP log analysis, specializing in SIP, call flow troubleshooting, and network issues.

CONTEXT:
The following logs are from a telecommunications/VoIP system. Analyze them to answer the user's question.

LOGS:
${context}

USER QUESTION:
${query}

INSTRUCTIONS:
- Provide clear, actionable insights
- Reference specific log entries when relevant
- Use markdown formatting for readability
- Be concise but thorough
- If uncertain, say so clearly

RESPONSE:`;
  }

  /**
   * Build the dynamic prompt section used when static role text is cached.
   *
   * Why: Context caching stores stable instruction text once and sends only
   * query/context deltas on each request.
   *
   * @param query - User's question
   * @param context - Formatted log context
   * @returns Dynamic prompt for cached model calls
   */
  private buildPromptWithoutRole(query: string, context: string): string {
    return `CONTEXT:
The following logs are from a telecommunications/VoIP system. Analyze them to answer the user's question.

LOGS:
${context}

USER QUESTION:
${query}

RESPONSE:`;
  }

  /**
   * Return a cached-content-backed model when available.
   *
   * Note: Context caching via GoogleAICacheManager is not available in the
   * @google/generative-ai client SDK. This method always returns null so
   * uncached prompts are used. Caching may be available in the server SDK.
   *
   * @returns Cached model instance or null (always null for client SDK)
   */
  private async getCachedModelIfAvailable(_modelId: string): Promise<GenerativeModel | null> {
    return null;
  }

  /**
   * Reset prompt cache state.
   *
   * No-op: caching is disabled in client SDK. Kept for API compatibility.
   */
  private resetPromptCache(): void {
    // Caching not supported in @google/generative-ai client; no state to reset
  }
  
  /**
   * Extract log references from AI response
   * 
   * Why: Enables linking AI responses back to specific logs
   * Looks for patterns like [Log #123] or "log 456" in response
   * 
   * @param response - AI response text
   * @returns Array of log IDs referenced
   */
  private extractLogReferences(response: string): number[] {
    const references: number[] = [];
    
    // Match patterns like [Log #123] or "log 456"
    const patterns = [
      /\[Log\s*#(\d+)\]/gi,
      /log\s*#?(\d+)/gi,
      /log\s*ID\s*(\d+)/gi,
    ];
    
    for (const pattern of patterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const id = parseInt(match[1], 10);
        if (!isNaN(id) && !references.includes(id)) {
          references.push(id);
        }
      }
    }
    
    return references;
  }
  
  /**
   * Make API call with retry logic
   * 
   * RETRY STRATEGY:
   * Why: Network failures and transient API errors are common
   * Exponential backoff prevents overwhelming the API
   * 
   * Strategy:
   * - Retry up to 3 times
   * - Exponential backoff: 1s, 2s, 4s
   * - Only retry on transient errors (network, timeouts)
   * - Never retry: RateLimit, InvalidApiKey, QuotaExceeded, TokenLimitExceeded
   *   (these require user action, retrying would waste time)
   * 
   * Fail loudly vs silently: We always throw (fail loudly) so caller can show
   * user-friendly message. Never swallow errors - user must know something failed.
   * 
   * @param apiCall - Function that makes API call
   * @returns Promise with API result
   */
  private async makeApiCallWithRetry<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        // Don't retry on non-transient errors (won't resolve with retry)
        if (error instanceof RateLimitError || error instanceof InvalidApiKeyError ||
            error instanceof QuotaExceededError || error instanceof TokenLimitExceededError) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Sleep utility for rate-limit friendly batching.
   */
  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Handle and classify API errors
   * 
   * ERROR HANDLING STRATEGY:
   * Why: Google API errors come in various formats
   * Need to classify and convert to user-friendly messages
   * 
   * @param error - Caught error from API
   * @returns Classified error with user-friendly message
   */
  private handleApiError(error: unknown): Error {
    // Already classified errors
    if (error instanceof RateLimitError || 
        error instanceof InvalidApiKeyError ||
        error instanceof QuotaExceededError ||
        error instanceof TokenLimitExceededError) {
      return error;
    }
    
    // Log detailed error for debugging
    console.error('Gemini API error:', error);
    
    // Classify based on error message/type
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = errorMessage.toLowerCase();

    // 404 Model not found - e.g. deprecated gemini-1.5-flash (distinguish from invalid key)
    if (errorString.includes('404') || errorString.includes('is not found') || errorString.includes('not supported for generatecontent')) {
      return new Error('Model unavailable. Try selecting a different model in AI Settings (e.g. Gemini 3 Flash).');
    }

    // Invalid API key
    if (errorString.includes('api key') || 
        errorString.includes('invalid') ||
        errorString.includes('401') ||
        errorString.includes('unauthorized')) {
      return new InvalidApiKeyError('Invalid API key. Please check your settings.');
    }
    
    // Rate limit (429) - differentiate from daily quota for actionable message
    if (errorString.includes('rate limit') || errorString.includes('429')) {
      const resetIn = 60000; // Assume ~1 min for per-minute limits
      return new RateLimitError('Too many requests. Please wait a moment and try again.', Date.now() + resetIn);
    }
    // Daily quota exceeded (quota without 429)
    if (errorString.includes('quota') && !errorString.includes('429')) {
      return new QuotaExceededError(`Daily API quota exceeded. Free tier allows up to ${GEMINI_FREE_TIER_DAILY_LIMIT.toLocaleString()} requests/day. Try again tomorrow.`);
    }
    
    // Network error
    if (errorString.includes('network') ||
        errorString.includes('fetch') ||
        errorString.includes('timeout') ||
        errorString.includes('connection')) {
      return new NetworkError('Network error. Please check your connection and try again.');
    }
    
    // Token limit
    if (errorString.includes('token') ||
        errorString.includes('context length') ||
        errorString.includes('too large')) {
      return new TokenLimitExceededError('Context too large. Please select fewer logs.');
    }
    
    // Generic fallback
    // Why: Never expose raw API/stack details to user (security, UX)
    return new Error('AI analysis failed. Check your connection and try again.');
  }
  
  /**
   * Get current usage statistics
   * 
   * Why: Enables UI to display usage and warn users approaching limits
   * 
   * @returns Current usage stats
   */
  public getUsageStats(): AIUsageStats {
    return {
      requestsToday: this.requestsToday,
      requestsThisMinute: this.requestsThisMinute,
      totalTokensUsed: this.totalTokensUsed,
      lastDailyReset: this.lastDayReset,
      lastMinuteReset: this.lastMinuteReset,
    };
  }
  
  /**
   * Reset usage statistics
   * 
   * Why: Allows manual reset for testing or user request
   * 
   * Note: Daily reset happens automatically, this is for manual override
   */
  public resetUsageStats(): void {
    this.requestsToday = 0;
    this.requestsThisMinute = 0;
    this.totalTokensUsed = 0;
    this.lastDayReset = Date.now();
    this.lastMinuteReset = Date.now();
  }
}

/**
 * Export singleton instance getter
 * 
 * Why: Provides convenient access to service without importing class
 */
export const geminiService = GeminiService.getInstance();
