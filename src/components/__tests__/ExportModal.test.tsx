import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ExportModal from '../export/ExportModal';
import { useLogContext } from '../../contexts/LogContext';
import { useCase } from '../../store/caseContext';

vi.mock('../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('../../store/caseContext', () => ({
  useCase: vi.fn(),
}));

vi.mock('../../services/zipBuilder', () => ({
  buildZip: vi.fn(() => new Blob(['zip'])),
  downloadBlob: vi.fn(),
}));

const mockUseLogContext = useLogContext as ReturnType<typeof vi.fn>;
const mockUseCase = useCase as ReturnType<typeof vi.fn>;

describe('ExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogContext.mockReturnValue({
      filteredLogs: [],
      logs: [
        {
          id: 1,
          timestamp: 100,
          rawTimestamp: '2026-03-08T00:00:00.000Z',
          level: 'INFO',
          component: 'test.component',
          displayComponent: 'TestComponent',
          message: 'Test message',
          displayMessage: 'Test message',
          payload: '',
          type: 'LOG',
          isSip: false,
          fileName: 'sample.log',
          sourceType: 'apex',
          sourceLabel: 'APEX',
        },
      ],
      favoriteLogIds: new Set<number>(),
      importedDatasets: [],
    });
    mockUseCase.mockReturnValue({ activeCase: null });
  });

  it('shows the case requirement when evidence pack mode is selected without an active case', () => {
    render(<ExportModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByText('Evidence Pack'));

    expect(screen.getByText(/No active case/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Export$/ })).toBeDisabled();
  });

  it('enables evidence pack export when the active case has evidence', () => {
    mockUseCase.mockReturnValue({
      activeCase: {
        id: 'case_1',
        title: 'Investigation',
        severity: 'medium',
        status: 'open',
        summary: '',
        impact: '',
        createdAt: 1,
        updatedAt: 1,
        attachments: [],
        bookmarks: [{ id: 'bookmark_1', logId: 1, tag: 'evidence', timestamp: 100 }],
        notes: [],
        timeWindow: { start: 100, end: 200 },
      },
    });

    render(<ExportModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByText('Evidence Pack'));

    expect(screen.getByText(/Building a pack/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Export$/ })).not.toBeDisabled();
  });
});
