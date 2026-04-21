import { render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CitationJumpChip } from '../CitationJumpChip';

describe('CitationJumpChip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when source is null', () => {
    const { container } = render(<CitationJumpChip source={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders hypothesis rank label when rank is provided', () => {
    render(<CitationJumpChip source={{ hypothesisRank: 2 }} onDismiss={() => {}} />);
    expect(screen.getByText(/⟵ jumped from H2/)).toBeInTheDocument();
  });

  it('falls back to custom label when no rank', () => {
    render(<CitationJumpChip source={{ label: 'Diagnose' }} onDismiss={() => {}} />);
    expect(screen.getByText(/⟵ jumped from Diagnose/)).toBeInTheDocument();
  });

  it('falls back to generic label when neither rank nor label', () => {
    render(<CitationJumpChip source={{}} onDismiss={() => {}} />);
    expect(screen.getByText(/⟵ jumped from citation/)).toBeInTheDocument();
  });

  it('auto-dismisses after the configured delay', () => {
    const onDismiss = vi.fn();
    render(
      <CitationJumpChip
        source={{ hypothesisRank: 1 }}
        onDismiss={onDismiss}
        autoDismissMs={1000}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when the × button is clicked', () => {
    vi.useRealTimers();
    const onDismiss = vi.fn();
    render(<CitationJumpChip source={{ hypothesisRank: 1 }} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('announces via role="status" for screen readers', () => {
    render(<CitationJumpChip source={{ hypothesisRank: 1 }} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('entrance animation class is motion-safe (suppressed under reduced motion)', () => {
    const { container } = render(
      <CitationJumpChip source={{ hypothesisRank: 1 }} onDismiss={() => {}} />
    );
    const chip = container.querySelector('[data-citation-chip]')!;
    expect(chip.className).toContain('motion-safe:animate-[room-fade-in_');
  });
});
