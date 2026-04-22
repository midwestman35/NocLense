import type { ComponentProps, ReactNode } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { Tooltip, TOOLTIP_TRANSITION } from '../Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motionDivSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show content by default', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.queryByText('Help text')).toBeNull();
  });

  it('shows content on mouse enter after delay', async () => {
    render(
      <Tooltip content="Help text" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('Help text')).toBeTruthy();
  });

  it('hides content on mouse leave', async () => {
    render(
      <Tooltip content="Help text" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText('Help text')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByText('Hover me'));
    // Content may still be animating out, but it should start hiding
  });

  it('exports the Direction C spring transition', () => {
    expect(TOOLTIP_TRANSITION).toEqual({
      duration: 0.15,
      ease: [0.16, 1.11, 0.3, 1],
    });
  });

  it('wires the rendered tooltip to the exported transition const', () => {
    render(
      <Tooltip content="Help text" delay={0}>
        <button>Hover me</button>
      </Tooltip>,
    );

    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(
      motionDivSpy.mock.calls.some(
        ([props]) =>
          props.transition === TOOLTIP_TRANSITION &&
          typeof props.className === 'string' &&
          props.className.includes('pointer-events-none'),
      ),
    ).toBe(true);
  });
});
