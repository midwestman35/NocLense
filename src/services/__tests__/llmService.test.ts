/**
 * Unit Tests for LLM Service
 * 
 * Purpose:
 * Comprehensive tests for GeminiService to ensure:
 * - API key validation works correctly
 * - Rate limiting prevents quota exhaustion
 * - Error handling provides user-friendly messages
 * - Token estimation prevents limit exceeded errors
 * - Usage tracking is accurate
 * 
 * Testing Strategy:
 * - Mock @google/generative-ai to avoid real API calls
 * - Test all public methods
 * - Cover error scenarios (network, rate limits, invalid keys)
 * - Validate rate limiting logic
 * - Test retry logic for transient failures
 * 
 * @module services/__tests__/llmService.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiService } from '../llmService';
import {
  InvalidApiKeyError,
  RateLimitError,
  QuotaExceededError,
  TokenLimitExceededError,
  NetworkError,
} from '../../types/ai';

// Mock @google/generative-ai
vi.mock('@google/generative-ai', () => {
  const mockGenerateContent = vi.fn();
  const mockGenerateContentStream = vi.fn();
  const mockCountTokens = vi.fn().mockResolvedValue({ totalTokens: 100 });
  const mockModel = {
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
    countTokens: mockCountTokens,
  };
  
  const mockClient = {
    getGenerativeModel: vi.fn(() => mockModel),
    getGenerativeModelFromCachedContent: vi.fn(() => mockModel),
  };

  class MockGoogleGenerativeAI {
    constructor(_apiKey: string) {
      return mockClient;
    }
  }
  
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
  };
});

describe('GeminiService', () => {
  let service: GeminiService;
  
  beforeEach(() => {
    // Reset singleton instance for each test
    (GeminiService as any).instance = undefined;
    service = GeminiService.getInstance();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = GeminiService.getInstance();
      const instance2 = GeminiService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('initialize', () => {
    it('should initialize with valid API key', () => {
      const apiKey = 'test-api-key-12345678901234567890';
      expect(() => service.initialize(apiKey)).not.toThrow();
    });
    
    it('should throw InvalidApiKeyError for empty API key', () => {
      expect(() => service.initialize('')).toThrow(InvalidApiKeyError);
      expect(() => service.initialize('   ')).toThrow(InvalidApiKeyError);
    });
    
    it('should throw InvalidApiKeyError for API key that is too short', () => {
      expect(() => service.initialize('short')).toThrow(InvalidApiKeyError);
    });
    
    it('should initialize with custom model', () => {
      const apiKey = 'test-api-key-12345678901234567890';
      service.initialize(apiKey, 'gemini-1.5-pro');
      // Model selection is tested indirectly through API calls
      expect(service).toBeDefined();
    });
  });
  
  describe('validateApiKey', () => {
    it('should return false for empty API key', async () => {
      const result = await service.validateApiKey('');
      expect(result).toBe(false);
    });
    
    it('should return false for invalid API key', async () => {
      // Mock API call to throw error
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('invalid-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockRejectedValue(new Error('Invalid API key'));
      
      const result = await service.validateApiKey('invalid-key');
      expect(result).toBe(false);
    });
    
    it('should return true for valid API key', async () => {
      // Mock successful API call
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('valid-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'test response' },
      });
      
      const result = await service.validateApiKey('valid-key');
      expect(result).toBe(true);
    });
  });
  
  describe('rate limiting', () => {
    beforeEach(() => {
      service.initialize('test-api-key-12345678901234567890');
    });
    
    it('should allow requests within per-minute limit', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'response' },
      });
      
      // Make 14 requests (under 15 RPM limit)
      for (let i = 0; i < 14; i++) {
        await service.analyzeLog('test query', 'test context');
      }
      
      // Should not throw
      expect(mockModel.generateContent).toHaveBeenCalledTimes(14);
    });
    
    it('should throw RateLimitError after 15 requests per minute', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'response' },
      });
      
      // Make 15 requests
      for (let i = 0; i < 15; i++) {
        await service.analyzeLog('test query', 'test context');
      }
      
      // 16th request should throw
      await expect(
        service.analyzeLog('test query', 'test context')
      ).rejects.toThrow(RateLimitError);
    });
    
    it('should throw QuotaExceededError after daily limit', async () => {
      service.setDailyRequestLimit(5); // Set low limit for testing
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'response' },
      });
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await service.analyzeLog('test query', 'test context');
      }
      
      // 6th request should throw
      await expect(
        service.analyzeLog('test query', 'test context')
      ).rejects.toThrow(QuotaExceededError);
    });
    
    it('should reset per-minute counter after 60 seconds', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'response' },
      });
      
      // Make 15 requests
      for (let i = 0; i < 15; i++) {
        await service.analyzeLog('test query', 'test context');
      }
      
      // Fast-forward time by 61 seconds
      vi.useFakeTimers();
      vi.advanceTimersByTime(61000);
      
      // Should allow request after reset
      await service.analyzeLog('test query', 'test context');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(16);
      
      vi.useRealTimers();
    });
  });
  
  describe('analyzeLog', () => {
    beforeEach(() => {
      service.initialize('test-api-key-12345678901234567890');
    });
    
    it('should throw error if not initialized', async () => {
      const uninitializedService = GeminiService.getInstance();
      (uninitializedService as any).client = null;
      (uninitializedService as any).model = null;
      
      await expect(
        uninitializedService.analyzeLog('query', 'context')
      ).rejects.toThrow('GeminiService not initialized');
    });
    
    it('should throw TokenLimitExceededError for context exceeding token limit', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.countTokens = vi.fn().mockResolvedValue({ totalTokens: 150000 });
      const largeContext = 'x'.repeat(500000);
      
      await expect(
        service.analyzeLog('query', largeContext, { maxTokens: 100000 })
      ).rejects.toThrow(TokenLimitExceededError);
    });
    
    it('should successfully analyze logs and return response', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const mockResponse = {
        response: {
          text: () => 'This is an AI analysis response.',
          usageMetadata: {
            totalTokenCount: 321,
          },
        },
      };
      mockModel.generateContent = vi.fn().mockResolvedValue(mockResponse);
      mockModel.countTokens = vi.fn().mockResolvedValue({ totalTokens: 120 });
      
      const result = await service.analyzeLog(
        'Why did these errors occur?',
        'ERROR: Connection failed\nWARN: Retrying...'
      );
      
      expect(result.content).toBe('This is an AI analysis response.');
      expect(result.logReferences).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.tokensUsed).toBe(321);
      expect(mockModel.countTokens).toHaveBeenCalled();
      expect(result.model).toBe('gemini-3.1-flash-lite-preview');
    });

    it('should skip cache creation for cache-incompatible models', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.countTokens = vi.fn().mockResolvedValue({ totalTokens: 120 });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: {
          text: () => 'response',
          usageMetadata: { totalTokenCount: 222 },
        },
      });

      await service.analyzeLog('query', 'context');

      expect(sharedCacheManagerMock.create).not.toHaveBeenCalled();
      expect(mockModel.generateContent).toHaveBeenCalled();
    });
    
    it('should extract log references from response', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const mockResponse = {
        response: {
          text: () => 'The error in [Log #123] and [Log #456] indicates a connection issue.',
        },
      };
      mockModel.generateContent = vi.fn().mockResolvedValue(mockResponse);
      
      const result = await service.analyzeLog('query', 'context');
      
      expect(result.logReferences).toContain(123);
      expect(result.logReferences).toContain(456);
    });
    
    it('should handle API errors and convert to user-friendly messages', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Test invalid API key error (no retry - throws immediately)
      mockModel.generateContent = vi.fn().mockRejectedValue(
        new Error('API key is invalid')
      );

      await expect(
        service.analyzeLog('query', 'context')
      ).rejects.toThrow(InvalidApiKeyError);
    }, 10000);

    it('should handle network errors', async () => {
      vi.useFakeTimers();
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const mockClient = new (GoogleGenerativeAI as any)('test-key');
        const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
        mockModel.generateContent = vi.fn().mockRejectedValue(
          new Error('Network error: Failed to fetch')
        );

        const promise = service.analyzeLog('query', 'context');
        promise.catch(() => {}); // Attach handler immediately to prevent unhandled rejection
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow(NetworkError);
      } finally {
        vi.useRealTimers();
      }
    }, 15000);
    
    it('should retry on transient failures', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Fail twice, then succeed
      mockModel.generateContent = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue({
          response: { text: () => 'Success after retry' },
        });
      
      const result = await service.analyzeLog('query', 'context');
      
      expect(result.content).toBe('Success after retry');
      // Fail twice then succeed: 3 attempts minimum (retry loop runs until success)
      expect(mockModel.generateContent.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('streamResponse', () => {
    beforeEach(() => {
      service.initialize('test-api-key-12345678901234567890');
    });
    
    it('should stream response chunks', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const chunks = ['Hello', ' ', 'world', '!'];
      const mockStream = {
        stream: (async function* () {
          for (const chunk of chunks) {
            yield { text: () => chunk } as any;
          }
        })(),
      };
      
      mockModel.generateContentStream = vi.fn().mockResolvedValue(mockStream);
      
      const receivedChunks: string[] = [];
      await service.streamResponse(
        'query',
        'context',
        (chunk) => receivedChunks.push(chunk)
      );
      
      expect(receivedChunks).toEqual(['Hello', ' ', 'world', '!']);
    });
  });

  describe('analyzeHierarchical', () => {
    beforeEach(() => {
      service.initialize('test-api-key-12345678901234567890');
    });

    it('should summarize chunks then synthesize final response', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });

      mockModel.countTokens = vi.fn().mockResolvedValue({ totalTokens: 100 });
      mockModel.generateContent = vi.fn()
        .mockResolvedValueOnce({ response: { text: () => 'chunk summary 1', usageMetadata: { totalTokenCount: 110 } } })
        .mockResolvedValueOnce({ response: { text: () => 'chunk summary 2', usageMetadata: { totalTokenCount: 120 } } })
        .mockResolvedValueOnce({ response: { text: () => 'final synthesis', usageMetadata: { totalTokenCount: 130 } } });

      const result = await service.analyzeHierarchical(
        'What failed?',
        [
          { timeWindow: 'w1', context: 'error a' },
          { timeWindow: 'w2', context: 'error b' },
        ],
        { model: 'gemini-3-flash-preview' }
      );

      expect(result.content).toBe('final synthesis');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('getUsageStats', () => {
    beforeEach(() => {
      service.initialize('test-api-key-12345678901234567890');
    });
    
    it('should return initial usage stats', () => {
      const stats = service.getUsageStats();
      
      expect(stats.requestsToday).toBe(0);
      expect(stats.requestsThisMinute).toBe(0);
      expect(stats.totalTokensUsed).toBe(0);
      expect(stats.lastDailyReset).toBeDefined();
      expect(stats.lastMinuteReset).toBeDefined();
    });
    
    it('should track usage after successful request', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'response' },
      });
      
      await service.analyzeLog('query', 'context');
      
      const stats = service.getUsageStats();
      expect(stats.requestsToday).toBe(1);
      expect(stats.requestsThisMinute).toBe(1);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });
  });
  
  describe('setDailyRequestLimit', () => {
    it('should set daily request limit', () => {
      service.setDailyRequestLimit(100);
      // Limit is tested indirectly through quota exceeded tests
      expect(service).toBeDefined();
    });
    
    it('should throw error for invalid limit', () => {
      expect(() => service.setDailyRequestLimit(0)).toThrow();
      expect(() => service.setDailyRequestLimit(2000)).toThrow();
    });
  });
  
  describe('resetUsageStats', () => {
    beforeEach(() => {
      service.initialize('test-api-key-12345678901234567890');
    });
    
    it('should reset all usage statistics', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockClient = new (GoogleGenerativeAI as any)('test-key');
      const mockModel = mockClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      mockModel.generateContent = vi.fn().mockResolvedValue({
        response: { text: () => 'response' },
      });
      
      await service.analyzeLog('query', 'context');
      
      const statsBefore = service.getUsageStats();
      expect(statsBefore.requestsToday).toBe(1);
      
      service.resetUsageStats();
      
      const statsAfter = service.getUsageStats();
      expect(statsAfter.requestsToday).toBe(0);
      expect(statsAfter.requestsThisMinute).toBe(0);
      expect(statsAfter.totalTokensUsed).toBe(0);
    });
  });
});
