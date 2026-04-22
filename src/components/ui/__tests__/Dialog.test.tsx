import type { ComponentProps, ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { motionDivSpy } = vi.hoisted(() => ({
  motionDivSpy: vi.fn(),
}));

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'> & { children?: ReactNode }) => {
      motionDivSpy(props);
      return <div {...props}>{children}</div>;
    },
  },
}));

import { Dialog, DIALOG_TRANSITION } from '../Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={vi.fn()} title="Test">Body</Dialog>);
    expect(screen.queryByText('Test')).toBeNull();
  });

  it('renders title and body when open', () => {
    render(<Dialog open={true} onClose={vi.fn()} title="My Dialog">Content here</Dialog>);
    expect(screen.getByText('My Dialog')).toBeTruthy();
    expect(screen.getByText('Content here')).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="T">B</Dialog>);
    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when content is clicked', () => {
    const onClose = vi.fn();
    render(<Dialog open={true} onClose={onClose} title="T">B</Dialog>);
    fireEvent.click(screen.getByText('B'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders footer when provided', () => {
    render(
      <Dialog open={true} onClose={vi.fn()} title="T" footer={<button>Save</button>}>
        B
      </Dialog>
    );
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('exports the Direction C emphasized transition', () => {
    expect(DIALOG_TRANSITION).toEqual({
      duration: 0.22,
      ease: [0.34, 1.56, 0.64, 1],
    });
  });

  it('wires the rendered dialog content to the exported transition const', () => {
    render(<Dialog open={true} onClose={vi.fn()} title="My Dialog">Content here</Dialog>);

    expect(
      motionDivSpy.mock.calls.some(([props]) => props.role === 'dialog' && props.transition === DIALOG_TRANSITION),
    ).toBe(true);
  });
});
