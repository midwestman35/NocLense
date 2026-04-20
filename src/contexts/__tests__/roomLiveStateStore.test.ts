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

  it('alert persists until clearAlert', () => {
    store.raiseAlert('x');
    expect(store.tierFor('x')).toBe('alert');
    vi.advanceTimersByTime(60_000);
    expect(store.tierFor('x')).toBe('alert');
    store.clearAlert('x');
    expect(store.tierFor('x')).toBe('idle');
  });

  it('alert on one surface does not suppress live on another', () => {
    store.raiseAlert('errored');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    store.notify('ai', 'ai-stream');
    vi.advanceTimersByTime(SWAP_DEBOUNCE_MS + 10);
    expect(store.tierFor('errored')).toBe('alert');
    expect(store.tierFor('ai')).toBe('live');
  });

  it('unregister clears alert state', () => {
    store.raiseAlert('x');
    store.unregister('x');
    expect(store.tierFor('x')).toBe('idle');
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
