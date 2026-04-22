/**
 * Embedding Service - Retrieval Augmentation for Log Analysis
 *
 * Purpose:
 * Generates and manages Gemini embeddings for logs and user queries so
 * context selection can be driven by semantic relevance instead of only
 * level/time heuristics.
 *
 * Architecture Decision:
 * Keep embedding logic in a dedicated service to preserve separation of concerns:
 * - AIContext orchestrates flows
 * - LogContextBuilder formats selected logs
 * - EmbeddingService handles vector generation and ranking
 *
 * Dependencies:
 * - @google/generative-ai for embedding generation
 * - indexedDB manager for optional embedding persistence
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { LogEntry } from '../types';
import type { Case } from '../types/case';
import { dbManager } from '../utils/indexedDB';

type EmbeddingTaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';

export class EmbeddingService {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private static readonly MAX_BATCH_SIZE = 100;
  private static readonly MAX_CASE_EMBEDDING_TEXT_LENGTH = 2048;

  /**
   * Initialize embedding service with API key.
   *
   * @param apiKey - Gemini API key
   * @param modelId - Embedding model id (default: gemini-text-embedding-004)
   */
  public initialize(apiKey: string, modelId: string = 'gemini-text-embedding-004'): void {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key is required to initialize EmbeddingService');
    }
    if (!this.isEmbeddingModelCompatible(modelId)) {
      throw new Error(`Model "${modelId}" is not an embedding-compatible model.`);
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: modelId });
  }

  /**
   * Report whether the embedder is ready to serve requests.
   *
   * @returns True when the Gemini embedding model has been initialized
   */
  public isInitialized(): boolean {
    return this.model !== null;
  }

  /**
   * Validate embedding model compatibility.
   *
   * Why: text generation models do not expose embedding APIs consistently.
   */
  private isEmbeddingModelCompatible(modelId: string): boolean {
    return modelId.startsWith('text-embedding-') || modelId.startsWith('gemini-text-embedding-');
  }

  /**
   * Build compact text representation for document embeddings.
   *
   * Why: full payload embedding is expensive/noisy; concise fields retain signal.
   */
  private buildEmbeddingText(log: LogEntry): string {
    const callId = log.callId ? ` [callId:${log.callId}]` : '';
    return `${log.level} ${log.component} ${log.message}${callId}`;
  }

  /**
   * Build a compact representation for case-library embeddings.
   *
   * @param caseItem - Case record to flatten into embedding text
   * @returns Joined title, summary, and impact text capped at 2048 chars
   */
  public buildCaseEmbeddingText(caseItem: Case): string {
    const text = [caseItem.title, caseItem.summary, caseItem.impact].join('\n');
    return text.slice(0, EmbeddingService.MAX_CASE_EMBEDDING_TEXT_LENGTH);
  }

  /**
   * Embed a single text input.
   */
  private async embedText(text: string, taskType: EmbeddingTaskType): Promise<number[] | null> {
    const results = await this.embedTexts([text], taskType);
    return results[0] ?? null;
  }

  /**
   * Embed multiple texts, preferring batch embedding when available.
   *
   * Why: batch requests reduce API calls and RPM pressure for large log sets.
   */
  private async embedTexts(
    texts: string[],
    taskType: EmbeddingTaskType
  ): Promise<Array<number[] | null>> {
    if (!this.model) {
      return texts.map(() => null);
    }

    try {
      const modelWithEmbed = this.model as unknown as {
        embedContent?: (input: {
          content: { parts: Array<{ text: string }> };
          taskType: EmbeddingTaskType;
        }) => Promise<unknown>;
        batchEmbedContents?: (input: {
          requests: Array<{
            content: { parts: Array<{ text: string }> };
            taskType: EmbeddingTaskType;
          }>;
        }) => Promise<unknown>;
      };

      const supportsBatch = typeof modelWithEmbed.batchEmbedContents === 'function';
      const supportsSingle = typeof modelWithEmbed.embedContent === 'function';
      if (!supportsBatch && !supportsSingle) {
        return texts.map(() => null);
      }

      if (supportsBatch) {
        const allResults: Array<number[] | null> = [];
        for (let i = 0; i < texts.length; i += EmbeddingService.MAX_BATCH_SIZE) {
          const batch = texts.slice(i, i + EmbeddingService.MAX_BATCH_SIZE);
          const batchResult = await modelWithEmbed.batchEmbedContents!({
            requests: batch.map(text => ({
              content: { parts: [{ text }] },
              taskType,
            })),
          });
          const extractedBatch = this.extractEmbeddingBatchValues(batchResult, batch.length);
          allResults.push(...extractedBatch);
        }
        return allResults;
      }

      const results: Array<number[] | null> = [];
      for (const text of texts) {
        const result = await modelWithEmbed.embedContent!({
          content: { parts: [{ text }] },
          taskType,
        });
        results.push(this.extractEmbeddingValues(result));
      }
      return results;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return texts.map(() => null);
    }
  }

  /**
   * Extract vector values from SDK response shapes.
   *
   * Why: SDK versions can expose different response envelopes.
   */
  private extractEmbeddingValues(result: unknown): number[] | null {
    if (!result || typeof result !== 'object') {
      return null;
    }

    const asRecord = result as Record<string, unknown>;

    const directValues = asRecord.values;
    if (Array.isArray(directValues) && directValues.every(v => typeof v === 'number')) {
      return directValues as number[];
    }

    const directEmbedding = asRecord.embedding as unknown;
    if (directEmbedding && typeof directEmbedding === 'object') {
      const values = (directEmbedding as Record<string, unknown>).values;
      if (Array.isArray(values) && values.every(v => typeof v === 'number')) {
        return values as number[];
      }
    }

    const embeddings = asRecord.embeddings;
    if (Array.isArray(embeddings) && embeddings.length > 0) {
      const first = embeddings[0];
      if (first && typeof first === 'object') {
        const values = (first as Record<string, unknown>).values;
        if (Array.isArray(values) && values.every(v => typeof v === 'number')) {
          return values as number[];
        }
      }
    }

    return null;
  }

  /**
   * Extract embeddings from batch response in a shape-tolerant way.
   */
  private extractEmbeddingBatchValues(
    result: unknown,
    expectedCount: number
  ): Array<number[] | null> {
    if (!result || typeof result !== 'object') {
      return Array.from({ length: expectedCount }, () => null);
    }

    const asRecord = result as Record<string, unknown>;
    const candidateArrays = [
      asRecord.embeddings,
      asRecord.responses,
      (asRecord.batch as Record<string, unknown> | undefined)?.embeddings,
    ];

    for (const candidate of candidateArrays) {
      if (Array.isArray(candidate)) {
        const extracted = candidate.map(item => this.extractEmbeddingValues(item));
        if (extracted.length >= expectedCount) {
          return extracted.slice(0, expectedCount);
        }
        return [...extracted, ...Array.from({ length: expectedCount - extracted.length }, () => null)];
      }
    }

    // Fallback: single object shape accidentally returned for one-item batch.
    if (expectedCount === 1) {
      return [this.extractEmbeddingValues(result)];
    }

    return Array.from({ length: expectedCount }, () => null);
  }

  /**
   * Embed a log entry as retrieval document.
   */
  public async embedLog(log: LogEntry): Promise<number[] | null> {
    const text = this.buildEmbeddingText(log);
    return this.embedText(text, 'RETRIEVAL_DOCUMENT');
  }

  /**
   * Embed user query as retrieval query vector.
   */
  public async embedQuery(query: string): Promise<number[] | null> {
    return this.embedText(query, 'RETRIEVAL_QUERY');
  }

  /**
   * Embed arbitrary document text for retrieval.
   *
   * @param text - Retrieval document text
   * @returns Embedding vector or null when embedding fails
   */
  public async embedDocument(text: string): Promise<number[] | null> {
    return this.embedText(text, 'RETRIEVAL_DOCUMENT');
  }

  /**
   * Cosine similarity between vectors.
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return -1;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return -1;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieve top-K candidate logs by similarity to query.
   *
   * Why: limits prompt context to semantically relevant subset regardless
   * of overall log volume.
   */
  public async retrieveTopKByQuery(
    query: string,
    candidateLogs: LogEntry[],
    k: number
  ): Promise<LogEntry[]> {
    const queryEmbedding = await this.embedQuery(query);
    if (!queryEmbedding) {
      return candidateLogs.slice(0, k);
    }

    const missingIndexes: number[] = [];
    const missingTexts: string[] = [];
    for (let i = 0; i < candidateLogs.length; i++) {
      const log = candidateLogs[i];
      if (!log.embedding || log.embedding.length === 0) {
        missingIndexes.push(i);
        missingTexts.push(this.buildEmbeddingText(log));
      }
    }

    if (missingTexts.length > 0) {
      const generated = await this.embedTexts(missingTexts, 'RETRIEVAL_DOCUMENT');
      for (let i = 0; i < missingIndexes.length; i++) {
        const logIndex = missingIndexes[i];
        const embedding = generated[i];
        if (!embedding) {
          continue;
        }
        const log = candidateLogs[logIndex];
        log.embedding = embedding;
        log.hasEmbedding = true;
        dbManager.updateLogEmbedding(log.id, embedding).catch((error) => {
          console.error('Failed to persist log embedding:', error);
        });
      }
    }

    const scored: Array<{ log: LogEntry; score: number }> = [];
    for (const log of candidateLogs) {
      if (!log.embedding || log.embedding.length === 0) {
        continue;
      }
      scored.push({ log, score: this.cosineSimilarity(queryEmbedding, log.embedding) });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(item => item.log);
  }

  /**
   * Eagerly embed high-priority logs (ERROR/WARN) in background.
   */
  public async indexLogFile(
    logs: LogEntry[],
    onProgress?: (pct: number) => void
  ): Promise<void> {
    const targets = logs.filter(log => (log.level === 'ERROR' || log.level === 'WARN') && !log.hasEmbedding);
    if (targets.length === 0) {
      onProgress?.(100);
      return;
    }

    for (let i = 0; i < targets.length; i += EmbeddingService.MAX_BATCH_SIZE) {
      const batch = targets.slice(i, i + EmbeddingService.MAX_BATCH_SIZE);
      const texts = batch.map(log => this.buildEmbeddingText(log));
      const embeddings = await this.embedTexts(texts, 'RETRIEVAL_DOCUMENT');

      for (let j = 0; j < batch.length; j++) {
        const log = batch[j];
        const embedding = embeddings[j];
        if (!embedding) {
          continue;
        }
        log.embedding = embedding;
        log.hasEmbedding = true;
        try {
          await dbManager.updateLogEmbedding(log.id, embedding);
        } catch (error) {
          console.error('Failed saving embedding during indexing:', error);
        }
      }

      const processed = Math.min(i + batch.length, targets.length);
      onProgress?.(Math.round((processed / targets.length) * 100));
    }
  }
}

export const embeddingService = new EmbeddingService();

