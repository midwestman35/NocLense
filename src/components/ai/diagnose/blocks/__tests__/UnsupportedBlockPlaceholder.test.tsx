import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { asBlockId, asCitationId } from '../../../../../types/canonical';
import UnsupportedBlockPlaceholder from '../UnsupportedBlockPlaceholder';

describe('UnsupportedBlockPlaceholder', () => {
  it('renders the kind label and a JSON dump of the block body', () => {
    const block = {
      id: asBlockId('id-note'),
      kind: 'note' as const,
      createdAt: 1,
      updatedAt: 1,
      citations: [asCitationId('citation-1')],
      body: {
        markdown: 'Engineer note',
        authorRole: 'engineer' as const,
      },
    };

    render(<UnsupportedBlockPlaceholder block={block} />);

    expect(screen.getByText('Block: note (renderer pending)')).toBeTruthy();
    expect(screen.getByText(/"markdown"/)).toBeTruthy();
  });
});
