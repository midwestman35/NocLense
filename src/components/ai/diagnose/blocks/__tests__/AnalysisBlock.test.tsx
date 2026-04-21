import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnalysisBlock from '../AnalysisBlock';
import { getBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('AnalysisBlock', () => {
  it('resolves the linked hypothesis title from the investigation', () => {
    const investigation = makeInvestigation();
    const block = getBlock(investigation, 'analysis');

    render(<AnalysisBlock block={block} investigation={investigation} />);

    expect(screen.getByRole('heading', { name: 'Analysis: PBX registration failure' })).toBeTruthy();
    expect(screen.getByText('PBX registration failure')).toBeTruthy();
  });

  it('fires onCitationClick when a citation chip is clicked', () => {
    const investigation = makeInvestigation();
    const block = getBlock(investigation, 'analysis');
    const onCitationClick = vi.fn();

    render(
      <AnalysisBlock
        block={block}
        investigation={investigation}
        onCitationClick={onCitationClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'pbx.log:42' }));

    expect(onCitationClick).toHaveBeenCalledWith(block.citations[0]);
  });
});
