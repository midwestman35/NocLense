import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('renders level-error variant with red styling', () => {
    render(<Badge variant="level-error">ERROR</Badge>);
    const el = screen.getByText('ERROR');
    expect(el.className).toContain('tag');
    expect(el.className).toContain('red');
  });

  it('renders level-warn variant with yellow styling', () => {
    render(<Badge variant="level-warn">WARN</Badge>);
    const el = screen.getByText('WARN');
    expect(el.className).toContain('amber');
  });

  it('renders outline variant', () => {
    render(<Badge variant="outline">Tag</Badge>);
    const el = screen.getByText('Tag');
    expect(el.className).toContain('tag');
    expect(el.className).toContain('ink');
  });

  it('merges custom className', () => {
    render(<Badge className="ml-2">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('ml-2');
  });
});
