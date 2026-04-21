import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InvestigateUrlEntry from './InvestigateUrlEntry';
import { extractZendeskTicketId } from './ticketInput';

describe('extractZendeskTicketId', () => {
  it('accepts a Zendesk ticket URL or numeric ID', () => {
    expect(extractZendeskTicketId('https://carbyne.zendesk.com/agent/tickets/45892')).toBe('45892');
    expect(extractZendeskTicketId('  #45892 ')).toBe('45892');
  });

  it('returns null for invalid values', () => {
    expect(extractZendeskTicketId('')).toBeNull();
    expect(extractZendeskTicketId('ticket abc')).toBeNull();
  });
});

describe('InvestigateUrlEntry', () => {
  it('submits the normalized Zendesk ticket ID', () => {
    const onSubmit = vi.fn();

    render(
      <InvestigateUrlEntry
        value="https://carbyne.zendesk.com/agent/tickets/45892"
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Investigate ticket' }));

    expect(onSubmit).toHaveBeenCalledWith('45892');
  });

  it('shows a local validation error for invalid input', () => {
    render(
      <InvestigateUrlEntry
        value="invalid-ticket"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Investigate ticket' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a Zendesk ticket URL or numeric ticket ID.'
    );
  });
});
