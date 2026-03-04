/**
 * Integration Tests for AI Context
 * 
 * Purpose:
 * Comprehensive tests for AIContext to ensure:
 * - Context provider works correctly
 * - useAI hook throws error when used outside provider
 * - State management works (API key, model, enabled state)
 * - localStorage persistence works correctly
 * - Usage stats tracking and daily reset logic
 * - API integration with GeminiService
 * - Error handling provides user-friendly messages
 * 
 * Testing Strategy:
 * - Mock GeminiService to avoid real API calls
 * - Mock localStorage for persistence tests
 * - Test provider initialization from localStorage
 * - Test state updates and persistence
 * - Test error handling scenarios
 * - Test usage stats tracking
 * 
 * @module contexts/__tests__/AIContext.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AIProvider, useAI } from '../AIContext';
import { GeminiService } from '../../services/llmService';
import * as apiKeyStorage from '../../store/apiKeyStorage';
import {
  InvalidApiKeyError,
  RateLimitError,
  QuotaExceededError,
  TokenLimitExceededError,
  NetworkError,
} from '../../types/ai';
import type { LogEntry } from '../../types';

const mockEmbeddingService = {
  initialize: vi.fn(),
  retrieveTopKByQuery: vi.fn(),
  indexLogFile: vi.fn(),
};

// Mock GeminiService
vi.mock('../../services/llmService', () => {
  const mockService = {
    initialize: vi.fn(),
    validateApiKey: vi.fn(),
    analyzeLog: vi.fn(),
    analyzeHierarchical: vi.fn(),
    setDailyRequestLimit: vi.fn(),
    getUsageStats: vi.fn(),
  };
  
  return {
    GeminiService: {
      getInstance: vi.fn(() => mockService),
    },
  };
});

// Mock LogContextBuilder
vi.mock('../../services/logContextBuilder', () => {
  // Return a class constructor, not a function
  class MockLogContextBuilder {
    HIERARCHICAL_THRESHOLD = 5000;

    buildContext(logs: LogEntry[]) {
      return `Context for ${logs.length} logs`;
    }

    buildHierarchicalContext(logs: LogEntry[]) {
      return [
        { timeWindow: 'window-1', context: `Chunk context for ${logs.length} logs` },
      ];
    }
  }
  
  return {
    LogContextBuilder: MockLogContextBuilder,
  };
});

// Mock apiKeyStorage - tests run in web/JSDOM (no Electron); reads from mocked localStorage
vi.mock('../../store/apiKeyStorage', () => ({
  loadApiKey: vi.fn((provider: string) => {
    const scoped = typeof window !== 'undefined' && window.localStorage?.getItem(`noclense_ai_api_key_${provider}`);
    if (scoped) return Promise.resolve(scoped);
    if (provider === 'gemini') {
      const legacy = typeof window !== 'undefined' && window.localStorage?.getItem('noclense_ai_api_key');
      if (legacy) return Promise.resolve(legacy);
    }
    return Promise.resolve(null);
  }),
  saveApiKey: vi.fn((provider: string, key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`noclense_ai_api_key_${provider}`, key);
      if (provider === 'gemini') window.localStorage.setItem('noclense_ai_api_key', key);
    }
    return Promise.resolve();
  }),
  migrateFromLocalStorage: vi.fn().mockResolvedValue(false),
}));

// Mock EmbeddingService
vi.mock('../../services/embeddingService', () => {
  class MockEmbeddingService {
    initialize(apiKey: string) {
      return mockEmbeddingService.initialize(apiKey);
    }

    retrieveTopKByQuery(query: string, logs: LogEntry[], k: number) {
      return mockEmbeddingService.retrieveTopKByQuery(query, logs, k);
    }

    indexLogFile(logs: LogEntry[]) {
      return mockEmbeddingService.indexLogFile(logs);
    }
  }

  return {
    EmbeddingService: MockEmbeddingService,
  };
});

// Helper to create wrapper component
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <AIProvider>{children}</AIProvider>
  );
};

describe('AIContext', () => {
  let mockService: any;
  let localStorageMock: Record<string, string>;
  
  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock = {};
    // Phase 7: Consent for AI - tests that call askQuestion need prior consent
    localStorageMock['noclense_ai_consent'] = 'true';
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });
    
    // Get mock service instance
    mockService = (GeminiService.getInstance as any)();
    
    // Reset all mocks
    vi.clearAllMocks();
    mockService.validateApiKey.mockResolvedValue(true);
    mockService.analyzeLog.mockResolvedValue({
      content: 'Test response',
      logReferences: [1, 2, 3],
      tokensUsed: 100,
      model: 'gemini-3-flash-preview',
    });
    mockService.analyzeHierarchical.mockResolvedValue({
      content: 'Hierarchical response',
      logReferences: [10, 11],
      tokensUsed: 200,
      model: 'gemini-3-flash-preview',
    });
    mockEmbeddingService.initialize.mockReset();
    mockEmbeddingService.retrieveTopKByQuery.mockReset();
    mockEmbeddingService.indexLogFile.mockReset();
    mockEmbeddingService.retrieveTopKByQuery.mockResolvedValue([]);
    mockEmbeddingService.indexLogFile.mockResolvedValue(undefined);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('useAI hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAI());
      }).toThrow('useAI must be used within an AIProvider');
      
      consoleSpy.mockRestore();
    });
    
    it('should return context value when used inside provider', () => {
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      expect(result.current).toBeDefined();
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.apiKeyConfigured).toBe(false);
      expect(result.current.provider).toBe('gemini');
      expect(result.current.model).toBe('gemini-3.1-flash-lite-preview');
      expect(result.current.conversationHistory).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
  
  describe('API key management', () => {
    it('should load API key from localStorage on mount', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-api-key-123';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
      });
    });
    
    it('should set and validate API key', async () => {
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.setApiKey('test-api-key-123');
      });
      expect(success!).toBe(true);

      expect(mockService.validateApiKey).toHaveBeenCalledWith('test-api-key-123');
      expect(mockService.initialize).toHaveBeenCalledWith('test-api-key-123', 'gemini-3-flash-preview');
      expect(apiKeyStorage.saveApiKey).toHaveBeenCalledWith('gemini', 'test-api-key-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('noclense_ai_api_key', 'test-api-key-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('noclense_ai_api_key_gemini', 'test-api-key-123');

      // apiKeyConfigured reflects apiKeys state; async save + setState may batch
      await waitFor(
        () => {
          expect(result.current.apiKeyConfigured).toBe(true);
        },
        { timeout: 2000 }
      );
    });
    
    it('should handle invalid API key', async () => {
      mockService.validateApiKey.mockResolvedValue(false);
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await act(async () => {
        const success = await result.current.setApiKey('invalid-key');
        expect(success).toBe(false);
      });
      
      expect(result.current.error).toContain('Invalid API key');
      expect(result.current.apiKeyConfigured).toBe(false);
    });
    
    it('should handle API key validation error', async () => {
      mockService.validateApiKey.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await act(async () => {
        const success = await result.current.setApiKey('test-key');
        expect(success).toBe(false);
      });
      
      // NetworkError sets error to e.message; generic rejection uses 'Failed to validate'
      expect(result.current.error).toMatch(/Failed to validate|Network error/);
    });
  });
  
  describe('Model selection', () => {
    it('should load model preference from localStorage', () => {
      localStorageMock['noclense_ai_model'] = 'gemini-1.5-pro';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      expect(result.current.model).toBe('gemini-1.5-pro');
    });
    
    it('should set model preference', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
      });
      
      await act(() => {
        result.current.setModel('gemini-1.5-pro');
      });
      
      expect(result.current.model).toBe('gemini-1.5-pro');
      expect(localStorage.setItem).toHaveBeenCalledWith('noclense_ai_model', 'gemini-1.5-pro');
      expect(mockService.initialize).toHaveBeenCalledWith('test-key', 'gemini-1.5-pro');
    });
  });

  describe('Provider selection', () => {
    it('should load provider preference from localStorage', () => {
      localStorageMock['noclense_ai_provider'] = 'claude';

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      expect(result.current.provider).toBe('claude');
    });

    it('should switch provider and persist to localStorage', async () => {
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await act(() => {
        result.current.setProvider('codex');
      });

      expect(result.current.provider).toBe('codex');
      expect(localStorage.setItem).toHaveBeenCalledWith('noclense_ai_provider', 'codex');
    });
  });
  
  describe('Enabled state', () => {
    it('should load enabled state from localStorage', () => {
      localStorageMock['noclense_ai_enabled'] = 'true';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      expect(result.current.isEnabled).toBe(true);
    });
    
    it('should set enabled state', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
      });
      
      await act(() => {
        result.current.setEnabled(true);
      });
      
      expect(result.current.isEnabled).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('noclense_ai_enabled', 'true');
    });
  });
  
  describe('Usage stats', () => {
    it('should load usage stats from localStorage', () => {
      const stats = {
        requestsToday: 10,
        requestsThisMinute: 2,
        totalTokensUsed: 5000,
        lastDailyReset: Date.now(),
        lastMinuteReset: Date.now(),
      };
      localStorageMock['noclense_ai_usage_stats'] = JSON.stringify(stats);
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      expect(result.current.usageStats.requestsToday).toBe(10);
      expect(result.current.usageStats.totalTokensUsed).toBe(5000);
    });
    
    it('should reset daily stats when new day', () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      
      const stats = {
        requestsToday: 10,
        requestsThisMinute: 2,
        totalTokensUsed: 5000,
        lastDailyReset: yesterday.getTime(),
        lastMinuteReset: Date.now(),
      };
      localStorageMock['noclense_ai_usage_stats'] = JSON.stringify(stats);
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      // Daily counter should be reset
      expect(result.current.usageStats.requestsToday).toBe(0);
      // But total tokens should be preserved
      expect(result.current.usageStats.totalTokensUsed).toBe(5000);
    });
    
    it('should update usage stats after API call', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      const initialStats = result.current.usageStats.requestsToday;
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.usageStats.requestsToday).toBe(initialStats + 1);
      });
    });
  });
  
  describe('Phase 7: Consent', () => {
    it('should show consent modal when askQuestion called without prior consent', async () => {
      delete localStorageMock['noclense_ai_consent'];
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const testLogs: LogEntry[] = [
        {
          id: 1,
          timestamp: Date.now(),
          rawTimestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'test',
          displayComponent: 'test',
          message: 'Test',
          displayMessage: 'Test',
          payload: '',
          type: 'LOG',
          isSip: false,
        },
      ];

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
        expect(result.current.hasConsentedToAI).toBe(false);
      });

      await act(async () => {
        await result.current.askQuestion('test question', [1], testLogs);
      });

      expect(result.current.showConsentModal).toBe(true);
      expect(mockService.analyzeLog).not.toHaveBeenCalled();
    });

    it('should execute pending request when consentToAI called after modal shown', async () => {
      delete localStorageMock['noclense_ai_consent'];
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const testLogs: LogEntry[] = [
        {
          id: 1,
          timestamp: Date.now(),
          rawTimestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'test',
          displayComponent: 'test',
          message: 'Test',
          displayMessage: 'Test',
          payload: '',
          type: 'LOG',
          isSip: false,
        },
      ];

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.apiKeyConfigured).toBe(true));

      await act(async () => {
        await result.current.askQuestion('my question', [1], testLogs);
      });

      expect(result.current.showConsentModal).toBe(true);

      act(() => {
        result.current.consentToAI();
      });

      await waitFor(() => {
        expect(result.current.showConsentModal).toBe(false);
        expect(result.current.hasConsentedToAI).toBe(true);
        expect(mockService.analyzeLog).toHaveBeenCalled();
      });
    });

    it('should clear pending request when declineConsent called', async () => {
      delete localStorageMock['noclense_ai_consent'];
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const testLogs: LogEntry[] = [
        {
          id: 1,
          timestamp: Date.now(),
          rawTimestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'test',
          displayComponent: 'test',
          message: 'Test',
          displayMessage: 'Test',
          payload: '',
          type: 'LOG',
          isSip: false,
        },
      ];

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.apiKeyConfigured).toBe(true));

      await act(async () => {
        await result.current.askQuestion('decline me', [1], testLogs);
      });

      expect(result.current.showConsentModal).toBe(true);

      act(() => {
        result.current.declineConsent();
      });

      expect(result.current.showConsentModal).toBe(false);
      expect(mockService.analyzeLog).not.toHaveBeenCalled();
    });
  });

  describe('askQuestion', () => {
    it('should require API key', async () => {
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      expect(result.current.error).toContain('API key not configured');
      expect(mockService.analyzeLog).not.toHaveBeenCalled();
    });
    
    it('should require enabled state', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      expect(result.current.error).toContain('AI features are disabled');
      expect(mockService.analyzeLog).not.toHaveBeenCalled();
    });
    
    it('should call GeminiService with correct parameters', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      
      const testLogs: LogEntry[] = [
        {
          id: 1,
          timestamp: Date.now(),
          rawTimestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'test',
          displayComponent: 'test',
          message: 'Test error',
          displayMessage: 'Test error',
          payload: '',
          type: 'LOG',
          isSip: false,
        },
      ];
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question', [1], testLogs);
      });
      
      await waitFor(() => {
        expect(mockService.analyzeLog).toHaveBeenCalled();
        expect(result.current.conversationHistory.length).toBe(2); // User + Assistant
      });
    });

    it('should use hierarchical analysis for very large log selections', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const largeLogs: LogEntry[] = Array.from({ length: 5001 }, (_, i) => ({
        id: i + 1,
        timestamp: Date.now() + i * 1000,
        rawTimestamp: new Date(Date.now() + i * 1000).toISOString(),
        level: i % 2 === 0 ? 'ERROR' : 'INFO',
        component: 'test',
        displayComponent: 'test',
        message: `Message ${i}`,
        displayMessage: `Message ${i}`,
        payload: '',
        type: 'LOG',
        isSip: false,
      }));

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });

      await act(async () => {
        await result.current.askQuestion('large request', undefined, largeLogs);
      });

      await waitFor(() => {
        expect(mockService.analyzeHierarchical).toHaveBeenCalledTimes(1);
      });
      expect(mockService.analyzeLog).not.toHaveBeenCalled();
    });

    it('should use embedding retrieval branch for medium-large log selections', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const mediumLogs: LogEntry[] = Array.from({ length: 1200 }, (_, i) => ({
        id: i + 1,
        timestamp: Date.now() + i,
        rawTimestamp: new Date(Date.now() + i).toISOString(),
        level: i % 3 === 0 ? 'ERROR' : 'INFO',
        component: 'test',
        displayComponent: 'test',
        message: `Message ${i}`,
        displayMessage: `Message ${i}`,
        payload: '',
        type: 'LOG',
        isSip: false,
      }));

      mockEmbeddingService.retrieveTopKByQuery.mockResolvedValue([mediumLogs[0], mediumLogs[1]]);

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });

      await act(async () => {
        await result.current.askQuestion('retrieve relevant logs', undefined, mediumLogs);
      });

      await waitFor(() => {
        expect(mockEmbeddingService.initialize).toHaveBeenCalledWith('test-key');
        expect(mockEmbeddingService.retrieveTopKByQuery).toHaveBeenCalled();
        expect(mockService.analyzeLog).toHaveBeenCalled();
      });
      expect(mockService.analyzeHierarchical).not.toHaveBeenCalled();
    });
    
    it('should handle InvalidApiKeyError', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      mockService.analyzeLog.mockRejectedValue(new InvalidApiKeyError());
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.error).toContain('Invalid API key');
        // User message should be removed on error
        expect(result.current.conversationHistory.length).toBe(0);
      });
    });
    
    it('should handle RateLimitError', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      const resetTime = Date.now() + 60000;
      mockService.analyzeLog.mockRejectedValue(new RateLimitError('Rate limit', resetTime));
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.error).toContain('Too many requests');
      });
    });
    
    it('should handle QuotaExceededError', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      mockService.analyzeLog.mockRejectedValue(new QuotaExceededError());
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.error).toContain('Daily quota exceeded');
        expect(result.current.showQuotaExceededModal).toBe(true);
      });
    });
    
    it('should handle TokenLimitExceededError', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      mockService.analyzeLog.mockRejectedValue(new TokenLimitExceededError());
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.error).toContain('Too many logs');
      });
    });
    
    it('should handle NetworkError', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      mockService.analyzeLog.mockRejectedValue(new NetworkError());
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.error).toContain('Network error');
      });
    });
  });
  
  describe('clearHistory', () => {
    it('should clear conversation history', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
      });
      
      // Add a message first
      await act(async () => {
        await result.current.askQuestion('test question');
      });
      
      await waitFor(() => {
        expect(result.current.conversationHistory.length).toBeGreaterThan(0);
      });
      
      // Clear history
      await act(() => {
        result.current.clearHistory();
      });
      
      expect(result.current.conversationHistory).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
  
  describe('Quota exceeded modal', () => {
    it('should show quota modal and not call API when at daily limit', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';
      localStorageMock['noclense_ai_usage_stats'] = JSON.stringify({
        requestsToday: 1500,
        requestsThisMinute: 0,
        totalTokensUsed: 50000,
        lastDailyReset: Date.now(),
        lastMinuteReset: Date.now(),
      });
      localStorageMock['noclense_ai_daily_limit'] = '1500';

      const testLogs: LogEntry[] = [
        {
          id: 1,
          timestamp: Date.now(),
          rawTimestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'test',
          displayComponent: 'test',
          message: 'Test',
          displayMessage: 'Test',
          payload: '',
          type: 'LOG',
          isSip: false,
        },
      ];

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
        expect(result.current.isEnabled).toBe(true);
        expect(result.current.usageStats.requestsToday).toBe(1500);
      });

      await act(async () => {
        await result.current.askQuestion('test question', [1], testLogs);
      });

      expect(result.current.showQuotaExceededModal).toBe(true);
      expect(result.current.error).toContain('Daily limit reached');
      expect(mockService.analyzeLog).not.toHaveBeenCalled();
    });
  });

  describe('dailyRequestLimit', () => {
    it('should load daily limit from localStorage', () => {
      localStorageMock['noclense_ai_daily_limit'] = '1000';
      
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      expect(result.current.dailyRequestLimit).toBe(1000);
    });
    
    it('should set daily limit', async () => {
      localStorageMock['noclense_ai_api_key'] = 'test-key';
      localStorageMock['noclense_ai_enabled'] = 'true';

      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await waitFor(() => {
        expect(result.current.apiKeyConfigured).toBe(true);
      });
      
      await act(() => {
        result.current.setDailyRequestLimit(1000);
      });
      
      expect(result.current.dailyRequestLimit).toBe(1000);
      expect(localStorage.setItem).toHaveBeenCalledWith('noclense_ai_daily_limit', '1000');
      expect(mockService.setDailyRequestLimit).toHaveBeenCalledWith(1000);
    });
    
    it('should reject invalid daily limit', async () => {
      const { result } = renderHook(() => useAI(), {
        wrapper: createWrapper(),
      });
      
      await act(() => {
        result.current.setDailyRequestLimit(2000); // Over limit
      });
      
      expect(result.current.error).toContain('Daily limit must be between');
    });
  });
});
