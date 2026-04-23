import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FilterChipBar } from '../FilterChipBar';
import { useLogContext } from '../../../../contexts/LogContext';

vi.mock('../../../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

const mockUseLogContext = vi.mocked(useLogContext);

describe('FilterChipBar', () => {
  beforeEach(() => {
    mockUseLogContext.mockReturnValue({
      filteredLogs: [
        { id: 1, level: 'ERROR' },
        { id: 2, level: 'INFO' },
      ],
      logs: [
        { id: 1, level: 'ERROR' },
        { id: 2, level: 'INFO' },
        { id: 3, level: 'WARN' },
      ],
      selectedLevels: new Set(['ERROR']),
      toggleLevel: vi.fn(),
      isSipFilterEnabled: true,
      setIsSipFilterEnabled: vi.fn(),
      selectedSipMethods: new Set(['INVITE']),
      activeCorrelations: [{ type: 'callId', value: 'call-1' }],
      clearFilterSelections: vi.fn(),
      useIndexedDBMode: false,
      totalLogCount: 0,
    } as unknown as ReturnType<typeof useLogContext>);
  });

  it('renders live counts and clears active filters', () => {
    const clearFilterSelections = vi.fn();
    mockUseLogContext.mockReturnValue({
      ...mockUseLogContext(),
      clearFilterSelections,
    } as unknown as ReturnType<typeof useLogContext>);

    render(<FilterChipBar />);

    expect(screen.getByText('2 / 3 events')).toBeInTheDocument();
    expect(screen.getByText('SIP')).toBeInTheDocument();
    expect(screen.getByText('1 correlations')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(clearFilterSelections).toHaveBeenCalledTimes(1);
  });
});
