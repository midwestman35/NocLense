import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ParseOverlay from '../ParseOverlay';

const mockUseCuteLoadingLabel = vi.fn();
const mockUsePrefersReducedMotion = vi.fn();

vi.mock('../../hooks/useCuteLoadingLabel', () => ({
  useCuteLoadingLabel: (...args: unknown[]) => mockUseCuteLoadingLabel(...args),
}));

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockUsePrefersReducedMotion(),
}));

describe('ParseOverlay', () => {
  it('renders spinner and cute label when progress is active', () => {
    mockUseCuteLoadingLabel.mockReturnValue({ phrase: 'parsing...', index: 0, active: true });
    mockUsePrefersReducedMotion.mockReturnValue(false);

    render(<ParseOverlay progress={42} />);

    expect(screen.getByTestId('parse-overlay-spinner')).toBeInTheDocument();
    expect(screen.getByText('parsing...')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders collapsed when progress is null', () => {
    mockUseCuteLoadingLabel.mockReturnValue({ phrase: 'parsing...', index: 0, active: false });
    mockUsePrefersReducedMotion.mockReturnValue(false);

    render(<ParseOverlay progress={null} />);

    expect(screen.getByTestId('parse-overlay')).toHaveAttribute('data-state', 'closed');
    expect(screen.queryByTestId('parse-overlay-spinner')).not.toBeInTheDocument();
  });

  it('uses a static spinner under reduced motion', () => {
    mockUseCuteLoadingLabel.mockReturnValue({ phrase: 'parsing...', index: 0, active: false });
    mockUsePrefersReducedMotion.mockReturnValue(true);

    render(<ParseOverlay progress={20} />);

    expect(screen.getByTestId('parse-overlay-static-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('parse-overlay-spinner')).not.toBeInTheDocument();
  });
});
