import type { ComponentProps, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { Sheet, SHEET_TRANSITION } from '../Sheet';

describe('Sheet', () => {
  beforeEach(() => {
    motionDivSpy.mockClear();
  });

  it('exports the Direction C emphasized transition', () => {
    expect(SHEET_TRANSITION).toEqual({
      duration: 0.25,
      ease: [0.34, 1.56, 0.64, 1],
    });
  });

  it('wires the rendered sheet panel to the exported transition const', () => {
    render(
      <Sheet open={true} onClose={vi.fn()} side="left">
        <div>Panel content</div>
      </Sheet>,
    );

    expect(
      motionDivSpy.mock.calls.some(
        ([props]) =>
          props.transition === SHEET_TRANSITION &&
          typeof props.className === 'string' &&
          props.className.includes('z-[var(--z-modal)]'),
      ),
    ).toBe(true);
  });
});
