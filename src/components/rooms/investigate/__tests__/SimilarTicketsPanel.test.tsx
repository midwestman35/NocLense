import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SimilarTicketsPanel } from '../SimilarTicketsPanel';

vi.mock('../../../workspace/SimilarCasesSection', () => ({
  SimilarCasesSection: () => <div>case-library matches</div>,
}));

vi.mock('../../../../store/aiSettings', () => ({
  loadAiSettings: () => ({ zendeskSubdomain: 'carbyne' }),
}));

describe('SimilarTicketsPanel', () => {
  it('renders similar tickets and case-library matches', () => {
    render(
      <SimilarTicketsPanel
        similarPastTickets={[
          {
            id: 41637,
            subject: 'Dispatch 4 cannot hear caller audio',
            status: 'closed',
            createdAt: '2026-04-05T02:14:00.000Z',
            tags: ['noc:audio', 'voice'],
          },
        ]}
      />,
    );

    expect(screen.getByText('Similar')).toBeInTheDocument();
    expect(screen.getByText(/Dispatch 4 cannot hear caller audio/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://carbyne.zendesk.com/agent/tickets/41637',
    );
    expect(screen.getByText('case-library matches')).toBeInTheDocument();
  });
});
