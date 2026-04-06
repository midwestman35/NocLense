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

  it('renders settings button', () => {
    render(<PhaseHeader phase="import" onPhaseChange={() => {}} onSettingsClick={() => {}} />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});
