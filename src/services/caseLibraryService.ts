/**
 * caseLibraryService.ts
 *
 * Purpose:
 * Indexes persisted investigation cases for semantic retrieval and performs
 * similarity search over the local case library.
 *
 * Architecture Decision:
 * Keep case-library embedding orchestration in a dedicated service so
 * persistence, versioning, and similarity ranking stay outside UI code.
 *
 * Dependencies:
 * - CaseRepository for persisted case access
 * - EmbeddingService for Gemini embedding generation and cosine scoring
 */

import type { Case, CaseSeverity } from '../types/case';
import { caseRepository } from './caseRepository';
import { embeddingService } from './embeddingService';

const DEFAULT_TOP_K = 5;

export const CURRENT_VERSION = 'gemini-text-embedding-004';

export interface CaseLibraryRepository {
  listCases(opts?: {
    limit?: number;
    orderBy?: 'createdAt' | 'updatedAt';
  }): Promise<Case[]>;
  updateCaseEmbedding(id: string, embedding: number[], version: string): Promise<void>;
}

export interface CaseLibraryEmbedder {
  isInitialized(): boolean;
  buildCaseEmbeddingText(caseItem: Case): string;
  embedDocument(text: string): Promise<number[] | null>;
  embedQuery(text: string): Promise<number[] | null>;
  cosineSimilarity(a: number[], b: number[]): number;
}

export interface CaseLibraryFilters {
  minDate?: number;
  maxDate?: number;
  severity?: CaseSeverity[];
  excludeCaseIds?: string[];
}

export interface FindSimilarOptions {
  topK?: number;
  filters?: CaseLibraryFilters;
}

export interface SimilarCaseMatch {
  case: Case;
  score: number;
}

export class CaseLibraryService {
  private readonly repo: CaseLibraryRepository;
  private readonly embeddings: CaseLibraryEmbedder;

  /**
   * Create a case-library service with injectable persistence and embedding dependencies.
   *
   * @param repo - Backing case repository
   * @param embeddings - Embedding provider and scorer
   */
  public constructor(
    repo: CaseLibraryRepository = caseRepository,
    embeddings: CaseLibraryEmbedder = embeddingService,
  ) {
    this.repo = repo;
    this.embeddings = embeddings;
  }

  /**
   * Index a case when its embedding is missing or stale.
   *
   * @param caseItem - Case to embed and persist
   * @returns Updated case when reindexed; unchanged case when skipped
   */
  public async indexCase(caseItem: Case): Promise<Case> {
    if (!this.needsEmbeddingRefresh(caseItem)) {
      return caseItem;
    }

    if (!this.embeddings.isInitialized()) {
      console.warn('CaseLibraryService.indexCase skipped because the embedding service is not initialized.');
      return caseItem;
    }

    const embeddingText = this.embeddings.buildCaseEmbeddingText(caseItem);
    const embedding = await this.embeddings.embedDocument(embeddingText);
    if (!embedding) {
      console.warn(`CaseLibraryService.indexCase skipped because the embedding service is not initialized for case "${caseItem.id}".`);
      return caseItem;
    }

    await this.repo.updateCaseEmbedding(caseItem.id, embedding, CURRENT_VERSION);
    return {
      ...caseItem,
      embedding,
      embeddingVersion: CURRENT_VERSION,
    };
  }

  /**
   * Find the most similar indexed cases for a string or case-shaped query.
   *
   * @param query - Free text query or case to convert into query text
   * @param opts - Ranking limit and optional case filters
   * @returns Ranked case matches in descending cosine-similarity order
   */
  public async findSimilar(
    query: string | Case,
    opts: FindSimilarOptions = {},
  ): Promise<SimilarCaseMatch[]> {
    if (!this.embeddings.isInitialized()) {
      console.warn('CaseLibraryService.findSimilar skipped because the embedding service is not initialized.');
      return [];
    }

    const topK = Math.max(0, opts.topK ?? DEFAULT_TOP_K);
    if (topK === 0) {
      return [];
    }

    const queryText = typeof query === 'string'
      ? query
      : this.embeddings.buildCaseEmbeddingText(query);
    const queryEmbedding = await this.embeddings.embedQuery(queryText);
    if (!queryEmbedding) {
      console.warn('CaseLibraryService.findSimilar skipped because the embedding service is not initialized.');
      return [];
    }

    const cases = await this.repo.listCases();
    const scored = cases
      .filter(caseItem => this.matchesFilters(caseItem, opts.filters))
      .filter(caseItem => this.hasCurrentEmbedding(caseItem))
      .map(caseItem => ({
        case: caseItem,
        score: this.embeddings.cosineSimilarity(queryEmbedding, caseItem.embedding as number[]),
      }))
      .sort((left, right) => right.score - left.score);

    return scored.slice(0, topK);
  }

  /**
   * Reindex all cases with missing or stale embeddings.
   *
   * @param onProgress - Optional callback receiving monotonic percent completion
   * @returns Promise that resolves after reindexing completes
   */
  public async reindexAll(onProgress?: (progress: number) => void): Promise<void> {
    const cases = await this.repo.listCases();
    if (cases.length === 0) {
      onProgress?.(100);
      return;
    }

    if (!this.embeddings.isInitialized()) {
      console.warn('CaseLibraryService.reindexAll skipped because the embedding service is not initialized.');
      onProgress?.(0);
      onProgress?.(100);
      return;
    }

    let lastProgress = 0;
    const emitProgress = (value: number): void => {
      const nextValue = Math.min(100, Math.max(lastProgress, value));
      lastProgress = nextValue;
      onProgress?.(nextValue);
    };

    emitProgress(0);

    for (let index = 0; index < cases.length; index++) {
      const caseItem = cases[index];
      if (this.needsEmbeddingRefresh(caseItem)) {
        await this.indexCase(caseItem);
      }
      emitProgress(Math.round(((index + 1) / cases.length) * 100));
    }
  }

  /**
   * Check whether a stored embedding is missing or on the wrong model version.
   *
   * @param caseItem - Case under evaluation
   * @returns True when the case should be reindexed
   */
  private needsEmbeddingRefresh(caseItem: Case): boolean {
    return !this.hasCurrentEmbedding(caseItem);
  }

  /**
   * Check whether a case has a usable embedding for the current model version.
   *
   * @param caseItem - Case under evaluation
   * @returns True when the case has a current-version embedding
   */
  private hasCurrentEmbedding(caseItem: Case): boolean {
    return Boolean(
      caseItem.embedding &&
      caseItem.embedding.length > 0 &&
      caseItem.embeddingVersion === CURRENT_VERSION,
    );
  }

  /**
   * Apply caller-supplied filters to a case candidate.
   *
   * @param caseItem - Candidate case from the repository
   * @param filters - Optional filter set
   * @returns True when the case passes all configured filters
   */
  private matchesFilters(caseItem: Case, filters?: CaseLibraryFilters): boolean {
    if (!filters) {
      return true;
    }

    if (filters.excludeCaseIds?.includes(caseItem.id)) {
      return false;
    }
    if (filters.minDate !== undefined && caseItem.updatedAt < filters.minDate) {
      return false;
    }
    if (filters.maxDate !== undefined && caseItem.updatedAt > filters.maxDate) {
      return false;
    }
    if (filters.severity && !filters.severity.includes(caseItem.severity)) {
      return false;
    }

    return true;
  }
}

export const caseLibraryService = new CaseLibraryService();
