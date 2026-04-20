/**
 * Loading vocabulary barrel export.
 *
 * Phase 01a components — the design-system primitives for every operation
 * whose loading state appears on screen. See design spec §4.5 for the
 * per-operation state chart that dictates which component to use when.
 */

export { TuiSpinner, type TuiSpinnerKind, type TuiSpinnerProps } from './TuiSpinner';
export { TuiProgress, type TuiProgressProps } from './TuiProgress';
export { LoadingLabel, type LoadingLabelProps } from './LoadingLabel';
export { GlowHost, type GlowHostProps } from './GlowHost';

export {
  RoomLiveStateProvider,
  useLiveSurface,
  useRoomLiveStateStore,
  useSurfaceTier,
  type GlowTier,
  type LiveSurfaceKind,
  type UseLiveSurfaceOptions,
  type UseLiveSurfaceResult,
} from '../../contexts/RoomLiveStateContext';
export {
  RoomLiveStateStore,
  SURFACE_PRIORITY,
  LIVE_DECAY_MS,
  SWAP_DEBOUNCE_MS,
  type RoomLiveStateStoreOptions,
} from '../../contexts/roomLiveStateStore';

export {
  useCuteLoadingLabel,
  buildPhraseSequence,
  CUTE_PHRASE_POOL,
  CUTE_LABEL_CYCLE_MS,
  type OperationKind,
  type UseCuteLoadingLabelResult,
} from '../../hooks/useCuteLoadingLabel';

export { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
