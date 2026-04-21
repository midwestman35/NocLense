import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyFeedback } from '../useCopyFeedback';

describe('useCopyFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with copied=false', () => {
    const { result } = renderHook(() => useCopyFeedback());

    expect(result.current.copied).toBe(false);
  });

  it('sets copied=true after a successful copy', async () => {
    const { result } = renderHook(() => useCopyFeedback(1000));

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(result.current.copied).toBe(true);
  });

  it('clears copied after the flash window', async () => {
    const { result } = renderHook(() => useCopyFeedback(1000));

    await act(async () => {
      await result.current.copy('hello');
    });
    act(() => {
      vi.advanceTimersByTime(1001);
    });

    expect(result.current.copied).toBe(false);
  });

  it('does not throw when unmounting mid-flash', async () => {
    const { result, unmount } = renderHook(() => useCopyFeedback(1000));

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(() => unmount()).not.toThrow();
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it('rejects when the clipboard write rejects', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useCopyFeedback());

    await expect(result.current.copy('hello')).rejects.toThrow(/denied/);
    expect(result.current.copied).toBe(false);
  });
});
