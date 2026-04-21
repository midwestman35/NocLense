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

  // Phase 05 Commit 1 — §4.2 transition-all sweep
  it('does not use transition-all (spec §4.2 compliance)', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/\btransition-all\b/);
  });

  it('pill and dot both include motion-reduce:transition-none', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const html = document.body.innerHTML;
    // The pill button + the inner dot span both need the motion-reduce guard
    const motionReduceCount = (html.match(/motion-reduce:transition-none/g) ?? []).length;
    expect(motionReduceCount).toBeGreaterThanOrEqual(6); // 3 phases × 2 surfaces each
  });

  it('pill transitions specific properties only (background-color, color, transform)', () => {
    render(<PhaseDots current="investigate" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('transition-[background-color,color,transform]');
  });
});
