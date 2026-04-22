import type { Case } from '../types/case';
import { dbManager } from '../utils/indexedDB';

interface ListCasesOptions {
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown IndexedDB error';
}

export class CaseRepository {
  async saveCase(caseItem: Case): Promise<void> {
    try {
      await dbManager.saveCase(caseItem);
    } catch (error) {
      throw new Error(`Failed to save case "${caseItem.id}": ${getErrorMessage(error)}`);
    }
  }

  async getCase(id: string): Promise<Case | null> {
    try {
      return await dbManager.getCase(id);
    } catch (error) {
      throw new Error(`Failed to get case "${id}": ${getErrorMessage(error)}`);
    }
  }

  async listCases(opts?: ListCasesOptions): Promise<Case[]> {
    try {
      return await dbManager.listCases(opts);
    } catch (error) {
      throw new Error(`Failed to list cases: ${getErrorMessage(error)}`);
    }
  }

  async deleteCase(id: string): Promise<void> {
    try {
      await dbManager.deleteCase(id);
    } catch (error) {
      throw new Error(`Failed to delete case "${id}": ${getErrorMessage(error)}`);
    }
  }

  async updateCaseEmbedding(
    id: string,
    embedding: number[],
    version: string,
  ): Promise<void> {
    try {
      await dbManager.updateCaseEmbedding(id, embedding, version);
    } catch (error) {
      throw new Error(`Failed to update embedding for case "${id}": ${getErrorMessage(error)}`);
    }
  }
}

export const caseRepository = new CaseRepository();
