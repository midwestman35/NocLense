import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HypothesisBlock from '../HypothesisBlock';
import { getBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('HypothesisBlock', () => {
  it('varies the status chip treatment by status', () => {
    const confirmedBlock = {
      ...getBlock(makeInvestigation(), 'hypothesis'),
      body: { ...getBlock(makeInvestigation(), 'hypothesis').body, status: 'CONFIRMED' as const },
    };
    const ruledOutBlock = {
      ...confirmedBlock,
      body: { ...confirmedBlock.body, status: 'RULED_OUT' as const },
    };

    const { rerender } = render(<HypothesisBlock block={confirmedBlock} />);
    expect(screen.getByLabelText('Status: confirmed')).toHaveStyle({
      boxShadow: 'var(--shadow-glow-ready)',
    });

    rerender(<HypothesisBlock block={ruledOutBlock} />);
    expect(screen.getByLabelText('Status: ruled out')).toHaveStyle({
      boxShadow: 'var(--shadow-glow-error)',
    });
  });

  it('renders all evidence subsections as expanded details blocks', () => {
    const block = getBlock(makeInvestigation(), 'hypothesis');

    render(<HypothesisBlock block={block} />);

    expect(screen.getByText('Supporting Evidence').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Evidence to Confirm').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Evidence to Rule Out').closest('details')).toHaveAttribute('open');
  });
});
