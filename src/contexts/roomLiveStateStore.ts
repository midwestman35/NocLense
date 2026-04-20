/**
 * roomLiveStateStore.ts — arbitrated glow-tier state machine (spec §3.3).
 *
 * Phase 01a checkpoint 8 — further hardening per the increment-7
 * Codex review:
 *   - Alert promotion bypasses the 300ms swap debounce (spec §3.3
 *     lines 77-85: "alert on any surface — red always wins"). The
 *     previous implementation correctly picked the alerting surface
 *     as the winner but queued the swap through the normal debounce
 *     path, leaving a surface as `alert` while another still
 *     rendered `live` for up to 300ms.
 *   - Single commit point. Public mutators call arbitrate() (which
 *     no longer emits) and then emit once at the end. Subscribers
 *     never observe a pre-arbitration intermediate snapshot.
 *   - Multi-alert policy documented: every surface in alertSurfaces
 *     renders 'alert'; the internal active-live slot picks the
 *     first-inserted alert surface, but that identity is internal —
 *     visually every alerting surface is red.
 *
 * Arbitration rules (spec §3.3):
 *   - Tiers: idle / ready / live / alert.
 *   - Only ONE surface per room holds the "active live" slot.
 *   - Alert beats every other tier at the room level:
 *       * If any surface has an unacknowledged alert, that surface
 *         owns the active-live slot (rendering red).
 *       * Every other surface — even those with fresh notifies —
 *         falls back to ready.
 *   - Among non-alert contenders, priority (highest wins):
 *       parse-overlay > ai-stream > datadog-stream > connector-heartbeat.
 *   - `live` auto-decays to `ready` after LIVE_DECAY_MS without a
 *     new notify.
 *   - `ready` persists (it means "connected", not "seen recently").
 *   - SWAP_DEBOUNCE_MS debounce between non-alert swaps to suppress
 *     flicker. Alert promotions BYPASS this debounce.
 *   - `alert` persists until explicitly cleared.
 *
 * Semantics:
 *   register(id, kind)     — surface connected. Tier = ready.
 *   notify(id, kind)       — surface has fresh activity. Competes
 *                            for live. Implies register.
 *   unregister(id)         — surface disconnected. Tier = idle.
 *   raiseAlert(id)         — surface has an error. Tier = alert;
 *                            other surfaces in the room fall to ready.
 *   clearAlert(id)         — acknowledge alert. Re-arbitrates.
 *                            Surface stays ready (since raiseAlert
 *                            implies connection) until caller
 *                            unregisters.
 *   tierFor(id)            — current visible tier for a surface.
 *   dispose()              — provider teardown. Blocks further
 *                            mutations, cancels timers.
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
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
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

  readonly subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  register(surfaceId: string, kind: LiveSurfaceKind): void {
    if (this.disposed) return;
    this.connected.add(surfaceId);
    this.surfaceKinds.set(surfaceId, kind);
    this.arbitrate();
    this.emit();
  }

  notify(surfaceId: string, kind: LiveSurfaceKind): void {
    if (this.disposed) return;
    this.connected.add(surfaceId);
    this.surfaceKinds.set(surfaceId, kind);
    this.heartbeats.set(surfaceId, { kind, lastNotifyMs: this.now() });
    this.arbitrate();
    this.emit();
  }

  unregister(surfaceId: string): void {
    if (this.disposed) return;
    this.connected.delete(surfaceId);
    this.heartbeats.delete(surfaceId);
    this.alertSurfaces.delete(surfaceId);
    this.surfaceKinds.delete(surfaceId);
    if (this.activeLiveSurfaceId === surfaceId) {
      this.activeLiveSurfaceId = null;
    }
    this.arbitrate();
    this.emit();
  }

  raiseAlert(surfaceId: string): void {
    if (this.disposed) return;
    if (this.alertSurfaces.has(surfaceId)) return;
    this.alertSurfaces.add(surfaceId);
    // Alert implies connection. Surface stays at `ready` after
    // clearAlert until the caller unregisters.
    this.connected.add(surfaceId);
    this.arbitrate();
    this.emit();
  }

  clearAlert(surfaceId: string): void {
    if (this.disposed) return;
    if (!this.alertSurfaces.delete(surfaceId)) return;
    this.arbitrate();
    this.emit();
  }

  tierFor(surfaceId: string): GlowTier {
    if (this.alertSurfaces.has(surfaceId)) return 'alert';
    if (this.activeLiveSurfaceId === surfaceId) return 'live';
    if (this.connected.has(surfaceId)) return 'ready';
    return 'idle';
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.scheduledTimer !== null) {
      this.clearTimeoutFn(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.listeners.clear();
  }

  /**
   * Arbitration. Updates activeLiveSurfaceId and scheduled timers.
   * Does NOT emit — public mutators emit exactly once at the end of
   * their call, so subscribers never see intermediate state.
   */
  private arbitrate(): void {
    if (this.disposed) return;
    const now = this.now();

    let newLiveId: string | null = null;
    let nextWakeMs: number | null = null;

    if (this.alertSurfaces.size > 0) {
      // Alert wins at the room level. Pick the first-inserted alert
      // surface (Set iteration is insertion order) as the internal
      // active-live identity. Every surface in alertSurfaces still
      // renders 'alert' via tierFor — the identity only matters for
      // whether a DIFFERENT non-alert surface might render 'live'
      // (it cannot, because activeLiveSurfaceId points at an alert).
      newLiveId = this.alertSurfaces.values().next().value ?? null;
      // Alert does not decay, so no wake is needed for alert state.
    } else {
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

    if (newLiveId !== this.activeLiveSurfaceId) {
      const sinceSwap = now - this.lastSwapAtMs;
      // Alert promotions bypass debounce (spec §3.3 — alert always
      // wins, even inside the 300ms window). A swap INTO an alerting
      // surface is urgent; swaps OUT of alert or between non-alert
      // surfaces respect the debounce.
      const newIsAlert = newLiveId !== null && this.alertSurfaces.has(newLiveId);
      const firstSwap = this.lastSwapAtMs === 0;
      const debounceOk = firstSwap || sinceSwap >= SWAP_DEBOUNCE_MS;
      if (newIsAlert || debounceOk) {
        this.activeLiveSurfaceId = newLiveId;
        this.lastSwapAtMs = now;
      } else {
        this.scheduleArbitration(SWAP_DEBOUNCE_MS - sinceSwap);
        return;
      }
    }

    if (nextWakeMs !== null && nextWakeMs > 0) {
      this.scheduleArbitration(nextWakeMs);
    } else {
      this.cancelScheduledArbitration();
    }
  }

  private scheduleArbitration(delayMs: number): void {
    if (this.disposed) return;
    this.cancelScheduledArbitration();
    this.scheduledTimer = this.setTimeoutFn(() => {
      this.scheduledTimer = null;
      if (this.disposed) return;
      // Timer-driven arbitration emits on its own — no public mutator
      // wraps the callback.
      this.arbitrate();
      this.emit();
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
