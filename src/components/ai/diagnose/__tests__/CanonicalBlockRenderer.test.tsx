import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CanonicalBlockRenderer from '../CanonicalBlockRenderer';
import { makeInvestigation } from './canonicalBlockTestUtils';

describe('CanonicalBlockRenderer', () => {
  it('renders context, hypothesis, analysis, and placeholder fallbacks by block kind', () => {
    const investigation = makeInvestigation();

    render(<CanonicalBlockRenderer investigation={investigation} />);

    expect(screen.getByText('Acme PSAP')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'PBX registration failure' }),
    ).toBeTruthy();
    expect(screen.getByText('Analysis: PBX registration failure')).toBeTruthy();
    expect(screen.getByText('Block: action (renderer pending)')).toBeTruthy();
  });

  it('wraps each block in a stable section envelope', () => {
    const investigation = makeInvestigation();

    render(<CanonicalBlockRenderer investigation={investigation} />);

    const analysisSection = screen.getByText('Analysis: PBX registration failure').closest('section');
    expect(analysisSection).toHaveAttribute('data-block-kind', 'analysis');
    expect(analysisSection).toHaveAttribute('data-block-id');
  });
});
