/**
 * roomLiveStateStore.ts — arbitrated glow-tier state machine (spec §3.3).
 *
 * Phase 01a increment 6. Plain TypeScript class with no React
 * dependency so the arbitration logic is unit-testable in isolation.
 * The React bindings live in `RoomLiveStateContext.tsx` and wrap
 * this store via `useSyncExternalStore`.
 *
 * Arbitration rules (from design spec §3.3):
 *   - Tiers: idle / ready / live / alert.
 *   - Only ONE surface per room may render as `live` at a time.
 *   - Priority (highest wins):
 *       1. `alert` on any surface (red — always wins)
 *       2. parse-overlay
 *       3. ai-stream
 *       4. datadog-stream
 *       5. connector-heartbeat
 *   - `live` auto-decays to `ready` after 3s without a new notify.
 *   - Lower-priority surfaces render as `ready` while a higher-priority
 *     surface is `live`.
 *   - 300ms debounce between priority swaps to avoid flicker.
 *   - `alert` persists until explicitly acknowledged (clearAlert).
 *
 * Semantics of `notify`: "this surface has fresh data right now".
 * Semantics of `unregister`: "this surface is gone (tier returns to idle)".
 * A surface that has been notified at least once and hasn't unregistered
 * stays at `ready` forever — ready means "connected and operational",
 * not "seen recently". Only the `live` tier decays with time.
 */

export type GlowTier = 'idle' | 'ready' | 'live' | 'alert';

export type LiveSurfaceKind =
  | 'parse-overlay'
  | 'ai-stream'
  | 'datadog-stream'
  | 'connector-heartbeat';

/** Higher value = higher priority. Alert is separate (goes through alertSurfaces set). */
export const SURFACE_PRIORITY: Record<LiveSurfaceKind, number> = {
  'parse-overlay': 40,
  'ai-stream': 30,
  'datadog-stream': 20,
  'connector-heartbeat': 10,
};

export const LIVE_DECAY_MS = 3_000;
export const SWAP_DEBOUNCE_MS = 300;

interface Heartbeat {
  kind: LiveSurfaceKind;
  lastNotifyMs: number;
}

export interface RoomLiveStateStoreOptions {
  /** Clock source. Defaults to Date.now. Inject for tests without fake timers. */
  now?: () => number;
  /** Timer factory. Defaults to globalThis.setTimeout. Accepts the standard signature. */
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Cancel factory. Defaults to globalThis.clearTimeout. */
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
}

export class RoomLiveStateStore {
  private alertSurfaces = new Set<string>();
  private heartbeats = new Map<string, Heartbeat>();
  private activeLiveSurfaceId: string | null = null;
  private lastSwapAtMs = 0;
  private listeners = new Set<() => void>();
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly now: () => number;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimeoutFn: (id: ReturnType<typeof setTimeout>) => void;

  constructor(opts: RoomLiveStateStoreOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.setTimeoutFn = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn = opts.clearTimeout ?? ((id) => clearTimeout(id));
  }

  /** Attach a listener. Returns an unsubscribe. Stable across renders. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Surface publishes fresh data. Becomes a candidate for the live tier. */
  notify(surfaceId: string, kind: LiveSurfaceKind): void {
    this.heartbeats.set(surfaceId, { kind, lastNotifyMs: this.now() });
    this.arbitrate();
  }

  /** Surface disconnects. Tier returns to idle (heartbeat and alert cleared). */
  unregister(surfaceId: string): void {
    const hadHeartbeat = this.heartbeats.delete(surfaceId);
    const hadAlert = this.alertSurfaces.delete(surfaceId);
    if (this.activeLiveSurfaceId === surfaceId) {
      this.activeLiveSurfaceId = null;
    }
    if (hadHeartbeat || hadAlert) {
      this.arbitrate();
    }
  }

  /** Raise an alert on a surface. Persists until clearAlert. */
  raiseAlert(surfaceId: string): void {
    if (!this.alertSurfaces.has(surfaceId)) {
      this.alertSurfaces.add(surfaceId);
      this.emit();
    }
  }

  /** Clear an alert on a surface. */
  clearAlert(surfaceId: string): void {
    if (this.alertSurfaces.delete(surfaceId)) this.emit();
  }

  /** Current tier for a surface. Pure read against snapshot state. */
  tierFor(surfaceId: string): GlowTier {
    if (this.alertSurfaces.has(surfaceId)) return 'alert';
    if (this.activeLiveSurfaceId === surfaceId) return 'live';
    if (this.heartbeats.has(surfaceId)) return 'ready';
    return 'idle';
  }

  /** Cleanup all pending timers. Call on provider unmount. */
  dispose(): void {
    if (this.scheduledTimer !== null) {
      this.clearTimeoutFn(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.listeners.clear();
  }

  private arbitrate(): void {
    const now = this.now();

    // Find the highest-priority surface whose last notify is fresh.
    let best: { id: string; priority: number; lastNotifyMs: number } | null = null;
    for (const [id, hb] of this.heartbeats) {
      if (now - hb.lastNotifyMs > LIVE_DECAY_MS) continue;
      const priority = SURFACE_PRIORITY[hb.kind];
      if (
        !best ||
        priority > best.priority ||
        (priority === best.priority && hb.lastNotifyMs > best.lastNotifyMs)
      ) {
        best = { id, priority, lastNotifyMs: hb.lastNotifyMs };
      }
    }
    const newLiveId = best?.id ?? null;

    // Apply swap with debounce.
    if (newLiveId !== this.activeLiveSurfaceId) {
      const sinceSwap = now - this.lastSwapAtMs;
      if (sinceSwap >= SWAP_DEBOUNCE_MS) {
        this.activeLiveSurfaceId = newLiveId;
        this.lastSwapAtMs = now;
        this.emit();
      } else {
        // Defer the swap until the debounce window expires.
        this.scheduleArbitration(SWAP_DEBOUNCE_MS - sinceSwap);
        return;
      }
    }

    // Always schedule the next decay check if someone is active —
    // without a subsequent notify, live should self-decay.
    if (this.activeLiveSurfaceId) {
      const activeHb = this.heartbeats.get(this.activeLiveSurfaceId);
      if (activeHb) {
        const msUntilDecay = LIVE_DECAY_MS - (now - activeHb.lastNotifyMs);
        if (msUntilDecay > 0) this.scheduleArbitration(msUntilDecay + 10);
      }
    }
  }

  private scheduleArbitration(delayMs: number): void {
    if (this.scheduledTimer !== null) this.clearTimeoutFn(this.scheduledTimer);
    this.scheduledTimer = this.setTimeoutFn(() => {
      this.scheduledTimer = null;
      this.arbitrate();
    }, delayMs);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
