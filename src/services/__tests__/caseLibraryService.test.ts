import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Case, CaseSeverity } from '../../types/case';
import { CaseLibraryService, CURRENT_VERSION } from '../caseLibraryService';
import { EmbeddingService } from '../embeddingService';

type CaseRepositoryLike = {
  listCases: ReturnType<typeof vi.fn>;
  updateCaseEmbedding: ReturnType<typeof vi.fn>;
};

const {
  mockBuildCaseEmbeddingText,
  mockCosineSimilarity,
  mockEmbedDocument,
  mockEmbedQuery,
  mockIsInitialized,
} = vi.hoisted(() => ({
  mockBuildCaseEmbeddingText: vi.fn(),
  mockCosineSimilarity: vi.fn(),
  mockEmbedDocument: vi.fn(),
  mockEmbedQuery: vi.fn(),
  mockIsInitialized: vi.fn(),
}));

vi.mock('../embeddingService', () => {
  class MockEmbeddingService {
    buildCaseEmbeddingText(caseItem: Case) {
      return mockBuildCaseEmbeddingText(caseItem);
    }

    embedDocument(text: string) {
      return mockEmbedDocument(text);
    }

    embedQuery(text: string) {
      return mockEmbedQuery(text);
    }

    isInitialized() {
      return mockIsInitialized();
    }

    cosineSimilarity(a: number[], b: number[]) {
      return mockCosineSimilarity(a, b);
    }
  }

  return {
    EmbeddingService: MockEmbeddingService,
    embeddingService: new MockEmbeddingService(),
  };
});

function createCase(overrides: Partial<Case> = {}): Case {
  return {
    id: overrides.id ?? `case_${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? 'Case title',
    severity: overrides.severity ?? 'medium',
    status: overrides.status ?? 'open',
    summary: overrides.summary ?? 'Case summary',
    impact: overrides.impact ?? 'Case impact',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    attachments: overrides.attachments ?? [],
    bookmarks: overrides.bookmarks ?? [],
    notes: overrides.notes ?? [],
    timeWindow: overrides.timeWindow ?? null,
    state: overrides.state,
    embedding: overrides.embedding,
    embeddingVersion: overrides.embeddingVersion,
  };
}

function createRepositoryMock(cases: Case[] = []): CaseRepositoryLike {
  return {
    listCases: vi.fn().mockResolvedValue(cases),
    updateCaseEmbedding: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CaseLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCaseEmbeddingText.mockImplementation((caseItem: Case) => `${caseItem.title}\n${caseItem.summary}\n${caseItem.impact}`);
    mockEmbedDocument.mockResolvedValue([1, 0, 0]);
    mockEmbedQuery.mockResolvedValue([1, 0, 0]);
    mockIsInitialized.mockReturnValue(true);
    mockCosineSimilarity.mockImplementation((a: number[], b: number[]) =>
      a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0),
    );
  });

  it('indexCase computes and persists an embedding via the repository', async () => {
    const repository = createRepositoryMock();
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);
    const caseItem = createCase({ id: 'case_index' });

    const updated = await service.indexCase(caseItem);

    expect(mockBuildCaseEmbeddingText).toHaveBeenCalledWith(caseItem);
    expect(mockEmbedDocument).toHaveBeenCalledWith('Case title\nCase summary\nCase impact');
    expect(repository.updateCaseEmbedding).toHaveBeenCalledWith('case_index', [1, 0, 0], CURRENT_VERSION);
    expect(updated).toEqual({
      ...caseItem,
      embedding: [1, 0, 0],
      embeddingVersion: CURRENT_VERSION,
    });
  });

  it('indexCase is idempotent when embedding and version already match', async () => {
    const repository = createRepositoryMock();
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);
    const caseItem = createCase({
      id: 'case_idempotent',
      embedding: [0.5, 0.5],
      embeddingVersion: CURRENT_VERSION,
    });

    const first = await service.indexCase(caseItem);
    const second = await service.indexCase(first);

    expect(repository.updateCaseEmbedding).not.toHaveBeenCalled();
    expect(mockEmbedDocument).not.toHaveBeenCalled();
    expect(second).toEqual(first);
  });

  it('indexCase reindexes stale data when embedding exists without a version', async () => {
    const repository = createRepositoryMock();
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);
    const staleCase = createCase({
      id: 'case_stale',
      embedding: [9, 9, 9],
    });

    const updated = await service.indexCase(staleCase);

    expect(repository.updateCaseEmbedding).toHaveBeenCalledWith('case_stale', [1, 0, 0], CURRENT_VERSION);
    expect(updated.embeddingVersion).toBe(CURRENT_VERSION);
  });

  it('indexCase without an initialized embedder is a no-op and does not throw', async () => {
    const repository = createRepositoryMock();
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const caseItem = createCase({ id: 'case_no_embedder' });
    mockIsInitialized.mockReturnValue(false);

    const updated = await service.indexCase(caseItem);

    expect(updated).toEqual(caseItem);
    expect(repository.updateCaseEmbedding).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/embedding.*not initialized/i));
  });

  it('findSimilar with a Case input returns top-K sorted by score', async () => {
    const candidateA = createCase({ id: 'case_a', embedding: [0.9, 0.1], embeddingVersion: CURRENT_VERSION });
    const candidateB = createCase({ id: 'case_b', embedding: [0.7, 0.3], embeddingVersion: CURRENT_VERSION });
    const candidateC = createCase({ id: 'case_c', embedding: [0.2, 0.8], embeddingVersion: CURRENT_VERSION });
    const repository = createRepositoryMock([candidateA, candidateB, candidateC]);
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);

    mockEmbedQuery.mockResolvedValue([1, 0]);
    mockCosineSimilarity.mockImplementation((query: number[], embedding: number[]) => embedding[0]);

    const results = await service.findSimilar(createCase({ id: 'case_query' }), { topK: 2 });

    expect(mockBuildCaseEmbeddingText).toHaveBeenCalled();
    expect(results).toEqual([
      { case: candidateA, score: 0.9 },
      { case: candidateB, score: 0.7 },
    ]);
  });

  it('findSimilar with a string input returns ranked results', async () => {
    const candidateA = createCase({ id: 'case_a', embedding: [0.1, 0.9], embeddingVersion: CURRENT_VERSION });
    const candidateB = createCase({ id: 'case_b', embedding: [0.8, 0.2], embeddingVersion: CURRENT_VERSION });
    const repository = createRepositoryMock([candidateA, candidateB]);
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);

    mockEmbedQuery.mockResolvedValue([0, 1]);
    mockCosineSimilarity.mockImplementation((_query: number[], embedding: number[]) => embedding[1]);

    const results = await service.findSimilar('customer impact text', {});

    expect(mockEmbedQuery).toHaveBeenCalledWith('customer impact text');
    expect(results).toEqual([
      { case: candidateA, score: 0.9 },
      { case: candidateB, score: 0.2 },
    ]);
  });

  it('findSimilar excludes case ids and applies date and severity filters', async () => {
    const cases = [
      createCase({
        id: 'exclude_me',
        updatedAt: 50,
        severity: 'high',
        embedding: [1, 0],
        embeddingVersion: CURRENT_VERSION,
      }),
      createCase({
        id: 'too_old',
        updatedAt: 5,
        severity: 'high',
        embedding: [0.8, 0.2],
        embeddingVersion: CURRENT_VERSION,
      }),
      createCase({
        id: 'wrong_severity',
        updatedAt: 60,
        severity: 'low',
        embedding: [0.7, 0.3],
        embeddingVersion: CURRENT_VERSION,
      }),
      createCase({
        id: 'match_me',
        updatedAt: 55,
        severity: 'critical',
        embedding: [0.9, 0.1],
        embeddingVersion: CURRENT_VERSION,
      }),
    ];
    const repository = createRepositoryMock(cases);
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);

    mockEmbedQuery.mockResolvedValue([1, 0]);
    mockCosineSimilarity.mockImplementation((_query: number[], embedding: number[]) => embedding[0]);

    const results = await service.findSimilar('query', {
      filters: {
        excludeCaseIds: ['exclude_me'],
        minDate: 10,
        maxDate: 60,
        severity: ['high', 'critical'] satisfies CaseSeverity[],
      },
    });

    expect(results).toEqual([{ case: cases[3], score: 0.9 }]);
  });

  it('findSimilar skips cases with mismatched embedding versions', async () => {
    const matchingCase = createCase({
      id: 'match',
      embedding: [0.5, 0.5],
      embeddingVersion: CURRENT_VERSION,
    });
    const staleCase = createCase({
      id: 'stale',
      embedding: [1, 0],
      embeddingVersion: 'older-version',
    });
    const repository = createRepositoryMock([matchingCase, staleCase]);
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);

    mockEmbedQuery.mockResolvedValue([1, 0]);
    mockCosineSimilarity.mockImplementation((_query: number[], embedding: number[]) => embedding[0]);

    const results = await service.findSimilar('query', {});

    expect(results).toEqual([{ case: matchingCase, score: 0.5 }]);
  });

  it('findSimilar without an initialized embedder returns [] and does not throw', async () => {
    const repository = createRepositoryMock([createCase({ embedding: [1, 0], embeddingVersion: CURRENT_VERSION })]);
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockIsInitialized.mockReturnValue(false);

    await expect(service.findSimilar('query', {})).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/embedding.*not initialized/i));
  });

  it('reindexAll reindexes only stale cases and emits monotonic progress', async () => {
    const cases = [
      createCase({ id: 'up_to_date', embedding: [1], embeddingVersion: CURRENT_VERSION }),
      createCase({ id: 'missing_embedding' }),
      createCase({ id: 'stale_version', embedding: [1], embeddingVersion: 'old-version' }),
    ];
    const repository = createRepositoryMock(cases);
    const service = new CaseLibraryService(repository as never, new EmbeddingService() as never);
    const progressValues: number[] = [];

    mockEmbedDocument
      .mockResolvedValueOnce([0.1, 0.9])
      .mockResolvedValueOnce([0.2, 0.8]);

    await service.reindexAll((pct) => {
      progressValues.push(pct);
    });

    expect(repository.updateCaseEmbedding).toHaveBeenCalledTimes(2);
    expect(repository.updateCaseEmbedding).toHaveBeenNthCalledWith(1, 'missing_embedding', [0.1, 0.9], CURRENT_VERSION);
    expect(repository.updateCaseEmbedding).toHaveBeenNthCalledWith(2, 'stale_version', [0.2, 0.8], CURRENT_VERSION);
    expect(progressValues[0]).toBe(0);
    expect(progressValues.at(-1)).toBe(100);
    expect(progressValues.every((value, index, all) => index === 0 || value >= all[index - 1])).toBe(true);
  });
});
