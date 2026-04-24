import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SimilarCaseMatch } from '../../../services/caseLibraryService';
import type { Case } from '../../../types/case';
import { DashboardScreen } from '../DashboardScreen';

const { mockListCases, mockFindSimilar } = vi.hoisted(() => ({
  mockListCases: vi.fn(),
  mockFindSimilar: vi.fn(),
}));

vi.mock('../../../services/caseRepository', () => ({
  caseRepository: {
    listCases: mockListCases,
  },
}));

vi.mock('../../../services/caseLibraryService', () => ({
  caseLibraryService: {
    findSimilar: mockFindSimilar,
  },
}));

function buildCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case_001',
    title: 'Dispatch 4 cannot hear caller audio',
    severity: 'high',
    status: 'open',
    owner: 'K. Nguyen',
    externalRef: '41637',
    summary: 'Audio path drops after the first SIP handshake.',
    impact: '911 calls intermittently lose inbound audio.',
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_100_000,
    attachments: [],
    bookmarks: [],
    notes: [],
    ...overrides,
  };
}

describe('DashboardScreen', () => {
  it('loads cases from the repository and enriches the lead case from the case library', async () => {
    const cases = [
      buildCase(),
      buildCase({
        id: 'case_002',
        externalRef: '41601',
        title: 'CAD map tiles recovered after restart',
        severity: 'medium',
        status: 'resolved',
      }),
    ];
    const similarMatches: SimilarCaseMatch[] = [
      {
        case: buildCase({
          id: 'case_003',
          externalRef: '41588',
          title: 'Text-to-911 backlog cleared after SIP restart',
          status: 'resolved',
        }),
        score: 0.82,
      },
    ];

    mockListCases.mockResolvedValue(cases);
    mockFindSimilar.mockResolvedValue(similarMatches);

    render(<DashboardScreen onOpenWorkspace={vi.fn()} />);

    expect((await screen.findAllByText(/dispatch 4 cannot hear caller audio/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/open · 1/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockListCases).toHaveBeenCalledWith({ orderBy: 'updatedAt', limit: 10 });
      expect(mockFindSimilar).toHaveBeenCalled();
    });
  });
});
