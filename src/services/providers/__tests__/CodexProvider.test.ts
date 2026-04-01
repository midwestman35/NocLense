import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodexProvider } from '../CodexProvider';
import {
  InsufficientPermissionsError,
  InvalidApiKeyError,
  NetworkError,
} from '../../../types/ai';

const { mockFetch } = vi.hoisted(() => {
  return {
    mockFetch: vi.fn(),
  };
});

global.fetch = mockFetch as any;

describe('CodexProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateApiKey', () => {
    it('returns true for a valid key', async () => {
      const provider = new CodexProvider();
      mockFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200, ok: true }));

      const result = await provider.validateApiKey('test-openai-key-12345');
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/responses',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer test-openai-key-12345',
          }),
        })
      );
    });

    it('returns false on invalid key (401)', async () => {
      const provider = new CodexProvider();
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid api key' }), { status: 401, ok: false }));

      const result = await provider.validateApiKey('test-openai-key-12345');
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      const provider = new CodexProvider();
      mockFetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await provider.validateApiKey('test-openai-key-12345');
      expect(result).toBe(false);
    });

    it('returns false for blank keys without making fetch calls', async () => {
      const provider = new CodexProvider();

      const result = await provider.validateApiKey('   ');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('analyzeLog', () => {
    it('initializes with a valid API key', async () => {
      const provider = new CodexProvider();
      expect(() => provider.initialize('test-openai-key-12345', 'gpt-4.1-mini')).not.toThrow();
    });

    it('throws InvalidApiKeyError on initialize with blank key', async () => {
      const provider = new CodexProvider();
      expect(() => provider.initialize('   ')).toThrow(InvalidApiKeyError);
    });
  });
});
