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
    expect(btn.className).toContain('hover:bg-[var(--accent)]');
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-[var(--destructive)]');
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

  // Phase 04.5 Direction C — emphasized bounce on press
  it('applies btn-press-bounce transition class (Direction C)', () => {
    render(<Button>Press</Button>);
    expect(screen.getByRole('button').className).toContain('btn-press-bounce');
  });

  it('applies active scale-[0.94] for press bounce (Direction C)', () => {
    render(<Button>Press</Button>);
    expect(screen.getByRole('button').className).toContain('active:scale-[0.94]');
  });

  it('disables scale on motion-reduce', () => {
    render(<Button>Press</Button>);
    expect(screen.getByRole('button').className).toContain('motion-reduce:active:scale-100');
  });

  it('does not use transition-all (spec §4.2 compliance)', () => {
    render(<Button>Press</Button>);
    expect(screen.getByRole('button').className).not.toMatch(/\btransition-all\b/);
  });
});
