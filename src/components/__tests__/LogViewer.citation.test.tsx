import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LogViewer, { type LogViewerHandle } from '../LogViewer';
import { useLogContext } from '../../contexts/LogContext';

const scrollToIndex = vi.fn();
const setSelectedLogId = vi.fn();
const toggleCorrelation = vi.fn();
const mockUseLogContext = useLogContext as ReturnType<typeof vi.fn>;

vi.mock('../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 40 })),
    getTotalSize: () => count * 40,
    scrollToIndex,
    measureElement: vi.fn(),
    measure: vi.fn(),
  }),
}));

vi.mock('../LogRow', () => ({
  default: ({
    log,
    isCitationTarget,
  }: {
    log: { id: number; fileName?: string; displayMessage: string };
    isCitationTarget?: boolean;
  }) => (
    <div
      data-testid={`row-${log.id}`}
      data-citation-target={isCitationTarget ? 'true' : 'false'}
    >
      {log.fileName}:{log.displayMessage}
    </div>
  ),
}));

vi.mock('../LogStreamHeader', () => ({
  LogHeader: () => <div data-testid="log-header" />,
  TimeWindowStrip: () => <div data-testid="time-window" />,
}));

vi.mock('../ParseOverlay', () => ({
  default: () => <div data-testid="parse-overlay" />,
}));

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

vi.mock('../../utils/anime', () => ({
  useAnimeStagger: () => undefined,
}));

const logs = [
  {
    id: 1,
    timestamp: 1,
    rawTimestamp: '1',
    level: 'INFO',
    component: 'CallProcessor',
    displayComponent: 'CallProcessor',
    message: 'alpha',
    displayMessage: 'alpha',
    payload: 'alpha payload',
    type: 'LOG',
    isSip: false,
    fileName: 'alpha.log',
    byteOffset: 10,
    traceId: 'trace-alpha',
  },
  {
    id: 2,
    timestamp: 2,
    rawTimestamp: '2',
    level: 'INFO',
    component: 'CallProcessor',
    displayComponent: 'CallProcessor',
    message: 'beta',
    displayMessage: 'beta',
    payload: 'beta payload',
    type: 'LOG',
    isSip: false,
    fileName: 'beta.log',
    byteOffset: 20,
    traceId: 'trace-beta',
  },
] as const;

describe('LogViewer citation jump', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogContext.mockReturnValue({
      logs,
      filteredLogs: logs,
      selectedLogId: null,
      setSelectedLogId,
      isTextWrapEnabled: false,
      setVisibleRange: vi.fn(),
      filterText: '',
      favoriteLogIds: new Set<number>(),
      toggleFavorite: vi.fn(),
      aiHighlightedLogIds: new Set<number>(),
      hoveredCorrelation: null,
      useIndexedDBMode: false,
      loadLogsFromIndexedDB: vi.fn(),
      visibleRange: { start: 0, end: 1 },
      isCollapseSimilarEnabled: false,
      activeCorrelations: [],
      toggleCorrelation,
      scrollTargetTimestamp: null,
      sortConfig: { field: 'timestamp', direction: 'asc' },
    });
  });

  it('jumpToCitation with an unknown byteOffset does nothing', () => {
    const ref = createRef<LogViewerHandle>();
    render(<LogViewer ref={ref} parseProgress={null} />);

    expect(() => {
      act(() => {
        ref.current?.jumpToCitation('alpha.log', 999);
      });
    }).not.toThrow();

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('jumpToCitation highlights the matched entry id', async () => {
    const ref = createRef<LogViewerHandle>();
    render(<LogViewer ref={ref} parseProgress={null} />);

    act(() => {
      ref.current?.jumpToCitation('alpha.log', 10);
    });

    await waitFor(() => {
      expect(screen.getByTestId('row-1')).toHaveAttribute('data-citation-target', 'true');
    });
  });

  it('jumpToCitation switches tabs when the citation belongs to another file', async () => {
    const ref = createRef<LogViewerHandle>();
    render(<LogViewer ref={ref} parseProgress={null} />);

    act(() => {
      ref.current?.jumpToCitation('beta.log', 20);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('row-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('row-2')).toBeInTheDocument();
    });
  });

  it('shows a header chip when a citation jump occurs', async () => {
    const ref = createRef<LogViewerHandle>();
    render(<LogViewer ref={ref} parseProgress={null} />);

    act(() => {
      ref.current?.jumpToCitation('alpha.log', 10);
    });

    await waitFor(() => {
      expect(screen.getByTestId('citation-jump-chip')).toBeInTheDocument();
    });
  });

  it('clears the header chip on dismiss click', async () => {
    const ref = createRef<LogViewerHandle>();
    render(<LogViewer ref={ref} parseProgress={null} />);

    act(() => {
      ref.current?.jumpToCitation('alpha.log', 10);
    });

    await waitFor(() => {
      expect(screen.getByTestId('citation-jump-chip')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss citation jump notice'));

    expect(screen.queryByTestId('citation-jump-chip')).not.toBeInTheDocument();
  });
});
