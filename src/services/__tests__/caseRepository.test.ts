import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Case } from '../../types/case';
import { caseRepository } from '../caseRepository';
import { DB_NAME, dbManager } from '../../utils/indexedDB';

function createCase(overrides: Partial<Case> = {}): Case {
  return {
    id: overrides.id ?? `case_${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? 'Case title',
    severity: overrides.severity ?? 'medium',
    status: overrides.status ?? 'open',
    summary: overrides.summary ?? 'Summary',
    impact: overrides.impact ?? 'Impact',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    attachments: overrides.attachments ?? [],
    bookmarks: overrides.bookmarks ?? [],
    notes: overrides.notes ?? [],
    timeWindow: overrides.timeWindow ?? null,
    state: overrides.state,
    externalRef: overrides.externalRef,
    owner: overrides.owner,
    stakeholderTeam: overrides.stakeholderTeam,
    tenant: overrides.tenant,
    embedding: overrides.embedding,
    embeddingVersion: overrides.embeddingVersion,
  };
}

async function deleteDatabase(name: string): Promise<void> {
  dbManager.close();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe('CaseRepository', () => {
  beforeEach(async () => {
    await deleteDatabase(DB_NAME);
  });

  afterEach(async () => {
    await deleteDatabase(DB_NAME);
  });

  it('saveCase round-trips through getCase', async () => {
    const caseItem = createCase({ id: 'case_roundtrip', createdAt: 10, updatedAt: 20 });

    await caseRepository.saveCase(caseItem);

    await expect(caseRepository.getCase(caseItem.id)).resolves.toEqual(caseItem);
  });

  it('saving an existing case overwrites the previous record', async () => {
    const caseItem = createCase({ id: 'case_overwrite', title: 'Initial', updatedAt: 10 });
    await caseRepository.saveCase(caseItem);

    const updatedCase = createCase({
      ...caseItem,
      title: 'Updated title',
      status: 'resolved',
      updatedAt: 30,
    });
    await caseRepository.saveCase(updatedCase);

    await expect(caseRepository.getCase(caseItem.id)).resolves.toEqual(updatedCase);
  });

  it('listCases respects orderBy and limit', async () => {
    const oldest = createCase({ id: 'case_oldest', createdAt: 1, updatedAt: 10 });
    const newestByCreatedAt = createCase({ id: 'case_created', createdAt: 3, updatedAt: 20 });
    const newestByUpdatedAt = createCase({ id: 'case_updated', createdAt: 2, updatedAt: 30 });

    await caseRepository.saveCase(oldest);
    await caseRepository.saveCase(newestByCreatedAt);
    await caseRepository.saveCase(newestByUpdatedAt);

    await expect(caseRepository.listCases({ orderBy: 'createdAt' })).resolves.toEqual([
      newestByCreatedAt,
      newestByUpdatedAt,
      oldest,
    ]);

    await expect(caseRepository.listCases({ orderBy: 'updatedAt', limit: 2 })).resolves.toEqual([
      newestByUpdatedAt,
      newestByCreatedAt,
    ]);
  });

  it('deleteCase removes the record and unknown ids do not throw', async () => {
    const caseItem = createCase({ id: 'case_delete' });
    await caseRepository.saveCase(caseItem);

    await caseRepository.deleteCase(caseItem.id);

    await expect(caseRepository.getCase(caseItem.id)).resolves.toBeNull();
    await expect(caseRepository.deleteCase('missing_case')).resolves.toBeUndefined();
  });

  it('updateCaseEmbedding persists embedding and embeddingVersion', async () => {
    const caseItem = createCase({ id: 'case_embedding', updatedAt: 100 });
    await caseRepository.saveCase(caseItem);

    await caseRepository.updateCaseEmbedding(caseItem.id, [0.1, 0.2, 0.3], 'gemini-text-embedding-004');

    await expect(caseRepository.getCase(caseItem.id)).resolves.toEqual({
      ...caseItem,
      embedding: [0.1, 0.2, 0.3],
      embeddingVersion: 'gemini-text-embedding-004',
    });
  });

  it('getCase returns null for unknown ids', async () => {
    await expect(caseRepository.getCase('missing_case')).resolves.toBeNull();
  });
});
