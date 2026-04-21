import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { asBlockId, asCitationId } from '../../../../types/canonical';
import CanonicalBlockRenderer from '../CanonicalBlockRenderer';
import { makeInvestigation } from './canonicalBlockTestUtils';

describe('CanonicalBlockRenderer', () => {
  it('renders concrete collection and action blocks while prior-art and note stay on the placeholder path', () => {
    const investigation = makeInvestigation({
      logSuggestions: [
        { source: 'Datadog', reason: 'Pull the last hour of PBX events.', query: 'service:pbx' },
      ],
    });
    const firstCitationId = Object.keys(investigation.citations)[0];

    investigation.blocks.push(
      {
        id: asBlockId('id-900'),
        kind: 'prior-art',
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
        citations: [],
        body: {
          source: 'jira',
          title: 'REP-18421',
          summary: 'Similar registration fault.',
          sourceCitationId: asCitationId(firstCitationId),
        },
      },
      {
        id: asBlockId('id-901'),
        kind: 'note',
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
        citations: [],
        body: {
          markdown: 'Engineer note',
          authorRole: 'engineer',
        },
      },
    );

    render(<CanonicalBlockRenderer investigation={investigation} />);

    expect(screen.getByText('Acme PSAP')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'PBX registration failure' })).toBeTruthy();
    expect(screen.getByText('Analysis: PBX registration failure')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Collection Guidance' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Action' })).toBeTruthy();
    expect(screen.getByText('Block: prior-art (renderer pending)')).toBeTruthy();
    expect(screen.getByText('Block: note (renderer pending)')).toBeTruthy();
  });

  it('wraps each block in a stable section envelope', () => {
    const investigation = makeInvestigation({
      logSuggestions: [
        { source: 'Datadog', reason: 'Pull the last hour of PBX events.', query: 'service:pbx' },
      ],
    });

    render(<CanonicalBlockRenderer investigation={investigation} />);

    const collectionSection = screen.getByRole('heading', { name: 'Collection Guidance' }).closest('section');

    expect(collectionSection).toHaveAttribute('data-block-kind', 'collection');
    expect(collectionSection).toHaveAttribute('data-block-id');
  });
});
