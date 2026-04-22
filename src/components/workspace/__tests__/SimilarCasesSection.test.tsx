import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimilarCasesSection } from '../SimilarCasesSection';
import { useCase } from '../../../store/caseContext';
import { caseLibraryService } from '../../../services/caseLibraryService';
import { embeddingService } from '../../../services/embeddingService';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import type { Case } from '../../../types/case';

const setActiveCaseMock = vi.fn();

vi.mock('../../../store/caseContext', () => ({
  useCase: vi.fn(),
}));

vi.mock('../../../services/caseLibraryService', () => ({
  caseLibraryService: {
    findSimilar: vi.fn(),
  },
}));

vi.mock('../../../services/embeddingService', () => ({
  embeddingService: {
    isInitialized: vi.fn(),
  },
}));

vi.mock('../../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

const mockUseCase = vi.mocked(useCase);
const mockFindSimilar = vi.mocked(caseLibraryService.findSimilar);
const mockEmbeddingInitialized = vi.mocked(embeddingService.isInitialized);
const mockUsePrefersReducedMotion = vi.mocked(usePrefersReducedMotion);

function createCase(overrides: Partial<Case> = {}): Case {
  return {
    id: overrides.id ?? `case_${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? 'Case title',
    severity: overrides.severity ?? 'medium',
    status: overrides.status ?? 'open',
    summary: overrides.summary ?? 'Summary text for the similar case row.',
    impact: overrides.impact ?? 'Impact text',
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

function renderSection(activeCase: Case | null, cases: Case[] = activeCase ? [activeCase] : []) {
  mockUseCase.mockReturnValue({
    activeCase,
    cases,
    setActiveCase: setActiveCaseMock,
  } as unknown as ReturnType<typeof useCase>);

  return render(<SimilarCasesSection />);
}

describe('SimilarCasesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddingInitialized.mockReturnValue(true);
    mockUsePrefersReducedMotion.mockReturnValue(false);
    mockFindSimilar.mockResolvedValue([]);
  });

  it('shows up to 5 similar cases for the active case', async () => {
    const activeCase = createCase({ id: 'case_active', title: 'Active case' });
    const matches = Array.from({ length: 6 }, (_, index) => ({
      case: createCase({
        id: `case_match_${index + 1}`,
        title: `Similar case ${index + 1}`,
        updatedAt: Date.now() - ((index + 1) * 60_000),
      }),
      score: 0.9 - (index * 0.1),
    }));

    mockFindSimilar.mockResolvedValue(matches);

    renderSection(activeCase, [activeCase, ...matches.map((match) => match.case)]);

    await waitFor(() => {
      expect(mockFindSimilar).toHaveBeenCalledWith(activeCase, {
        topK: 5,
        filters: { excludeCaseIds: ['case_active'] },
      });
    });

    expect(screen.getAllByTestId('similar-case-row')).toHaveLength(5);
    expect(screen.getByText('Similar case 1')).toBeInTheDocument();
    expect(screen.queryByText('Similar case 6')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 5 similar past cases')).toBeInTheDocument();
  });

  it('shows the empty active-case state when no case is selected', () => {
    renderSection(null, []);

    expect(screen.getByText('No active case yet.')).toBeInTheDocument();
    expect(mockFindSimilar).not.toHaveBeenCalled();
  });

  it('shows the empty-library copy when there are no past cases', async () => {
    const activeCase = createCase({ id: 'case_active' });
    mockFindSimilar.mockResolvedValue([]);

    renderSection(activeCase, [activeCase]);

    await waitFor(() => {
      expect(screen.getByText('The library fills as you create and resolve investigations both new ones and imported `.noclense` packs.')).toBeInTheDocument();
    });
  });

  it('shows the embedder configuration prompt when embeddings are unavailable', () => {
    const activeCase = createCase({ id: 'case_active' });
    mockEmbeddingInitialized.mockReturnValue(false);

    renderSection(activeCase, [activeCase]);

    expect(screen.getByText(/VITE_GEMINI_EMBEDDING_KEY/)).toBeInTheDocument();
    expect(mockFindSimilar).not.toHaveBeenCalled();
  });

  it('uses the active case id in excludeCaseIds so the current case never self-lists', async () => {
    const activeCase = createCase({ id: 'case_self' });

    renderSection(activeCase, [activeCase, createCase({ id: 'case_other' })]);

    await waitFor(() => {
      expect(mockFindSimilar).toHaveBeenCalledWith(activeCase, expect.objectContaining({
        filters: { excludeCaseIds: ['case_self'] },
      }));
    });
  });

  it('supports arrow-key navigation and Enter activation', async () => {
    const activeCase = createCase({ id: 'case_active' });
    const firstMatch = { case: createCase({ id: 'case_one', title: 'First match' }), score: 0.9 };
    const secondMatch = { case: createCase({ id: 'case_two', title: 'Second match' }), score: 0.8 };

    mockFindSimilar.mockResolvedValue([firstMatch, secondMatch]);

    renderSection(activeCase, [activeCase, firstMatch.case, secondMatch.case]);

    await waitFor(() => {
      expect(screen.getAllByTestId('similar-case-row')).toHaveLength(2);
    });

    const [firstRow, secondRow] = screen.getAllByTestId('similar-case-row');

    fireEvent.focus(firstRow);
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
    expect(secondRow).toHaveFocus();

    fireEvent.keyDown(secondRow, { key: 'Enter' });
    expect(setActiveCaseMock).toHaveBeenCalledWith('case_two');
    expect(screen.getByText('Switching to case case_two')).toBeInTheDocument();
  });

  it('renders live regions for result and action announcements', async () => {
    const activeCase = createCase({ id: 'case_active' });
    mockFindSimilar.mockResolvedValue([{ case: createCase({ id: 'case_one' }), score: 0.9 }]);

    renderSection(activeCase, [activeCase, createCase({ id: 'case_one' })]);

    await waitFor(() => {
      expect(screen.getByTestId('similar-cases-status-live')).toHaveAttribute('aria-live', 'polite');
    });

    expect(screen.getByTestId('similar-cases-action-live')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByTestId('similar-cases-status-live')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByTestId('similar-cases-action-live')).toHaveAttribute('aria-atomic', 'true');
  });

  it('skips the shimmer class when reduced motion is enabled', async () => {
    const activeCase = createCase({ id: 'case_active' });
    mockUsePrefersReducedMotion.mockReturnValue(true);
    mockFindSimilar.mockReturnValue(new Promise(() => {}));

    renderSection(activeCase, [activeCase]);

    await waitFor(() => {
      expect(screen.getAllByTestId('similar-cases-skeleton')).toHaveLength(3);
    });

    expect(document.querySelector('.animate-shimmer')).toBeNull();
  });
});
