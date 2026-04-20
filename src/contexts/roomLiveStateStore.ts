/**
 * roomLiveStateStore.ts — arbitrated glow-tier state machine (spec §3.3).
 *
 * Phase 01a increment 7 hardens increment 6 per the Codex review:
 *   - Alert now wins room arbitration (raiseAlert / clearAlert
 *     re-arbitrate; any active alert suppresses the green live pulse
 *     elsewhere in the room).
 *   - `register(id, kind)` explicitly puts a surface at the `ready`
 *     tier — spec §3.3's "connected and operational" without needing
 *     a prior notify.
 *   - Decay uses `>= LIVE_DECAY_MS` and schedules the exact remaining
 *     delay (no +10ms cushion).
 *   - `disposed` flag guards mutators and timer callbacks; stale
 *     timers are cleared when arbitration settles.
 *
 * Arbitration rules (spec §3.3):
 *   - Tiers: idle / ready / live / alert.
 *   - Only ONE surface per room holds the "active live" slot.
 *   - Alert beats every other tier: if any surface has an alert, it
 *     becomes the active-live slot (rendering red), and every other
 *     surface — even those with fresh notifies — falls back to ready.
 *   - Among non-alert contenders, priority (highest wins):
 *       parse-overlay > ai-stream > datadog-stream > connector-heartbeat.
 *   - `live` auto-decays to `ready` after 3s without a new notify.
 *   - `ready` persists (it means "connected", not "seen recently").
 *   - 300ms debounce between active-live swaps to suppress flicker.
 *   - `alert` persists until explicitly cleared (clearAlert).
 *
 * Semantics:
 *   register(id, kind)     — surface connected. Tier = ready.
 *   notify(id, kind)       — surface has fresh activity. Competes for live.
 *                            Implies register.
 *   unregister(id)         — surface disconnected. Tier = idle.
 *                            Clears heartbeat + registration + alert.
 *   raiseAlert(id)         — surface has a user-facing error. Tier = alert.
 *                            Re-arbitrates (alert wins the active slot).
 *   clearAlert(id)         — acknowledge alert. Re-arbitrates.
 *   tierFor(id)            — current visible tier for a surface.
 *   dispose()              — provider teardown. Cancels timers, clears
 *                            listeners, blocks further mutations.
 */

export type GlowTier = 'idle' | 'ready' | 'live' | 'alert';

export type LiveSurfaceKind =
  | 'parse-overlay'
  | 'ai-stream'
  | 'datadog-stream'
  | 'connector-heartbeat';

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
  /** Clock source. Defaults to Date.now. */
  now?: () => number;
  /** Timer factory. Defaults to globalThis.setTimeout. */
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Cancel factory. Defaults to globalThis.clearTimeout. */
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
}

export class RoomLiveStateStore {
  private readonly connected = new Set<string>();
  private readonly heartbeats = new Map<string, Heartbeat>();
  private readonly alertSurfaces = new Set<string>();
  private readonly surfaceKinds = new Map<string, LiveSurfaceKind>();
  private activeLiveSurfaceId: string | null = null;
  private lastSwapAtMs = 0;
  private readonly listeners = new Set<() => void>();
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private readonly now: () => number;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimeoutFn: (id: ReturnType<typeof setTimeout>) => void;

  constructor(opts: RoomLiveStateStoreOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.setTimeoutFn = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn = opts.clearTimeout ?? ((id) => clearTimeout(id));
  }

  /** Stable listener registration. Returns an unsubscribe. */
  readonly subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Mark a surface as connected (spec §3.3 ready tier: "operational"). */
  register(surfaceId: string, kind: LiveSurfaceKind): void {
    if (this.disposed) return;
    const alreadyConnected = this.connected.has(surfaceId);
    this.connected.add(surfaceId);
    this.surfaceKinds.set(surfaceId, kind);
    if (!alreadyConnected) this.emit();
    this.arbitrate();
  }

  /** Surface has fresh activity. Becomes a candidate for the live tier. */
  notify(surfaceId: string, kind: LiveSurfaceKind): void {
    if (this.disposed) return;
    this.connected.add(surfaceId);
    this.surfaceKinds.set(surfaceId, kind);
    this.heartbeats.set(surfaceId, { kind, lastNotifyMs: this.now() });
    this.arbitrate();
  }

  /** Surface disconnects. Tier returns to idle across all state. */
  unregister(surfaceId: string): void {
    if (this.disposed) return;
    const hadConnected = this.connected.delete(surfaceId);
    const hadHeartbeat = this.heartbeats.delete(surfaceId);
    const hadAlert = this.alertSurfaces.delete(surfaceId);
    const had = hadConnected || hadHeartbeat || hadAlert;
    this.surfaceKinds.delete(surfaceId);
    if (this.activeLiveSurfaceId === surfaceId) {
      this.activeLiveSurfaceId = null;
    }
    if (had) this.arbitrate();
  }

  /** Raise alert. Re-arbitrates: alert wins the active-live slot. */
  raiseAlert(surfaceId: string): void {
    if (this.disposed) return;
    if (this.alertSurfaces.has(surfaceId)) return;
    this.alertSurfaces.add(surfaceId);
    // Alert implies connection — surface can't alert if it's idle.
    this.connected.add(surfaceId);
    // Emit unconditionally: the tier changes for this surface (to alert)
    // AND potentially for every other surface in the room (live → ready).
    // arbitrate() only emits on active-live swaps, which isn't enough.
    this.emit();
    this.arbitrate();
  }

  /** Acknowledge alert. Re-arbitrates. */
  clearAlert(surfaceId: string): void {
    if (this.disposed) return;
    if (!this.alertSurfaces.delete(surfaceId)) return;
    // Same reasoning as raiseAlert — clearing affects this surface's
    // tier deterministically even if arbitrate won't produce a swap.
    this.emit();
    this.arbitrate();
  }

  /**
   * Current tier for a surface. Reads snapshot state only.
   *
   * Resolution order:
   *   1. alert      → surface has an unacknowledged alert
   *   2. live       → surface holds the active-live slot AND has no alert
   *   3. ready      → surface is connected (registered or has a heartbeat)
   *   4. idle       → surface unknown
   */
  tierFor(surfaceId: string): GlowTier {
    if (this.alertSurfaces.has(surfaceId)) return 'alert';
    if (this.activeLiveSurfaceId === surfaceId) return 'live';
    if (this.connected.has(surfaceId)) return 'ready';
    return 'idle';
  }

  /** Provider teardown. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.scheduledTimer !== null) {
      this.clearTimeoutFn(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.listeners.clear();
  }

  /** Core arbitration. Picks the active-live slot and handles decay + debounce. */
  private arbitrate(): void {
    if (this.disposed) return;
    const now = this.now();

    let newLiveId: string | null = null;
    let nextWakeMs: number | null = null;

    if (this.alertSurfaces.size > 0) {
      // Alert wins. Pick the first alert surface deterministically (Set
      // iteration is insertion order). Alert doesn't decay, so no wake.
      newLiveId = this.alertSurfaces.values().next().value ?? null;
    } else {
      // Priority arbitration over fresh heartbeats only.
      let best: { id: string; priority: number; lastNotifyMs: number } | null = null;
      for (const [id, hb] of this.heartbeats) {
        const age = now - hb.lastNotifyMs;
        if (age >= LIVE_DECAY_MS) continue;
        const priority = SURFACE_PRIORITY[hb.kind];
        if (
          !best ||
          priority > best.priority ||
          (priority === best.priority && hb.lastNotifyMs > best.lastNotifyMs)
        ) {
          best = { id, priority, lastNotifyMs: hb.lastNotifyMs };
        }
      }
      newLiveId = best?.id ?? null;
      if (best) nextWakeMs = LIVE_DECAY_MS - (now - best.lastNotifyMs);
    }

    // Apply swap with debounce.
    let swapped = false;
    if (newLiveId !== this.activeLiveSurfaceId) {
      const sinceSwap = now - this.lastSwapAtMs;
      if (this.lastSwapAtMs === 0 || sinceSwap >= SWAP_DEBOUNCE_MS) {
        this.activeLiveSurfaceId = newLiveId;
        this.lastSwapAtMs = now;
        swapped = true;
      } else {
        // Defer — schedule arbitration for the exact remaining window.
        this.scheduleArbitration(SWAP_DEBOUNCE_MS - sinceSwap);
        return;
      }
    }

    if (swapped) this.emit();

    // Schedule next decay check for the active live surface (if any,
    // and if it's decay-bound — alerts don't decay).
    if (nextWakeMs !== null && nextWakeMs > 0) {
      this.scheduleArbitration(nextWakeMs);
    } else {
      // Arbitration settled with nothing time-bound. Clear any stale
      // timer so it can't wake later and re-enter arbitrate.
      this.cancelScheduledArbitration();
    }
  }

  private scheduleArbitration(delayMs: number): void {
    if (this.disposed) return;
    this.cancelScheduledArbitration();
    this.scheduledTimer = this.setTimeoutFn(() => {
      this.scheduledTimer = null;
      if (this.disposed) return;
      this.arbitrate();
    }, delayMs);
  }

  private cancelScheduledArbitration(): void {
    if (this.scheduledTimer !== null) {
      this.clearTimeoutFn(this.scheduledTimer);
      this.scheduledTimer = null;
    }
  }

  private emit(): void {
    if (this.disposed) return;
    for (const listener of this.listeners) listener();
  }
}
