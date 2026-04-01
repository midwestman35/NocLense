import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  const sampleLog = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogContext.mockReturnValue({
      logs: [sampleLog],
      toggleCorrelation: vi.fn(),
      setActiveCorrelations: vi.fn(),
      activeCorrelations: [],
      aiHighlightedLogIds: new Set<number>(),
      aiHighlightReasons: new Map(),
    });
    mockUseCase.mockReturnValue({
      activeCase: {
        id: 'case_1',
        title: 'Investigation',
        bookmarks: [],
        notes: [],
      },
      addBookmark: vi.fn(),
      addNote: vi.fn(),
    });
  });

  it('renders log detail fields correctly', () => {
    render(
      <LogDetailsPanel
        log={sampleLog as any}
        onClose={() => {}}
        onJumpToLog={() => {}}
      />
    );

    expect(screen.getByText('test.component')).toBeInTheDocument();
    expect(screen.getByText('APEX')).toBeInTheDocument();
    expect(screen.getByText('sample.log')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('renders AI highlight reason when log is AI-highlighted', () => {
    mockUseLogContext.mockReturnValue({
      logs: [sampleLog],
      toggleCorrelation: vi.fn(),
      setActiveCorrelations: vi.fn(),
      activeCorrelations: [],
      aiHighlightedLogIds: new Set<number>([7]),
      aiHighlightReasons: new Map([[7, 'SIP transport failure detected']]),
    });

    render(
      <LogDetailsPanel
        log={sampleLog as any}
        onClose={() => {}}
        onJumpToLog={() => {}}
      />
    );

    expect(screen.getByText('SIP transport failure detected')).toBeInTheDocument();
    expect(screen.getByText('AI Diagnosis')).toBeInTheDocument();
  });
});
