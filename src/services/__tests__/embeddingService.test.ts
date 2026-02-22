import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingService } from '../embeddingService';
import type { LogEntry } from '../../types';

const {
  mockBatchEmbedContents,
  mockEmbedContent,
  mockUpdateLogEmbedding,
} = vi.hoisted(() => ({
  mockBatchEmbedContents: vi.fn(),
  mockEmbedContent: vi.fn(),
  mockUpdateLogEmbedding: vi.fn().mockResolvedValue(undefined),
}));

const mockModel = {
  batchEmbedContents: mockBatchEmbedContents,
  embedContent: mockEmbedContent,
};

vi.mock('@google/generative-ai', () => {
  const mockClient = {
    getGenerativeModel: vi.fn(() => mockModel),
  };

  class MockGoogleGenerativeAI {
    constructor(apiKey: string) {
      return mockClient;
    }
  }

  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

vi.mock('../../utils/indexedDB', () => {
  return {
    dbManager: {
      updateLogEmbedding: mockUpdateLogEmbedding,
    },
  };
});

function createLog(id: number, level: LogEntry['level'] = 'ERROR'): LogEntry {
  return {
    id,
    timestamp: Date.now() + id,
    rawTimestamp: new Date(Date.now() + id).toISOString(),
    level,
    component: 'sip.stack',
    displayComponent: 'sip.stack',
    message: `message ${id}`,
    displayMessage: `message ${id}`,
    payload: '',
    type: 'LOG',
    isSip: true,
  };
}

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
    vi.clearAllMocks();
  });

  it('rejects non-embedding model ids during initialization', () => {
    expect(() => service.initialize('test-api-key-12345678901234567890', 'gemini-3-flash-preview')).toThrow(
      'not an embedding-compatible model'
    );
  });

  it('uses batch embedding API in retrieval flow when available', async () => {
    service.initialize('test-api-key-12345678901234567890');
    mockBatchEmbedContents.mockImplementation(async (input: { requests: unknown[] }) => {
      return {
        embeddings: input.requests.map((_, index) => ({ values: [index + 1, 1] })),
      };
    });

    const logs = [createLog(1), createLog(2), createLog(3)];
    const top = await service.retrieveTopKByQuery('find root cause', logs, 2);

    expect(top.length).toBe(2);
    expect(mockBatchEmbedContents).toHaveBeenCalled();
    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(logs.some(log => !!log.embedding && log.hasEmbedding === true)).toBe(true);
  });

  it('batches indexing requests in chunks of 100', async () => {
    service.initialize('test-api-key-12345678901234567890');
    mockBatchEmbedContents.mockImplementation(async (input: { requests: unknown[] }) => {
      return {
        embeddings: input.requests.map((_, index) => ({ values: [index + 1, 1] })),
      };
    });

    const logs = Array.from({ length: 150 }, (_, i) => createLog(i + 1, 'ERROR'));
    await service.indexLogFile(logs);

    expect(mockBatchEmbedContents).toHaveBeenCalledTimes(2);
    expect(logs.some(log => !!log.embedding && log.hasEmbedding === true)).toBe(true);
  });
});

