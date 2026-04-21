import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ActionBlock from '../ActionBlock';
import { getBlock, makeInvestigation } from '../../__tests__/canonicalBlockTestUtils';

describe('ActionBlock', () => {
  it('renders the four action payload variants and kind-specific chips', () => {
    const base = getBlock(makeInvestigation(), 'action');
    const cases = [
      { kind: 'resolve' as const, label: 'Resolve', text: 'Re-registered extension 4201.' },
      { kind: 'jira' as const, label: 'Create Jira', text: 'REP' },
      { kind: 'test-script' as const, label: 'Run Test Script', text: 'diag-script' },
      { kind: 'escalate' as const, label: 'Escalate', text: 'Tier 3 NOC' },
    ];
    const { rerender } = render(<ActionBlock block={base} />);

    for (const testCase of cases) {
      const block = { ...base, body: { summary: `${testCase.label} summary`, payload: testCase.kind === 'resolve' ? { kind: 'resolve' as const, resolutionNote: 'Re-registered extension 4201.', tags: ['pbx', 'registration'] } : testCase.kind === 'jira' ? { kind: 'jira' as const, projectKey: 'REP', priority: 'High' as const, summary: 'Open follow-up', description: 'Create a follow-up issue.' } : testCase.kind === 'test-script' ? { kind: 'test-script' as const, scriptId: 'diag-script', parameters: { station: '42' } } : { kind: 'escalate' as const, team: 'Tier 3 NOC', reason: 'Requires vendor review.' } } };
      rerender(<ActionBlock block={block} />);
      expect(screen.getByText(testCase.text)).toBeTruthy();
      expect(screen.getByLabelText(`Action kind: ${testCase.label.toLowerCase()}`)).toHaveAttribute('data-action-kind', testCase.kind);
    }
  });

  it('renders the disabled CTA with tooltip text', async () => {
    const block = getBlock(makeInvestigation(), 'action');

    render(<ActionBlock block={block} />);

    const button = screen.getByRole('button', { name: 'Resolve' });
    expect(button).toBeDisabled();
    fireEvent.mouseEnter(button.parentElement as HTMLElement);
    expect(await screen.findByText('Action wiring lands in Phase 03')).toBeTruthy();
  });
});
