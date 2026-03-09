import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('renders search variant with icon slot', () => {
    render(<Input variant="search" icon={<span data-testid="icon">Q</span>} />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<Input label="Name" />);
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('forwards onChange', () => {
    const handler = vi.fn();
    render(<Input onChange={handler} placeholder="test" />);
    fireEvent.change(screen.getByPlaceholderText('test'), { target: { value: 'hello' } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('merges custom className on wrapper', () => {
    render(<Input wrapperClassName="mt-4" data-testid="input" />);
    const outerWrapper = screen.getByTestId('input').parentElement?.parentElement;
    expect(outerWrapper?.className).toContain('mt-4');
  });
});
