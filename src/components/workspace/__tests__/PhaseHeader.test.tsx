import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseHeader } from '../PhaseHeader';

vi.mock('../../../utils/theme', () => ({
  getTheme: vi.fn(() => 'dark'),
  toggleTheme: vi.fn(),
}));

describe('PhaseHeader', () => {
  it('renders phase dots', () => {
    // Logo moved to AppShellSidebar in the post-07C.2 polish pass; header
    // is now chrome-only (ticket context + phase dots + theme toggle).
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.getByLabelText('Import')).toBeInTheDocument();
    expect(screen.getByLabelText('Investigate')).toBeInTheDocument();
    expect(screen.getByLabelText('Submit')).toBeInTheDocument();
  });

  it('shows ticket context when ticketId is provided', () => {
    render(<PhaseHeader phase="investigate" onPhaseChange={() => {}} ticketId="45892" />);
    expect(screen.getByText('#45892')).toBeInTheDocument();
  });

  it('does not show ticket context in import phase without ticketId', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  // NOTE: a previous "renders settings button" test asserted a
  // Settings button and an `onSettingsClick` prop. Both were removed
  // in commit 09d55ad ("settings cleanup"); the test was left
  // asserting the removed UI. Replaced with an assertion that
  // confirms the removal (no Settings control rendered).
  it('does not render a settings button (removed in 09d55ad)', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
  });

  // Phase 05 Commit 3 — text-wrap + token verification
  it('status label uses text-wrap: pretty (Phase 05 Direction C)', () => {
    render(
      <PhaseHeader
        phase="investigate"
        onPhaseChange={() => {}}
        ticketId="ZD-48521"
        statusLabel="Monitoring"
      />
    );
    const statusEl = screen.getByText('Monitoring');
    expect(statusEl).toHaveStyle({ textWrap: 'pretty' });
  });

  it('ticket id span uses tabular-nums class', () => {
    render(
      <PhaseHeader
        phase="investigate"
        onPhaseChange={() => {}}
        ticketId="ZD-48521"
      />
    );
    const ticketEl = screen.getByText('#ZD-48521');
    expect(ticketEl.className).toContain('tabular-nums');
  });

  it('applies a gradient header background (guards against plain hardcoded colors)', () => {
    const { container } = render(
      <PhaseHeader phase="import" onPhaseChange={() => {}} />
    );
    const header = container.querySelector('header')!;
    // Post-07C.2 polish: header migrated from inline var(--header-surface)
    // to an arbitrary-value Tailwind gradient class. A naked bg-red-500 /
    // bg-white / similar regression would fail this matcher.
    expect(header.className).toMatch(/bg-\[linear-gradient/);
  });
});
