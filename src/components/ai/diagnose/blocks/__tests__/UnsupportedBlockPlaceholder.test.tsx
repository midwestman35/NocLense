import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UnsupportedBlockPlaceholder from '../UnsupportedBlockPlaceholder';
import { getBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('UnsupportedBlockPlaceholder', () => {
  it('renders the kind label and a JSON dump of the block body', () => {
    const block = getBlock(makeInvestigation(), 'action');

    render(<UnsupportedBlockPlaceholder block={block} />);

    expect(screen.getByText('Block: action (renderer pending)')).toBeTruthy();
    expect(screen.getByText(/"resolutionNote"/)).toBeTruthy();
  });
});
