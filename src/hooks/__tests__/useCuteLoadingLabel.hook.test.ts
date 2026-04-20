/**
 * useCuteLoadingLabel.hook.test.ts — lifecycle tests using
 * @testing-library/react's renderHook + fake timers + mocked
 * matchMedia. Complements useCuteLoadingLabel.test.ts, which only
 * covers the pure helper functions.
 *
 * Guarantees under test:
 *   - Cycles at CUTE_LABEL_CYCLE_MS cadence when loading.
 *   - Returns phrase #0 under reduced motion and never advances.
 *   - Resets to phrase #0 when isLoading flips false → true (same op).
 *   - Resets to phrase #0 when operation changes.
 *   - Clears interval on unmount.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  CUTE_LABEL_CYCLE_MS,
  sequenceForOperation,
  useCuteLoadingLabel,
  type OperationKind,
} from '../useCuteLoadingLabel';

/** Install a matchMedia mock driven by the reduced-motion flag. */
function mockReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduce') ? reduce : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      // Legacy API for older Safari — kept to match the native MQL type.
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('useCuteLoadingLabel lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts at phrase 0 when loading begins', () => {
    const { result } = renderHook(() => useCuteLoadingLabel('ai-diagnose', true));
    expect(result.current.index).toBe(0);
    expect(result.current.phrase).toBe(sequenceForOperation('ai-diagnose')[0]);
    expect(result.current.active).toBe(true);
  });

  it('advances through the sequence at CUTE_LABEL_CYCLE_MS cadence', () => {
    const seq = sequenceForOperation('ai-diagnose');
    const { result } = renderHook(() => useCuteLoadingLabel('ai-diagnose', true));

    expect(result.current.phrase).toBe(seq[0]);

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS); });
    expect(result.current.phrase).toBe(seq[1]);

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS); });
    expect(result.current.phrase).toBe(seq[2]);

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS); });
    expect(result.current.phrase).toBe(seq[3]);
  });

  it('returns phrase #0 under reduced motion and never advances', () => {
    mockReducedMotion(true);
    const seq = sequenceForOperation('ai-diagnose');

    const { result } = renderHook(() => useCuteLoadingLabel('ai-diagnose', true));
    expect(result.current.phrase).toBe(seq[0]);
    expect(result.current.active).toBe(false);

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS * 5); });
    expect(result.current.phrase).toBe(seq[0]);
    expect(result.current.index).toBe(0);
  });

  it('resets to phrase 0 when isLoading flips false → true (same operation)', () => {
    const seq = sequenceForOperation('ai-diagnose');
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) =>
        useCuteLoadingLabel('ai-diagnose', loading),
      { initialProps: { loading: true } },
    );

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS * 2); });
    expect(result.current.index).toBe(2);

    // Stop loading — visible index derives to 0.
    rerender({ loading: false });
    expect(result.current.index).toBe(0);
    expect(result.current.phrase).toBe(seq[0]);

    // Start a fresh load — index remains 0 (no mid-sequence resume).
    rerender({ loading: true });
    expect(result.current.index).toBe(0);
    expect(result.current.phrase).toBe(seq[0]);

    // Confirm the fresh interval is ticking from 0.
    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS); });
    expect(result.current.index).toBe(1);
    expect(result.current.phrase).toBe(seq[1]);
  });

  it('resets to phrase 0 when operation changes while loading', () => {
    const { result, rerender } = renderHook(
      ({ op }: { op: OperationKind }) => useCuteLoadingLabel(op, true),
      { initialProps: { op: 'ai-diagnose' as OperationKind } },
    );

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS * 3); });
    expect(result.current.index).toBe(3);

    rerender({ op: 'file-parse' });
    expect(result.current.index).toBe(0);
    expect(result.current.phrase).toBe(sequenceForOperation('file-parse')[0]);

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS); });
    expect(result.current.index).toBe(1);
    expect(result.current.phrase).toBe(sequenceForOperation('file-parse')[1]);
  });

  it('clears the interval on unmount', () => {
    const { unmount } = renderHook(() => useCuteLoadingLabel('ai-diagnose', true));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses when isLoading becomes false and resumes from 0 on re-entry', () => {
    const seq = sequenceForOperation('ai-diagnose');
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) =>
        useCuteLoadingLabel('ai-diagnose', loading),
      { initialProps: { loading: true } },
    );

    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS * 4); });
    expect(result.current.index).toBe(4);

    rerender({ loading: false });
    // No advancement while idle, even if timers fire.
    act(() => { vi.advanceTimersByTime(CUTE_LABEL_CYCLE_MS * 10); });
    expect(result.current.phrase).toBe(seq[0]);

    rerender({ loading: true });
    expect(result.current.phrase).toBe(seq[0]);
  });
});
