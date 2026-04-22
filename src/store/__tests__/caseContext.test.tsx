import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Case } from '../../types/case';

const {
  mockDeleteCase,
  mockListCases,
  mockSaveCase,
} = vi.hoisted(() => ({
  mockDeleteCase: vi.fn().mockResolvedValue(undefined),
  mockListCases: vi.fn().mockResolvedValue([]),
  mockSaveCase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/caseRepository', () => ({
  caseRepository: {
    deleteCase: mockDeleteCase,
    listCases: mockListCases,
    saveCase: mockSaveCase,
  },
}));

import { CaseProvider, useCase } from '../caseContext';

function createCase(overrides: Partial<Case> = {}): Case {
  return {
    id: overrides.id ?? 'hydrated_case',
    title: overrides.title ?? 'Hydrated case',
    severity: overrides.severity ?? 'medium',
    status: overrides.status ?? 'open',
    summary: overrides.summary ?? 'Hydrated summary',
    impact: overrides.impact ?? 'Hydrated impact',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 2,
    attachments: overrides.attachments ?? [],
    bookmarks: overrides.bookmarks ?? [],
    notes: overrides.notes ?? [],
    timeWindow: overrides.timeWindow ?? null,
    state: overrides.state,
  };
}

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CaseProvider>{children}</CaseProvider>;
  };
}

describe('CaseProvider persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mockDeleteCase.mockResolvedValue(undefined);
    mockListCases.mockResolvedValue([]);
    mockSaveCase.mockResolvedValue(undefined);
  });

  it('hydrates cases from the repository on mount', async () => {
    const hydratedCase = createCase();
    mockListCases.mockResolvedValue([hydratedCase]);

    const { result } = renderHook(() => useCase(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockListCases).toHaveBeenCalledWith({ orderBy: 'updatedAt' });
      expect(result.current.cases).toEqual([hydratedCase]);
    });
  });

  it('persists createCase through the repository singleton', async () => {
    const { result } = renderHook(() => useCase(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockListCases).toHaveBeenCalledWith({ orderBy: 'updatedAt' });
    });

    act(() => {
      result.current.createCase({ title: 'New case' });
    });

    await waitFor(() => {
      expect(mockSaveCase).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New case',
          status: 'open',
          severity: 'medium',
        }),
      );
    });
  });

  it('persists updates and derived case mutations after hydration', async () => {
    const { result } = renderHook(() => useCase(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockListCases).toHaveBeenCalled();
    });

    let caseId = '';
    act(() => {
      caseId = result.current.createCase({ title: 'Mutable case' });
    });

    await waitFor(() => {
      expect(mockSaveCase).toHaveBeenCalledTimes(1);
    });

    mockSaveCase.mockClear();

    act(() => {
      result.current.updateCase(caseId, { status: 'resolved' });
    });

    await waitFor(() => {
      expect(mockSaveCase).toHaveBeenCalledWith(
        expect.objectContaining({
          id: caseId,
          status: 'resolved',
        }),
      );
    });

    mockSaveCase.mockClear();

    act(() => {
      result.current.addBookmark(caseId, {
        id: 'bookmark_1',
        logId: 42,
        tag: 'evidence',
        timestamp: 100,
      });
    });

    await waitFor(() => {
      expect(mockSaveCase).toHaveBeenCalledWith(
        expect.objectContaining({
          id: caseId,
          bookmarks: [expect.objectContaining({ logId: 42 })],
        }),
      );
    });

    mockSaveCase.mockClear();

    act(() => {
      result.current.addNote(caseId, {
        id: 'note_1',
        content: 'Captured for handoff',
        timestamp: 200,
      });
      result.current.updateCaseState(caseId, {
        pivots: ['callId:abc123'],
        filters: { filterText: 'abc123' },
        timeWindow: { start: 10, end: 20 },
      });
    });

    await waitFor(() => {
      expect(mockSaveCase).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: caseId,
          notes: [expect.objectContaining({ content: 'Captured for handoff' })],
          state: expect.objectContaining({
            pivots: ['callId:abc123'],
            timeWindow: { start: 10, end: 20 },
          }),
        }),
      );
    });
  });

  it('persists deletions through the repository singleton', async () => {
    const { result } = renderHook(() => useCase(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockListCases).toHaveBeenCalled();
    });

    let caseId = '';
    act(() => {
      caseId = result.current.createCase({ title: 'Delete me' });
    });

    await waitFor(() => {
      expect(mockSaveCase).toHaveBeenCalledTimes(1);
    });

    mockDeleteCase.mockClear();

    act(() => {
      result.current.deleteCase(caseId);
    });

    await waitFor(() => {
      expect(mockDeleteCase).toHaveBeenCalledWith(caseId);
    });
  });
});
