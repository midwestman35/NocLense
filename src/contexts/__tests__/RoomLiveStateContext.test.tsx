/**
 * RoomLiveStateContext.test.tsx — React integration tests.
 *
 * Increment 7 adds coverage for:
 *   - Injected store swap (provider follows the new instance).
 *   - register-on-mount default (surface reaches ready immediately).
 *   - Rapid unmount / remount of the same surfaceId.
 *   - Provider-owned store's timer cleanup on unmount (no callback
 *     fires after teardown).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  RoomLiveStateProvider,
  useLiveSurface,
  useSurfaceTier,
} from '../RoomLiveStateContext';
import { RoomLiveStateStore } from '../roomLiveStateStore';

function withProvider(store?: RoomLiveStateStore) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RoomLiveStateProvider store={store}>{children}</RoomLiveStateProvider>;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T14:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSurfaceTier', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useSurfaceTier('anywhere'))).toThrow(
      /must be called inside <RoomLiveStateProvider>/,
    );
  });

  it('returns idle for an unregistered surface', () => {
    const store = new RoomLiveStateStore();
    const { result } = renderHook(() => useSurfaceTier('nobody'), {
      wrapper: withProvider(store),
    });
    expect(result.current).toBe('idle');
    store.dispose();
  });

  it('re-renders when the subscribed surface transitions', () => {
    const store = new RoomLiveStateStore();
    const { result } = renderHook(() => useSurfaceTier('ai'), {
      wrapper: withProvider(store),
    });
    expect(result.current).toBe('idle');
    act(() => {
      store.notify('ai', 'ai-stream');
    });
    expect(result.current).toBe('live');
    act(() => {
      vi.advanceTimersByTime(3_500);
    });
    expect(result.current).toBe('ready');
    store.dispose();
  });
});

describe('useLiveSurface', () => {
  it('registers on mount — surface reaches ready immediately', () => {
    const store = new RoomLiveStateStore();
    const { result } = renderHook(() => useLiveSurface('ai', 'ai-stream'), {
      wrapper: withProvider(store),
    });
    expect(result.current.tier).toBe('ready');
    store.dispose();
  });

  it('opt out of register-on-mount keeps the surface idle', () => {
    const store = new RoomLiveStateStore();
    const { result } = renderHook(
      () => useLiveSurface('ai', 'ai-stream', { registerOnMount: false }),
      { wrapper: withProvider(store) },
    );
    expect(result.current.tier).toBe('idle');
    store.dispose();
  });

  it('exposes notify / raiseAlert / clearAlert', () => {
    const store = new RoomLiveStateStore();
    const { result } = renderHook(() => useLiveSurface('ai', 'ai-stream'), {
      wrapper: withProvider(store),
    });
    expect(result.current.tier).toBe('ready');

    act(() => result.current.notify());
    expect(result.current.tier).toBe('live');

    act(() => result.current.raiseAlert());
    expect(result.current.tier).toBe('alert');

    act(() => result.current.clearAlert());
    expect(result.current.tier).toBe('live'); // heartbeat still fresh
    store.dispose();
  });

  it('unregisters on unmount by default', () => {
    const store = new RoomLiveStateStore();
    const { result, unmount } = renderHook(() => useLiveSurface('ai', 'ai-stream'), {
      wrapper: withProvider(store),
    });
    act(() => result.current.notify());
    expect(store.tierFor('ai')).toBe('live');
    unmount();
    expect(store.tierFor('ai')).toBe('idle');
    store.dispose();
  });

  it('can opt out of unregister-on-unmount', () => {
    const store = new RoomLiveStateStore();
    const { result, unmount } = renderHook(
      () => useLiveSurface('ai', 'ai-stream', { unregisterOnUnmount: false }),
      { wrapper: withProvider(store) },
    );
    act(() => result.current.notify());
    unmount();
    expect(store.tierFor('ai')).toBe('live');
    store.dispose();
  });

  it('changing surfaceId within same mount unregisters old id and registers new', () => {
    const store = new RoomLiveStateStore();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useLiveSurface(id, 'ai-stream'),
      {
        wrapper: withProvider(store),
        initialProps: { id: 'old-id' },
      },
    );
    // Prime: old-id is ready from register-on-mount. Notify to bump to live.
    act(() => result.current.notify());
    expect(store.tierFor('old-id')).toBe('live');

    rerender({ id: 'new-id' });
    // Effect cleanup for the first effect runs on rerender (deps
    // changed), calling unregister('old-id'). Then the new effect
    // registers 'new-id'.
    expect(store.tierFor('old-id')).toBe('idle');
    expect(store.tierFor('new-id')).toBe('ready');
    store.dispose();
  });

  it('kind rerender is priority-sensitive: changes arbitration outcome', () => {
    // Prove the kind prop actually participates in arbitration after
    // a rerender. Setup a competitor surface at ai-stream (priority
    // 30). Our hook starts with connector-heartbeat (priority 10) and
    // loses. After a rerender to parse-overlay (priority 40), it wins.
    const store = new RoomLiveStateStore();
    const { result, rerender } = renderHook(
      ({ kind }: { kind: LiveSurfaceKind }) => useLiveSurface('a', kind),
      {
        wrapper: withProvider(store),
        initialProps: { kind: 'connector-heartbeat' as LiveSurfaceKind },
      },
    );

    // Competitor b comes in at ai-stream priority and takes live.
    store.notify('b', 'ai-stream');
    expect(store.tierFor('b')).toBe('live');

    // `a` notifies with its current low kind — b still wins on priority.
    act(() => result.current.notify());
    vi.advanceTimersByTime(350);
    expect(store.tierFor('b')).toBe('live');
    expect(store.tierFor('a')).toBe('ready');

    // Rerender `a` to a higher-priority kind. The notify callback
    // closes over the new kind (useCallback deps include kind).
    rerender({ kind: 'parse-overlay' as LiveSurfaceKind });

    act(() => result.current.notify());
    vi.advanceTimersByTime(350);
    // If kind were ignored, `a` would still be ready. Priority-
    // sensitive assertion: `a` must now be live.
    expect(store.tierFor('a')).toBe('live');
    expect(store.tierFor('b')).toBe('ready');
    store.dispose();
  });

  it('rapid unmount/remount with same surfaceId: ready after remount', () => {
    const store = new RoomLiveStateStore();
    const first = renderHook(() => useLiveSurface('ai', 'ai-stream'), {
      wrapper: withProvider(store),
    });
    act(() => first.result.current.notify());
    expect(store.tierFor('ai')).toBe('live');
    first.unmount();
    expect(store.tierFor('ai')).toBe('idle');

    const second = renderHook(() => useLiveSurface('ai', 'ai-stream'), {
      wrapper: withProvider(store),
    });
    // The new mount registers fresh — tier is ready, not live (no
    // notify yet in this mount).
    expect(second.result.current.tier).toBe('ready');
    second.unmount();
    store.dispose();
  });
});

describe('injected store swap', () => {
  it('provider follows a new injected store', () => {
    const storeA = new RoomLiveStateStore();
    const storeB = new RoomLiveStateStore();
    storeA.notify('ai', 'ai-stream');

    // Closure-based wrapper: renderHook's wrapper does not receive
    // initialProps, but it is re-invoked on every rerender, so a
    // mutable outer variable lets us swap the prop.
    let currentStore = storeA;
    function Wrapper({ children }: { children: ReactNode }) {
      return <RoomLiveStateProvider store={currentStore}>{children}</RoomLiveStateProvider>;
    }
    const { result, rerender } = renderHook(() => useSurfaceTier('ai'), {
      wrapper: Wrapper,
    });
    expect(result.current).toBe('live');

    currentStore = storeB;
    rerender();
    expect(result.current).toBe('idle');

    storeA.dispose();
    storeB.dispose();
  });

  it('does not dispose an injected store on unmount', () => {
    const store = new RoomLiveStateStore();
    const disposeSpy = vi.spyOn(store, 'dispose');
    const { unmount } = renderHook(() => useSurfaceTier('ai'), {
      wrapper: withProvider(store),
    });
    unmount();
    expect(disposeSpy).not.toHaveBeenCalled();
    store.dispose();
  });
});

describe('provider-owned store lifecycle', () => {
  it('disposes its own store on unmount, clearing pending timers', () => {
    // Use a provider-owned store by NOT passing the store prop.
    let notifyFn: (() => void) | null = null;
    const { unmount } = renderHook(
      () => {
        const surface = useLiveSurface('ai', 'ai-stream', { registerOnMount: false });
        notifyFn = surface.notify;
        return surface;
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <RoomLiveStateProvider>{children}</RoomLiveStateProvider>
        ),
      },
    );
    // Schedule a decay timer inside the owned store.
    act(() => notifyFn!());
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    // After unmount the provider disposed its owned store; the timer
    // is gone and advancing time can't fire it.
    expect(vi.getTimerCount()).toBe(0);
  });
});
