/**
 * Unit Tests for QuotaExceededModal Component
 *
 * @module components/__tests__/QuotaExceededModal.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuotaExceededModal from '../QuotaExceededModal';
import { useAI } from '../../contexts/AIContext';

vi.mock('../../contexts/AIContext', () => ({
  useAI: vi.fn(),
}));

const mockUseAI = useAI as ReturnType<typeof vi.fn>;

describe('QuotaExceededModal', () => {
  const mockDismissQuotaExceeded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAI.mockReturnValue({
      usageStats: { requestsToday: 1500, requestsThisMinute: 5, totalTokensUsed: 10000, lastDailyReset: Date.now(), lastMinuteReset: Date.now() },
      dailyRequestLimit: 1500,
      dismissQuotaExceeded: mockDismissQuotaExceeded,
    });
  });

  it('renders with limit reached message', () => {
    render(<QuotaExceededModal />);
    expect(screen.getByRole('dialog', { name: /Daily Limit Reached/i })).toBeInTheDocument();
    expect(screen.getByText(/1500 \/ 1500/)).toBeInTheDocument();
    expect(screen.getByText(/midnight UTC/)).toBeInTheDocument();
  });

  it('calls dismissQuotaExceeded when Got it clicked', () => {
    render(<QuotaExceededModal />);
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(mockDismissQuotaExceeded).toHaveBeenCalledTimes(1);
  });

  it('calls dismissQuotaExceeded and onClose when provided', () => {
    const onClose = vi.fn();
    render(<QuotaExceededModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(mockDismissQuotaExceeded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
