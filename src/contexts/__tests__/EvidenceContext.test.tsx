import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeInvestigation } from '../../components/ai/diagnose/__tests__/canonicalBlockTestUtils';
import { EvidenceProvider, useEvidence } from '../EvidenceContext';
import { CaseProvider, useCase } from '../../store/caseContext';
import { asInvestigationId } from '../../types/canonical';

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CaseProvider>
        <EvidenceProvider>{children}</EvidenceProvider>
      </CaseProvider>
    );
  };
}

describe('EvidenceContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('pinBlock adds a new item at order 0', () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const investigation = makeInvestigation();
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(investigation);
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
    });

    expect(result.current.evidence.evidenceSet?.items).toEqual([
      expect.objectContaining({
        blockId: investigation.blocks[0].id,
        order: 0,
        pinnedAt: 1_000,
        pinnedBy: 'user',
      }),
    ]);
  });

  it('pinBlock on an existing block updates pinnedAt, moves it to order 0, and does not duplicate', () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const investigation = makeInvestigation();
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(investigation);
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
    });
    now = 2_000;
    act(() => {
      result.current.evidence.pinBlock(investigation.blocks[1], 'ai');
    });
    now = 3_000;
    act(() => {
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
    });

    expect(result.current.evidence.evidenceSet?.items).toHaveLength(2);
    expect(result.current.evidence.evidenceSet?.items[0]).toEqual(
      expect.objectContaining({
        blockId: investigation.blocks[0].id,
        order: 0,
        pinnedAt: 3_000,
      }),
    );
    expect(result.current.evidence.evidenceSet?.items[1]).toEqual(
      expect.objectContaining({
        blockId: investigation.blocks[1].id,
        order: 1,
      }),
    );
  });

  it('unpinBlock removes the matching item', () => {
    const investigation = makeInvestigation();
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(investigation);
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
      result.current.evidence.pinBlock(investigation.blocks[1], 'user');
      result.current.evidence.unpinBlock(investigation.blocks[0].id);
    });

    expect(result.current.evidence.evidenceSet?.items).toEqual([
      expect.objectContaining({ blockId: investigation.blocks[1].id, order: 0 }),
    ]);
  });

  it('reorderItems reassigns order fields based on the provided id list', () => {
    const investigation = makeInvestigation();
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(investigation);
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
      result.current.evidence.pinBlock(investigation.blocks[1], 'user');
      result.current.evidence.pinBlock(investigation.blocks[2], 'user');
      result.current.evidence.reorderItems([
        investigation.blocks[0].id,
        investigation.blocks[2].id,
        investigation.blocks[1].id,
      ]);
    });

    expect(result.current.evidence.evidenceSet?.items.map((item) => [item.blockId, item.order])).toEqual([
      [investigation.blocks[0].id, 0],
      [investigation.blocks[2].id, 1],
      [investigation.blocks[1].id, 2],
    ]);
  });

  it('updateItemNote sets and clears the item note', () => {
    const investigation = makeInvestigation();
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(investigation);
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
      result.current.evidence.updateItemNote(investigation.blocks[0].id, 'Pinned for handoff');
    });
    expect(result.current.evidence.evidenceSet?.items[0].note).toBe('Pinned for handoff');

    act(() => {
      result.current.evidence.updateItemNote(investigation.blocks[0].id, undefined);
    });
    expect(result.current.evidence.evidenceSet?.items[0].note).toBeUndefined();
  });

  it('setInvestigation replaces the active investigation and resets the evidence set', () => {
    const firstInvestigation = makeInvestigation();
    const secondInvestigation = {
      ...makeInvestigation(),
      id: asInvestigationId('investigation-02'),
    };
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence(), caseState: useCase() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(firstInvestigation);
      result.current.evidence.pinBlock(firstInvestigation.blocks[0], 'user');
    });
    expect(result.current.evidence.evidenceSet?.items).toHaveLength(1);

    act(() => {
      result.current.evidence.setInvestigation(secondInvestigation);
    });

    expect(result.current.evidence.investigation?.id).toBe(secondInvestigation.id);
    expect(result.current.caseState.activeCaseId).toBeTruthy();
    expect(result.current.evidence.evidenceSet).toEqual({
      caseId: result.current.caseState.activeCaseId,
      investigationId: secondInvestigation.id,
      items: [],
    });
  });

  it('creates the case once on first pin when no active case exists', () => {
    const investigation = makeInvestigation();
    const wrapper = createWrapper();
    const { result } = renderHook(() => ({ evidence: useEvidence(), caseState: useCase() }), { wrapper });

    act(() => {
      result.current.evidence.setInvestigation(investigation);
    });
    expect(result.current.caseState.activeCaseId).toBeNull();
    expect(result.current.evidence.evidenceSet?.caseId).toBe('');

    act(() => {
      result.current.evidence.pinBlock(investigation.blocks[0], 'user');
    });

    expect(result.current.caseState.cases).toHaveLength(1);
    expect(result.current.caseState.cases[0].title).toBe(
      'Acme PSAP · https://carbyne.zendesk.com/agent/tickets/45892',
    );
    const firstCaseId = result.current.caseState.activeCaseId;
    expect(result.current.evidence.evidenceSet?.caseId).toBe(firstCaseId);

    act(() => {
      result.current.evidence.pinBlock(investigation.blocks[1], 'user');
    });

    expect(result.current.caseState.cases).toHaveLength(1);
    expect(result.current.caseState.activeCaseId).toBe(firstCaseId);
  });
});
