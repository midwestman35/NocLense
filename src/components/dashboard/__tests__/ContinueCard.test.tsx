import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Case } from '../../../types/case';
import { ContinueCard } from '../ContinueCard';

function buildCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case_001',
    title: 'Dispatch 4 cannot hear caller audio',
    severity: 'high',
    status: 'open',
    owner: 'K. Nguyen',
    summary: 'Audio path drops after the first SIP handshake.',
    impact: '911 calls intermittently lose inbound audio.',
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_100_000,
    attachments: [],
    bookmarks: [],
    notes: [],
    ...overrides,
  };
}

describe('ContinueCard', () => {
  it('renders the key investigation fields and resume action', () => {
    const onResume = vi.fn();
    render(<ContinueCard caseItem={buildCase()} relatedCount={2} onResume={onResume} />);

    expect(screen.getByText(/dispatch 4 cannot hear caller audio/i)).toBeInTheDocument();
    expect(screen.getByText(/related cases · 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resume investigation/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
