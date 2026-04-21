import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleChip } from '../ToggleChip';

describe('ToggleChip', () => {
  it('renders the label and icon', () => {
    render(
      <ToggleChip
        label="Errors"
        checked={false}
        onChange={() => {}}
        icon={<span data-testid="icon">E</span>}
      />
    );
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('calls onChange with the flipped value when clicked', () => {
    const onChange = vi.fn();
    render(
      <ToggleChip
        label="Warnings"
        checked={false}
        onChange={onChange}
        icon={<span>W</span>}
      />
    );
    const checkbox = screen.getByRole('button');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles on Space and Enter keypress', () => {
    const onChange = vi.fn();
    render(
      <ToggleChip
        label="Info"
        checked={true}
        onChange={onChange}
        icon={<span>I</span>}
      />
    );
    const checkbox = screen.getByRole('button');
    fireEvent.keyDown(checkbox, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(false);
    onChange.mockClear();
    fireEvent.keyDown(checkbox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('ignores interaction when disabled', () => {
    const onChange = vi.fn();
    render(
      <ToggleChip
        label="Debug"
        checked={false}
        onChange={onChange}
        icon={<span>D</span>}
        disabled
      />
    );
    const checkbox = screen.getByRole('button');
    fireEvent.click(checkbox);
    fireEvent.keyDown(checkbox, { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders count when provided', () => {
    render(
      <ToggleChip
        label="Errors"
        checked={true}
        onChange={() => {}}
        icon={<span>E</span>}
        count={42}
      />
    );
    expect(screen.getByText('(42)')).toBeInTheDocument();
  });

  // Phase 05 Commit 1 — §4.2 transition-all sweep
  it('does not use transition-all (spec §4.2 compliance)', () => {
    render(
      <ToggleChip
        label="T"
        checked={true}
        onChange={() => {}}
        icon={<span>T</span>}
      />
    );
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/\btransition-all\b/);
  });

  it('checkbox uses specific transition properties', () => {
    render(
      <ToggleChip
        label="T"
        checked={true}
        onChange={() => {}}
        icon={<span>T</span>}
      />
    );
    const checkbox = screen.getByRole('button');
    expect(checkbox.className).toContain('transition-[background-color,border-color,color]');
  });
});
