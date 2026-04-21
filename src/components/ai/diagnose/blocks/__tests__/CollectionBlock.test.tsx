import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CollectionBlock from '../CollectionBlock';
import { getBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('CollectionBlock', () => {
  it('renders steps in order and resolves the linked hypothesis title when present', () => {
    const investigation = makeInvestigation({ logSuggestions: [{ source: 'Datadog', reason: 'Pull the service window.', query: 'service:pbx' }, { source: 'SIP', reason: 'Check retry traffic.' }] });
    const hypothesis = getBlock(investigation, 'hypothesis');
    const block = { ...getBlock(investigation, 'collection'), body: { ...getBlock(investigation, 'collection').body, targetHypothesisBlockId: hypothesis.id } };

    render(<CollectionBlock block={block} investigation={investigation} />);

    expect(screen.getByText('For hypothesis: PBX registration failure')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      expect.arrayContaining(['Datadog: Pull the service window.Copyservice:pbx', 'SIP: Check retry traffic.']),
    );
  });

  it('renders dependency badges, hides the hypothesis title when absent, and copies commands', () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const investigation = makeInvestigation({ logSuggestions: [{ source: 'Datadog', reason: 'Pull the service window.', query: 'service:pbx' }] });
    const block = { ...getBlock(investigation, 'collection'), body: { targetHypothesisBlockId: undefined, steps: [{ label: 'Pull the service window', command: 'service:pbx', dependsOn: { kind: 'do-first' as const } }, { label: 'Retry traffic', dependsOn: { kind: 'if-fails' as const, ofStepLabel: 'Pull the service window' } }] } };

    render(<CollectionBlock block={block} investigation={investigation} />);

    expect(screen.queryByText(/For hypothesis:/)).toBeNull();
    expect(screen.getByText('Do first')).toBeTruthy();
    expect(screen.getByText('If Pull the service window fails')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('service:pbx');
  });
});
