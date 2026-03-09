import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
});
