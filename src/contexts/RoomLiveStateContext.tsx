/**
 * RoomLiveStateContext.tsx — React bindings for the arbitrated glow
 * state machine (spec §3.3).
 *
 * Phase 01a increment 6. Wraps `RoomLiveStateStore` with
 * `useSyncExternalStore` so each consumer re-renders ONLY when its
 * own surface tier changes, not on every notify across the room.
 *
 * Usage:
 *   <RoomLiveStateProvider>
 *     <Investigate />
 *   </RoomLiveStateProvider>
 *
 *   // Inside a surface component:
 *   const { tier, notify, raiseAlert, clearAlert } =
 *     useLiveSurface('ai-diagnose-card', 'ai-stream');
 *
 *   useEffect(() => {
 *     if (response.streaming) notify();
 *   }, [response.streaming]);
 *
 *   return (
 *     <GlowHost tier={tier} borderRadius="var(--card-radius)">
 *       <Card>…</Card>
 *     </GlowHost>
 *   );
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
   * Optional store injection (useful for tests and for sharing a store
   * between multiple provider trees). If omitted, a fresh store is
   * created and disposed on unmount.
   */
  store?: RoomLiveStateStore;
  /** Forwarded to a fresh store when `store` is omitted. */
  storeOptions?: RoomLiveStateStoreOptions;
}

export function RoomLiveStateProvider({
  children,
  store,
  storeOptions,
}: RoomLiveStateProviderProps) {
  const managedStore = useMemo(
    () => store ?? new RoomLiveStateStore(storeOptions),
    // Only create on mount — store identity must be stable across
    // re-renders so listeners don't thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    // If the provider owns the store, clean up its timer on unmount.
    if (!store) {
      return () => managedStore.dispose();
    }
    return undefined;
  }, [store, managedStore]);

  return (
    <RoomLiveStateContext.Provider value={managedStore}>
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

/** Subscribe to the effective tier for one surface. Re-renders only on its change. */
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
  /** When true, unregister the surface on component unmount (default). */
  unregisterOnUnmount?: boolean;
}

/**
 * Bind a component to a live-state surface. Returns the tier and
 * control callbacks. Automatically unregisters the surface when the
 * component unmounts.
 */
export function useLiveSurface(
  surfaceId: string,
  kind: LiveSurfaceKind,
  options: UseLiveSurfaceOptions = {},
): UseLiveSurfaceResult {
  const store = useStore();
  const tier = useSurfaceTier(surfaceId);
  const unregisterOnUnmount = options.unregisterOnUnmount ?? true;

  useEffect(() => {
    if (!unregisterOnUnmount) return undefined;
    return () => store.unregister(surfaceId);
  }, [store, surfaceId, unregisterOnUnmount]);

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
