import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Spinner } from '../Spinner';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

vi.mock('../../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

describe('Spinner', () => {
  beforeEach(() => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
  });

  it('renders with role=status', () => {
    render(<Spinner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the accessible label', () => {
    render(<Spinner label="Analyzing" />);

    expect(screen.getByText('Analyzing')).toHaveClass('sr-only');
  });

  it('applies spin classes when reduced motion is not preferred', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');

    expect(spinner).toHaveAttribute('data-reduced-motion', 'false');
    expect(spinner).not.toHaveClass('opacity-80');
    expect(spinner.className).toContain('motion-safe:animate-spin');
    expect(spinner.className).toContain('motion-reduce:animate-none');
  });

  it('reflects the reduced-motion hook while preserving the fallback class seam', () => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    render(<Spinner />);

    const spinner = screen.getByRole('status');
    const classTokens = spinner.className.split(/\s+/);

    expect(spinner).toHaveAttribute('data-reduced-motion', 'true');
    expect(spinner).toHaveClass('opacity-80');
    expect(classTokens).not.toContain('animate-spin');
    expect(classTokens).toContain('motion-reduce:animate-none');
    expect(classTokens).toContain('motion-safe:animate-spin');
  });

  it('resolves named scale to correct pixel dimensions', () => {
    const { unmount } = render(<Spinner size="md" />);
    const svg = screen.getByRole('status').querySelector('svg');

    expect(svg).toHaveAttribute('width', '14');
    expect(svg).toHaveAttribute('height', '14');
    unmount();

    render(<Spinner size="xs" />);
    const svgXs = screen.getByRole('status').querySelector('svg');

    expect(svgXs).toHaveAttribute('width', '10');
    expect(svgXs).toHaveAttribute('height', '10');
  });

  it('supports numeric size fallback', () => {
    render(<Spinner size={13} />);

    const svg = screen.getByRole('status').querySelector('svg');

    expect(svg).toHaveAttribute('width', '13');
    expect(svg).toHaveAttribute('height', '13');
  });

  it('uses default size sm (12px) and label Loading when no props given', () => {
    render(<Spinner />);

    const svg = screen.getByRole('status').querySelector('svg');

    expect(svg).toHaveAttribute('width', '12');
    expect(svg).toHaveAttribute('height', '12');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});
