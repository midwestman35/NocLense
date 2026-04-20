/**
 * roomLiveStateStore.test.ts — arbitration logic tests using fake timers.
 *
 * Covers every rule in spec §3.3:
 *   - Tiers idle / ready / live / alert
 *   - Priority arbitration (parse > ai > datadog > heartbeat)
 *   - 3s live auto-decay to ready
 *   - Ready persists (doesn't auto-decay)
 *   - 300ms swap debounce
 *   - Alert persists until acknowledged
 *   - Alert beats every other tier
 *   - unregister returns a surface to idle
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIVE_DECAY_MS,
  RoomLiveStateStore,
  SWAP_DEBOUNCE_MS,
} from '../roomLiveStateStore';

let store: RoomLiveStateStore;
let listener: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T14:00:00.000Z'));
  store = new RoomLiveStateStore();
  listener = vi.fn();
  store.subscribe(listener);
});

afterEach(() => {
  store.dispose();
  vi.useRealTimers();
});

describe('tier defaults', () => {
  it('unknown surface reads as idle', () => {
    expect(store.tierFor('nobody')).toBe('idle');
  });
});

describe('single-surface lifecycle', () => {
  it('notify → live (solo surface, past debounce start)', () => {
    // First notify, no swap debounce in play yet.
    store.notify('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('live');
    expect(listener).toHaveBeenCalled();
  });

  it('live → ready after LIVE_DECAY_MS without another notify', () => {
    store.notify('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('live');
    vi.advanceTimersByTime(LIVE_DECAY_MS + 50);
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('ready persists indefinitely without re-notify', () => {
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(LIVE_DECAY_MS + 50);
    expect(store.tierFor('ai')).toBe('ready');
    vi.advanceTimersByTime(60_000);
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('unregister returns a surface to idle', () => {
    store.notify('ai', 'ai-stream');
    store.unregister('ai');
    expect(store.tierFor('ai')).toBe('idle');
  });
});

describe('priority arbitration', () => {
  it('parse-overlay beats ai-stream when both are fresh', () => {
    store.notify('ai', 'ai-stream');
    // Push past debounce so the next swap isn't deferred.
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.notify('parse', 'parse-overlay');

    // Parse is higher priority. After debounce window, it wins.
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    expect(store.tierFor('parse')).toBe('live');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('ai-stream beats datadog-stream and connector-heartbeat', () => {
    store.notify('dd', 'datadog-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.notify('hb', 'connector-heartbeat');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);

    expect(store.tierFor('ai')).toBe('live');
    expect(store.tierFor('dd')).toBe('ready');
    expect(store.tierFor('hb')).toBe('ready');
  });

  it('equal priority: most-recent notify wins', () => {
    store.notify('a', 'ai-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.notify('b', 'ai-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    expect(store.tierFor('b')).toBe('live');
    expect(store.tierFor('a')).toBe('ready');
  });
});

describe('debounce', () => {
  it('swap deferred while within the 300ms window, applied after', () => {
    // First notify always swaps (no prior swap timestamp to debounce
    // against). ai is live.
    store.notify('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('live');

    // 50ms later, higher-priority surface arrives. Debounce window is
    // still open (only 50ms since the first swap).
    vi.advanceTimersByTime(50);
    store.notify('parse', 'parse-overlay');

    // Advance to 150ms total — still inside the 300ms window.
    vi.advanceTimersByTime(100);
    expect(store.tierFor('ai')).toBe('live');
    expect(store.tierFor('parse')).toBe('ready');

    // Cross the window (another 200ms → 350ms total). The deferred
    // arbitration timer fires and the swap applies.
    vi.advanceTimersByTime(200);
    expect(store.tierFor('parse')).toBe('live');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('SWAP_DEBOUNCE_MS matches the spec §3.3 value', () => {
    expect(SWAP_DEBOUNCE_MS).toBe(300);
  });
});

describe('alert tier', () => {
  it('alert trumps ready and live for the alerting surface', () => {
    store.notify('ai', 'ai-stream');
    store.raiseAlert('ai');
    expect(store.tierFor('ai')).toBe('alert');
  });

  it('alert persists until clearAlert; after clear, surface is ready (connected)', () => {
    store.raiseAlert('x');
    expect(store.tierFor('x')).toBe('alert');
    vi.advanceTimersByTime(60_000);
    expect(store.tierFor('x')).toBe('alert');
    store.clearAlert('x');
    // Alert implied connection; clearing the alert leaves the surface
    // at ready, not idle. To go to idle, caller must unregister.
    expect(store.tierFor('x')).toBe('ready');
  });

  it('alert on any surface WINS room arbitration (spec §3.3 lines 77-85)', () => {
    // ai is live first.
    store.notify('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('live');

    // errored raises an alert. Alert beats every tier at the room
    // level, so `ai` drops from live to ready and `errored` becomes
    // the active-live surface (visually rendered as alert).
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.raiseAlert('errored');
    expect(store.tierFor('errored')).toBe('alert');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('clearing the alert returns arbitration to normal priority', () => {
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.raiseAlert('errored');
    expect(store.tierFor('ai')).toBe('ready');

    // Clear the alert — ai regains live (after debounce).
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.clearAlert('errored');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    expect(store.tierFor('ai')).toBe('live');
    expect(store.tierFor('errored')).toBe('ready');
  });

  it('unregister clears alert state', () => {
    store.raiseAlert('x');
    store.unregister('x');
    expect(store.tierFor('x')).toBe('idle');
  });
});

describe('register semantic (Phase 01a increment 7)', () => {
  it('register(id, kind) puts a surface at ready without any prior notify', () => {
    store.register('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('register → notify → live; after decay, back to ready (not idle)', () => {
    store.register('ai', 'ai-stream');
    store.notify('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('live');
    vi.advanceTimersByTime(LIVE_DECAY_MS + 50);
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('register then unregister returns to idle', () => {
    store.register('ai', 'ai-stream');
    store.unregister('ai');
    expect(store.tierFor('ai')).toBe('idle');
  });
});

describe('boundary behavior', () => {
  it('live decays at EXACTLY LIVE_DECAY_MS, not before', () => {
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(LIVE_DECAY_MS - 1);
    expect(store.tierFor('ai')).toBe('live');
    // Cross the boundary.
    vi.advanceTimersByTime(2);
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('repeat notify on the active surface extends its live window', () => {
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(LIVE_DECAY_MS - 500);
    store.notify('ai', 'ai-stream');
    // Even past the original boundary, ai remains live thanks to the
    // re-notify.
    vi.advanceTimersByTime(600);
    expect(store.tierFor('ai')).toBe('live');
    // And it eventually decays from the new notify.
    vi.advanceTimersByTime(LIVE_DECAY_MS);
    expect(store.tierFor('ai')).toBe('ready');
  });
});

describe('alert bypasses debounce', () => {
  it('alert raised 1ms after a swap suppresses the prior live surface IMMEDIATELY', () => {
    // ai becomes live (first swap — no debounce involved).
    store.notify('ai', 'ai-stream');
    expect(store.tierFor('ai')).toBe('live');

    // 1ms later — well inside the 300ms window — an alert arrives.
    vi.advanceTimersByTime(1);
    store.raiseAlert('err');

    // Spec §3.3: alert always wins. The alerting surface owns the
    // active-live slot immediately; the prior live surface drops to
    // ready with no 300ms delay.
    expect(store.tierFor('err')).toBe('alert');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('alert raised 299ms after a swap also bypasses debounce', () => {
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(299);
    store.raiseAlert('err');
    expect(store.tierFor('err')).toBe('alert');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('clearing alert respects normal debounce on the way back to priority', () => {
    // Establish a debounced baseline: ai swaps in, then err alerts
    // (bypasses debounce), immediately swapping activeLive. The swap
    // resets lastSwapAtMs, so a subsequent non-alert swap debounces.
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(10);
    store.raiseAlert('err');
    expect(store.tierFor('err')).toBe('alert');

    // Immediately clear. Normal priority arbitration resumes: ai is
    // the fresh non-alert candidate, but the prior swap (into err)
    // is within the debounce window, so the swap back defers.
    vi.advanceTimersByTime(10);
    store.clearAlert('err');
    // Still within debounce (20ms since last swap).
    expect(store.tierFor('ai')).toBe('ready');
    // Past the window.
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    expect(store.tierFor('ai')).toBe('live');
  });
});

describe('multi-alert policy', () => {
  it('every surface in alertSurfaces renders alert simultaneously', () => {
    store.raiseAlert('a');
    store.raiseAlert('b');
    store.raiseAlert('c');
    expect(store.tierFor('a')).toBe('alert');
    expect(store.tierFor('b')).toBe('alert');
    expect(store.tierFor('c')).toBe('alert');
  });

  it('non-alert surfaces remain at most ready while any alert is active', () => {
    store.notify('ai', 'ai-stream');
    store.raiseAlert('a');
    store.raiseAlert('b');
    expect(store.tierFor('ai')).toBe('ready');
  });

  it('clearing one of two alerts leaves the other as alert (no priority fight)', () => {
    store.raiseAlert('a');
    store.raiseAlert('b');
    store.clearAlert('a');
    expect(store.tierFor('a')).toBe('ready');
    expect(store.tierFor('b')).toBe('alert');
  });
});

describe('timer safety', () => {
  it('dispose cancels pending timers', () => {
    store.notify('ai', 'ai-stream');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    store.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mutations after dispose are no-ops and do not throw', () => {
    store.dispose();
    expect(() => store.notify('ai', 'ai-stream')).not.toThrow();
    expect(() => store.raiseAlert('x')).not.toThrow();
    expect(() => store.register('y', 'datadog-stream')).not.toThrow();
    expect(store.tierFor('ai')).toBe('idle');
  });

  it('arbitration settled to nothing-active clears any scheduled timer', () => {
    store.notify('ai', 'ai-stream');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    store.unregister('ai');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('coverage nits (ckpt 9 residuals)', () => {
  it('register() transitions idle → ready while another surface is live', () => {
    // Incumbent A is live.
    store.notify('a', 'ai-stream');
    expect(store.tierFor('a')).toBe('live');

    // B registers — its tier goes idle → ready while A stays live.
    // This is the `!wasConnected` emit path with arbitrate() returning
    // false (no swap).
    listener.mockClear();
    store.register('b', 'datadog-stream');
    expect(store.tierFor('a')).toBe('live');
    expect(store.tierFor('b')).toBe('ready');
    // Emit fired because B transitioned observably.
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('debounce wake that keeps the same winner does NOT emit', () => {
    // A becomes live (first swap, no debounce).
    store.notify('a', 'ai-stream');
    // Lower-priority B notifies within the debounce window. B would
    // lose arbitration (A is higher priority and fresh), so the
    // scheduled wake that re-evaluates at window close will find the
    // same winner and stay silent.
    vi.advanceTimersByTime(50);
    store.notify('b', 'connector-heartbeat');
    listener.mockClear();

    // Fast-forward past the 300ms debounce window. The scheduled
    // timer fires, arbitrate re-runs, finds the same winner (A),
    // and should NOT emit.
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS);
    expect(store.tierFor('a')).toBe('live');
    expect(store.tierFor('b')).toBe('ready');
    expect(listener).not.toHaveBeenCalled();
  });

  it('equal-priority kind rerender: recency breaks the tie', () => {
    // A is live at ai-stream.
    store.notify('a', 'ai-stream');
    expect(store.tierFor('a')).toBe('live');

    // B notifies at the SAME priority (ai-stream) later. Tie-break
    // rule: equal priority, most-recent wins.
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.notify('b', 'ai-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    expect(store.tierFor('b')).toBe('live');
    expect(store.tierFor('a')).toBe('ready');
  });
});

describe('no-op emit suppression', () => {
  it('repeat register() on already-connected surface with same kind does not emit', () => {
    store.register('ai', 'ai-stream');
    listener.mockClear();
    store.register('ai', 'ai-stream');
    expect(listener).not.toHaveBeenCalled();
  });

  it('repeat notify() on the active-live surface does not emit (just extends decay)', () => {
    store.notify('ai', 'ai-stream');
    listener.mockClear();
    vi.advanceTimersByTime(100);
    store.notify('ai', 'ai-stream');
    // Same tier (still live, just with a refreshed decay window).
    expect(store.tierFor('ai')).toBe('live');
    expect(listener).not.toHaveBeenCalled();
  });

  it('notify() on an idle surface emits once (idle → live transition)', () => {
    listener.mockClear();
    store.notify('ai', 'ai-stream');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('raiseAlert() on already-alerting surface does not emit', () => {
    store.raiseAlert('x');
    listener.mockClear();
    store.raiseAlert('x');
    expect(listener).not.toHaveBeenCalled();
  });

  it('clearAlert() on a non-alerting surface does not emit', () => {
    listener.mockClear();
    store.clearAlert('never-alerted');
    expect(listener).not.toHaveBeenCalled();
  });

  it('unregister() of an unknown surface does not emit', () => {
    listener.mockClear();
    store.unregister('never-registered');
    expect(listener).not.toHaveBeenCalled();
  });

  it('timer-driven decay emits exactly once when live → ready transition fires', () => {
    store.notify('ai', 'ai-stream');
    listener.mockClear();
    vi.advanceTimersByTime(LIVE_DECAY_MS + 50);
    // activeLive: 'ai' → null is an observable change → exactly one emit.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.tierFor('ai')).toBe('ready');
  });
});

describe('listener notifications', () => {
  it('emits exactly once per state transition', () => {
    listener.mockClear();
    store.notify('ai', 'ai-stream'); // becomes live
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('emits when a live surface decays to ready', () => {
    store.notify('ai', 'ai-stream');
    listener.mockClear();
    vi.advanceTimersByTime(LIVE_DECAY_MS + 50);
    expect(listener).toHaveBeenCalled();
  });

  it('subscribe returns an unsubscribe function', () => {
    const extra = vi.fn();
    const unsub = store.subscribe(extra);
    store.notify('x', 'connector-heartbeat');
    expect(extra).toHaveBeenCalled();
    extra.mockClear();
    unsub();
    store.notify('x', 'connector-heartbeat');
    expect(extra).not.toHaveBeenCalled();
  });
});
