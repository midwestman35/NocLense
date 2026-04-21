import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContextBlock from '../ContextBlock';
import { getBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('ContextBlock', () => {
  it('renders the customer and ticket link', () => {
    const block = getBlock(makeInvestigation(), 'context');

    render(<ContextBlock block={block} />);

    expect(screen.getByRole('heading', { name: 'Acme PSAP' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open ticket' })).toHaveAttribute(
      'href',
      'https://carbyne.zendesk.com/agent/tickets/45892',
    );
  });

  it('omits empty optional fields and lets reported text wrap', () => {
    const block = {
      ...getBlock(makeInvestigation(), 'context'),
      body: {
        customer: 'Acme PSAP',
        site: '',
        cnc: undefined,
        region: '',
        version: undefined,
        eventId: '',
        reported:
          'A very long reported summary that needs to wrap cleanly across the card surface.',
      },
    };

    render(<ContextBlock block={block} />);

    expect(screen.queryByText('Site')).toBeNull();
    expect(screen.queryByText('Region')).toBeNull();
    expect(screen.getByText(/needs to wrap cleanly/)).toHaveClass('whitespace-pre-wrap');
  });
});
