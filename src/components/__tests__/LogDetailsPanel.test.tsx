import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LogDetailsPanel from '../log/LogDetailsPanel';
import { useLogContext } from '../../contexts/LogContext';
import { useCase } from '../../store/caseContext';

vi.mock('../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('../../store/caseContext', () => ({
  useCase: vi.fn(),
}));

vi.mock('../../utils/structuredFields', () => ({
  getStructuredFields: vi.fn(() => []),
}));

vi.mock('../AIButton', () => ({
  default: () => <button type="button">Explain with AI</button>,
}));

const mockUseLogContext = useLogContext as ReturnType<typeof vi.fn>;
const mockUseCase = useCase as ReturnType<typeof vi.fn>;

describe('LogDetailsPanel', () => {
  const addBookmark = vi.fn();
  const addNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogContext.mockReturnValue({
      logs: [],
      toggleCorrelation: vi.fn(),
      setActiveCorrelations: vi.fn(),
      activeCorrelations: [],
    });
    mockUseCase.mockReturnValue({
      activeCase: {
        id: 'case_1',
        title: 'Investigation',
        bookmarks: [],
        notes: [],
      },
      addBookmark,
      addNote,
    });
  });

  it('adds evidence to the active case with an optional note', () => {
    render(
      <LogDetailsPanel
        log={{
          id: 7,
          timestamp: 1000,
          rawTimestamp: '2026-03-08T00:00:01.000Z',
          level: 'ERROR',
          component: 'test.component',
          displayComponent: 'TestComponent',
          message: 'Failure for callId=abc123',
          displayMessage: 'Failure for callId=abc123',
          payload: 'payload',
          type: 'LOG',
          isSip: false,
          callId: 'abc123',
          fileName: 'sample.log',
          sourceLabel: 'APEX',
        }}
        onClose={() => {}}
        onJumpToLog={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Why does this event matter/i), {
      target: { value: 'This is the first correlated failure.' },
    });
    fireEvent.click(screen.getByText('Add evidence'));

    expect(addBookmark).toHaveBeenCalled();
    expect(addNote).toHaveBeenCalled();
  });
});
