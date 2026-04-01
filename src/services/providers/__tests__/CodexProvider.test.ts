import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodexProvider } from '../CodexProvider';
import {
  InsufficientPermissionsError,
  InvalidApiKeyError,
  NetworkError,
} from '../../../types/ai';

const { mockModelsList, mockResponsesCreate, MockAPIError } = vi.hoisted(() => {
  const modelsList = vi.fn();
  const responsesCreate = vi.fn();

  class HoistedMockAPIError extends Error {
    public readonly status?: number;
    public readonly error?: unknown;

    constructor(status?: number, message: string = 'API error', error?: unknown) {
      super(message);
      this.status = status;
      this.error = error;
    }
  }

  return {
    mockModelsList: modelsList,
    mockResponsesCreate: responsesCreate,
    MockAPIError: HoistedMockAPIError,
  };
});

vi.mock('openai', () => {
  class MockOpenAI {
    public static APIError = MockAPIError;
    public readonly models = { list: mockModelsList };
    public readonly responses = { create: mockResponsesCreate };

    constructor(_options: { apiKey: string; dangerouslyAllowBrowser: boolean }) {}
  }

  return { default: MockOpenAI };
});

describe('CodexProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateApiKey', () => {
    it('returns true for a valid key and available model', async () => {
      const provider = new CodexProvider();
      mockModelsList.mockResolvedValue({ data: [{ id: 'gpt-4.1-mini' }] });
      mockResponsesCreate.mockResolvedValue({ output_text: 'ok' });

      const result = await provider.validateApiKey('test-openai-key-12345');
      expect(result).toBe(true);
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4.1-mini',
          max_output_tokens: 16,
        })
      );
    });

    it('returns false on invalid key (401)', async () => {
      const provider = new CodexProvider();
      mockModelsList.mockRejectedValue(new MockAPIError(401, 'invalid api key'));

      const result = await provider.validateApiKey('test-openai-key-12345');
      expect(result).toBe(false);
    });

    it('throws InsufficientPermissionsError on 403', async () => {
      const provider = new CodexProvider();
      mockModelsList.mockRejectedValue(new MockAPIError(403, 'project access denied'));

      await expect(provider.validateApiKey('test-openai-key-12345')).rejects.toBeInstanceOf(
        InsufficientPermissionsError
      );
    });

    it('throws NetworkError when browser network fails', async () => {
      const provider = new CodexProvider();
      mockModelsList.mockRejectedValue(new Error('Failed to fetch'));

      await expect(provider.validateApiKey('test-openai-key-12345')).rejects.toBeInstanceOf(NetworkError);
    });

    it('chooses an available fallback model when current default is not listed', async () => {
      const provider = new CodexProvider();
      mockModelsList.mockResolvedValue({ data: [{ id: 'gpt-4o-mini' }] });
      mockResponsesCreate.mockResolvedValue({ output_text: 'ok' });

      const result = await provider.validateApiKey('test-openai-key-12345');
      expect(result).toBe(true);
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' })
      );
    });

    it('returns false for blank keys without SDK calls', async () => {
      const provider = new CodexProvider();

      const result = await provider.validateApiKey('   ');
      expect(result).toBe(false);
      expect(mockModelsList).not.toHaveBeenCalled();
      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });
  });

  describe('analyzeLog', () => {
    it('parses response text from output content when output_text is missing', async () => {
      const provider = new CodexProvider();
      provider.initialize('test-openai-key-12345', 'gpt-4.1-mini');

      mockResponsesCreate.mockResolvedValue({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Investigate [Log #88]' }],
          },
        ],
        usage: { total_tokens: 22 },
      });

      const response = await provider.analyzeLog('why', 'context');
      expect(response.content).toContain('Investigate');
      expect(response.logReferences).toContain(88);
      expect(response.tokensUsed).toBe(22);
    });

    it('maps 403 responses to InsufficientPermissionsError', async () => {
      const provider = new CodexProvider();
      provider.initialize('test-openai-key-12345', 'gpt-4.1-mini');

      mockResponsesCreate.mockRejectedValue(new MockAPIError(403, 'insufficient permissions'));

      await expect(provider.analyzeLog('why', 'context')).rejects.toBeInstanceOf(
        InsufficientPermissionsError
      );
    });

    it('maps 401 responses to InvalidApiKeyError', async () => {
      const provider = new CodexProvider();
      provider.initialize('test-openai-key-12345', 'gpt-4.1-mini');

      mockResponsesCreate.mockRejectedValue(new MockAPIError(401, 'invalid api key'));

      await expect(provider.analyzeLog('why', 'context')).rejects.toBeInstanceOf(InvalidApiKeyError);
    });
  });
});
