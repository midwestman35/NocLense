import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhaseDots } from '../PhaseDots';

describe('PhaseDots', () => {
  it('renders four phase dots', () => {
    render(<PhaseDots current="import" onNavigate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('marks the current phase as active', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[2].getAttribute('aria-current')).toBe('step');
  });

  it('marks completed phases', () => {
    render(<PhaseDots current="submit" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].getAttribute('data-completed')).toBe('true');
    expect(buttons[1].getAttribute('data-completed')).toBe('true');
    expect(buttons[2].getAttribute('data-completed')).toBe('true');
    expect(buttons[3].getAttribute('aria-current')).toBe('step');
  });

  it('calls onNavigate when clicking a completed phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="investigate" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onNavigate).toHaveBeenCalledWith('import');
  });

  it('calls onNavigate when clicking a future phase', () => {
    // Post-07C.2 polish: forward navigation is now allowed. Only the
    // active phase is click-inert; completed and future phases both
    // dispatch onNavigate so operators can jump the flow.
    const onNavigate = vi.fn();
    render(<PhaseDots current="import" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[3]);
    expect(onNavigate).toHaveBeenCalledWith('submit');
  });

  it('does not call onNavigate when clicking current phase', () => {
    const onNavigate = vi.fn();
    render(<PhaseDots current="investigate" onNavigate={onNavigate} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not use transition-all', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    expect(document.body.innerHTML).not.toMatch(/\btransition-all\b/);
  });

  it('pill and dot both include motion-reduce:transition-none', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const motionReduceCount = (document.body.innerHTML.match(/motion-reduce:transition-none/g) ?? []).length;
    expect(motionReduceCount).toBeGreaterThanOrEqual(8);
  });

  it('pill transitions specific properties only', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('transition-[background-color,color,transform]');
  });
});
