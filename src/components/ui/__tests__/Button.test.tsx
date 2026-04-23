import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('btn');
    expect(btn.className).toContain('ghost');
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('ghost');
    expect(btn.className).toContain('text-[var(--red)]');
  });

  it('applies icon variant sizing', () => {
    render(<Button variant="icon">X</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-9');
    expect(btn.className).toContain('w-9');
  });

  it('forwards onClick', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Button className="mt-4">Styled</Button>);
    expect(screen.getByRole('button').className).toContain('mt-4');
  });

  it('maps the default variant to the handoff primary button seam', () => {
    render(<Button>Press</Button>);
    const className = screen.getByRole('button').className;
    expect(className).toContain('btn');
    expect(className).toContain('primary');
  });

  it('does not use transition-all (spec 4.2 compliance)', () => {
    render(<Button>Press</Button>);
    expect(screen.getByRole('button').className).not.toMatch(/\btransition-all\b/);
  });
});
