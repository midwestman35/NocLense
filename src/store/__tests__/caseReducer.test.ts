import { describe, expect, it } from 'vitest';
import { caseReducer, type CaseStoreState } from '../caseReducer';
import type { Case } from '../../types/case';

function createCase(): Case {
  return {
    id: 'case_1',
    title: 'Test case',
    severity: 'medium',
    status: 'open',
    summary: '',
    impact: '',
    createdAt: 1,
    updatedAt: 1,
    attachments: [],
    bookmarks: [],
    notes: [],
    timeWindow: null,
  };
}

describe('caseReducer', () => {
  it('adds evidence bookmarks keyed by logId', () => {
    const initial: CaseStoreState = { cases: [createCase()], activeCaseId: 'case_1' };
    const next = caseReducer(initial, {
      type: 'ADD_BOOKMARK',
      payload: {
        caseId: 'case_1',
        bookmark: {
          id: 'bookmark_1',
          logId: 42,
          tag: 'evidence',
          timestamp: 100,
        },
      },
    });

    expect(next.cases[0].bookmarks).toHaveLength(1);
    expect(next.cases[0].bookmarks[0].logId).toBe(42);
  });

  it('persists investigation state updates with selected log and panel', () => {
    const initial: CaseStoreState = { cases: [createCase()], activeCaseId: 'case_1' };
    const next = caseReducer(initial, {
      type: 'UPDATE_CASE_STATE',
      payload: {
        caseId: 'case_1',
        state: {
          pivots: ['callId:abc123'],
          filters: {
            filterText: 'abc123',
            activeCorrelations: [{ type: 'callId', value: 'abc123' }],
            selectedMessageTypeFilter: 'OPTIONS',
          },
          timeWindow: { start: 10, end: 20 },
          selectedLogId: 99,
          activePanel: 'case',
        },
      },
    });

    expect(next.cases[0].state?.selectedLogId).toBe(99);
    expect(next.cases[0].state?.activePanel).toBe('case');
    expect(next.cases[0].state?.filters.filterText).toBe('abc123');
  });
});
