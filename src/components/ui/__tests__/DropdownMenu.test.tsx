import type { ComponentProps, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

import { DropdownMenu, DROPDOWN_MENU_TRANSITION } from '../DropdownMenu';

describe('DropdownMenu', () => {
  beforeEach(() => {
    motionDivSpy.mockClear();
  });

  it('exports the Direction C spring transition', () => {
    expect(DROPDOWN_MENU_TRANSITION).toEqual({
      duration: 0.15,
      ease: [0.16, 1.11, 0.3, 1],
    });
  });

  it('wires the rendered menu to the exported transition const', () => {
    render(
      <DropdownMenu trigger={<button>Open menu</button>}>
        <div>Menu item</div>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(
      motionDivSpy.mock.calls.some(
        ([props]) =>
          props.transition === DROPDOWN_MENU_TRANSITION &&
          typeof props.className === 'string' &&
          props.className.includes('z-[var(--z-dropdown)]'),
      ),
    ).toBe(true);
  });
});
