import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseHeader } from '../PhaseHeader';

vi.mock('../../../utils/theme', () => ({
  getTheme: vi.fn(() => 'dark'),
  toggleTheme: vi.fn(),
}));

describe('PhaseHeader', () => {
  it('renders logo and phase dots', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} />);
    expect(screen.getByText('NocLense')).toBeInTheDocument();
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
});
