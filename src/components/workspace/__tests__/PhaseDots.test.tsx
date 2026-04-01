import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhaseDots } from '../PhaseDots';

describe('PhaseDots', () => {
  it('renders three phase dots', () => {
    render(<PhaseDots current="import" onNavigate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks the current phase as active', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
  });

  it('marks completed phases', () => {
    render(<PhaseDots current="submit" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].getAttribute('data-completed')).toBe('true');
    expect(buttons[1].getAttribute('data-completed')).toBe('true');
    expect(buttons[2].getAttribute('aria-current')).toBe('step');
  });

  it('calls onNavigate when clicking a completed phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="investigate" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onNavigate).toHaveBeenCalledWith('import');
  });

  it('does not call onNavigate when clicking future phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="import" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not call onNavigate when clicking current phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="investigate" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
