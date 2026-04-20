/**
 * RoomLiveStateContext.tsx — React bindings for the arbitrated glow
 * state machine (spec §3.3).
 *
 * Phase 01a increment 7 addresses the Codex review of increment 6:
 *   - Provider uses a lazy-init useRef for the owned store, so a
 *     later `store` prop change is actually followed. The owned
 *     store (if any) is disposed on unmount; an injected store is
 *     never disposed by the provider.
 *   - useLiveSurface now calls store.register() on mount (and on
 *     surfaceId/kind change), so surfaces reach the `ready` tier
 *     immediately without needing a prior notify. Auto-unregisters
 *     on unmount.
 *   - useSurfaceTier's doc softened: useSyncExternalStore calls
 *     getSnapshot for every subscriber on every emit; React bails
 *     re-render when the returned snapshot is stable.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import {
  RoomLiveStateStore,
  type GlowTier,
  type LiveSurfaceKind,
  type RoomLiveStateStoreOptions,
} from './roomLiveStateStore';

const RoomLiveStateContext = createContext<RoomLiveStateStore | null>(null);

export interface RoomLiveStateProviderProps {
  children: ReactNode;
  /**
   * Inject an externally-managed store (tests, nested providers).
   * The provider never disposes an injected store. If omitted, the
   * provider creates and owns one, and disposes it on unmount.
   */
  store?: RoomLiveStateStore;
  /**
   * Passed to a newly-created owned store. Ignored when `store` is
   * set. IMPORTANT: read ONCE on first render; subsequent changes to
   * this prop are silently ignored (the owned store is already
   * constructed). Treat this as `initialStoreOptions` — it is
   * documentation-level mount-only. If a test needs to swap options
   * mid-run, construct a new RoomLiveStateStore with the new options
   * and pass it via `store` instead.
   */
  storeOptions?: RoomLiveStateStoreOptions;
}

export function RoomLiveStateProvider({
  children,
  store,
  storeOptions,
}: RoomLiveStateProviderProps) {
  // Lazy-init owned store. Only created when no `store` is injected,
  // and only on first render. Reads the current `store` prop on every
  // render, so a caller switching to a new injected store is followed.
  const ownedStoreRef = useRef<RoomLiveStateStore | null>(null);
  if (!store && ownedStoreRef.current === null) {
    ownedStoreRef.current = new RoomLiveStateStore(storeOptions);
  }
  const activeStore = store ?? ownedStoreRef.current;
  if (!activeStore) {
    // Defensive — the conditional above guarantees one exists. Throw
    // loudly if React ever lands in this branch so the regression is
    // visible immediately.
    throw new Error('RoomLiveStateProvider: store initialization failed.');
  }

  useEffect(() => {
    // Dispose ONLY the owned store — an injected store belongs to the
    // caller. Runs once on unmount.
    return () => {
      if (ownedStoreRef.current) {
        ownedStoreRef.current.dispose();
        ownedStoreRef.current = null;
      }
    };
  }, []);

  return (
    <RoomLiveStateContext.Provider value={activeStore}>
      {children}
    </RoomLiveStateContext.Provider>
  );
}

function useStore(): RoomLiveStateStore {
  const store = useContext(RoomLiveStateContext);
  if (!store) {
    throw new Error(
      'useRoomLiveState / useSurfaceTier / useLiveSurface must be called ' +
        'inside <RoomLiveStateProvider>.',
    );
  }
  return store;
}

/**
 * Subscribe to the effective tier for one surface.
 *
 * Note: useSyncExternalStore calls `getSnapshot` for every subscriber
 * on every emit. React bails the re-render when the returned snapshot
 * is stable (same string value). Consumers watching a surface whose
 * tier hasn't changed do not re-render, but `getSnapshot` itself runs
 * on every notify across the room — this is O(surfaces) per notify,
 * which is cheap for realistic room sizes (< 10 surfaces).
 */
export function useSurfaceTier(surfaceId: string): GlowTier {
  const store = useStore();
  const getSnapshot = useCallback(() => store.tierFor(surfaceId), [store, surfaceId]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

export interface UseLiveSurfaceResult {
  /** Current tier for this surface. */
  tier: GlowTier;
  /** Publish a notify — surface has fresh data. */
  notify: () => void;
  /** Raise an alert — persists until cleared. */
  raiseAlert: () => void;
  /** Clear an alert. */
  clearAlert: () => void;
}

export interface UseLiveSurfaceOptions {
  /** Call register() on mount so tier becomes `ready` without a prior notify (default). */
  registerOnMount?: boolean;
  /** Unregister the surface on component unmount (default). */
  unregisterOnUnmount?: boolean;
}

/**
 * Bind a component to a live-state surface.
 *
 * By default the hook registers the surface on mount (so it reaches
 * `ready` immediately, per spec §3.3) and unregisters on unmount.
 * Callers can opt out of either side for advanced lifecycle control
 * (e.g. a surface that should stay alive across re-mounts).
 *
 * If `surfaceId` or `kind` changes across renders, the hook re-
 * registers under the new id/kind and unregisters the old one on
 * effect cleanup.
 */
export function useLiveSurface(
  surfaceId: string,
  kind: LiveSurfaceKind,
  options: UseLiveSurfaceOptions = {},
): UseLiveSurfaceResult {
  const store = useStore();
  const tier = useSurfaceTier(surfaceId);
  const registerOnMount = options.registerOnMount ?? true;
  const unregisterOnUnmount = options.unregisterOnUnmount ?? true;

  useEffect(() => {
    if (registerOnMount) store.register(surfaceId, kind);
    return () => {
      if (unregisterOnUnmount) store.unregister(surfaceId);
    };
  }, [store, surfaceId, kind, registerOnMount, unregisterOnUnmount]);

  const notify = useCallback(() => store.notify(surfaceId, kind), [store, surfaceId, kind]);
  const raiseAlert = useCallback(() => store.raiseAlert(surfaceId), [store, surfaceId]);
  const clearAlert = useCallback(() => store.clearAlert(surfaceId), [store, surfaceId]);

  return { tier, notify, raiseAlert, clearAlert };
}

/** Escape hatch: direct access to the store (e.g. from non-React code paths). */
export function useRoomLiveStateStore(): RoomLiveStateStore {
  return useStore();
}

export type { GlowTier, LiveSurfaceKind };
