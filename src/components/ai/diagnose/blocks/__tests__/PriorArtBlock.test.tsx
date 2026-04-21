import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asCitationId, type PriorArtSource } from '../../../../../types/canonical';
import PriorArtBlock from '../PriorArtBlock';
import { buildPriorArtBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('PriorArtBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['jira', 'JIRA'],
    ['zendesk', 'ZENDESK'],
    ['slack', 'SLACK'],
    ['datadog', 'DATADOG'],
    ['confluence', 'CONFLUENCE'],
    ['local-folder', 'LOCAL'],
  ] as const)('renders the %s source badge and content', (source, label) => {
    const investigation = makeInvestigation();
    const built = buildPriorArtBlock({
      body: { source: source as PriorArtSource, title: `${label} title`, summary: `${label} summary` },
    });

    Object.assign(investigation.citations, built.citations);
    render(<PriorArtBlock block={built.block} investigation={investigation} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('heading', { name: `${label} title` })).toHaveAttribute(
      'id',
      `canonical-block-${built.block.id}`,
    );
    expect(screen.getByText(`${label} summary`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'REP-18421' })).toBeTruthy();
  });

  it('omits the summary when it is missing', () => {
    const investigation = makeInvestigation();
    const built = buildPriorArtBlock({ body: { summary: undefined, title: 'No summary' } });

    Object.assign(investigation.citations, built.citations);
    render(<PriorArtBlock block={built.block} investigation={investigation} />);

    expect(screen.queryByText('Similar registration fault.')).toBeNull();
  });

  it('renders a disabled chip and warns once when the source citation is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const investigation = makeInvestigation();
    const built = buildPriorArtBlock({
      body: { sourceCitationId: asCitationId('citation-missing'), title: 'Missing citation' },
    });
    const { rerender } = render(<PriorArtBlock block={built.block} investigation={investigation} />);

    const button = screen.getByRole('button', { name: 'Source citation unavailable' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    rerender(<PriorArtBlock block={built.block} investigation={investigation} />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('dispatches the citation click handler with the source citation id', () => {
    const onCitationClick = vi.fn();
    const investigation = makeInvestigation();
    const built = buildPriorArtBlock();

    Object.assign(investigation.citations, built.citations);
    render(
      <PriorArtBlock
        block={built.block}
        investigation={investigation}
        onCitationClick={onCitationClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'REP-18421' }));

    expect(onCitationClick).toHaveBeenCalledTimes(1);
    expect(onCitationClick).toHaveBeenCalledWith(built.block.body.sourceCitationId);
  });

  it('exposes the source kind on the outer card', () => {
    const investigation = makeInvestigation();
    const built = buildPriorArtBlock({ body: { source: 'slack' } });

    Object.assign(investigation.citations, built.citations);
    render(<PriorArtBlock block={built.block} investigation={investigation} />);

    expect(screen.getByText('SLACK').closest('[data-source]')).toHaveAttribute('data-source', 'slack');
  });
});
