/**
 * GlowHost.tsx — wrapper primitive that renders the glow tier overlay
 * on a non-clipping outer element.
 *
 * Checkpoint 3 created this component with a `live: boolean` prop.
 * Increment 6 (RoomLiveState arbitration) upgrades it to a full
 * `tier: GlowTier` so idle/ready/live/alert all render correctly
 * through the state machine.
 *
 * Why it exists: `.glow-surface--*` classes paint a pseudo-element
 * box-shadow OUTSIDE the host. Any host with `overflow: hidden`
 * clips that overlay. Cards (src/components/workspace/WorkspaceCard)
 * use overflow-hidden for content scrolling, so applying the class
 * directly to a card clips the glow. GlowHost wraps the child in a
 * non-clipping outer and applies the tier class there.
 *
 * Composition with the room state machine:
 *   const { tier } = useLiveSurface('my-id', 'ai-stream');
 *   return (
 *     <GlowHost tier={tier} borderRadius="var(--card-radius)">
 *       <WorkspaceCard>...</WorkspaceCard>
 *     </GlowHost>
 *   );
 */

import type { CSSProperties, ReactNode } from 'react';

import type { GlowTier } from '../../contexts/roomLiveStateStore';

export interface GlowHostProps {
  /** Current tier from the room arbitration context. */
  tier: GlowTier;
  /** The clipping child (typically a card with overflow: hidden). */
  children: ReactNode;
  /**
   * Border-radius applied to the wrapper so the overlay's
   * `border-radius: inherit` matches the child's rounding. Pass a
   * token reference like `var(--card-radius)`.
   */
  borderRadius?: string;
  /** Extra classes on the wrapper (e.g. Tailwind layout classes). */
  className?: string;
  /** Extra inline styles on the wrapper. */
  style?: CSSProperties;
}

const TIER_CLASS: Record<GlowTier, string | null> = {
  idle: null,
  ready: 'glow-surface glow-surface--ready',
  live: 'glow-surface glow-surface--live',
  alert: 'glow-surface glow-surface--alert',
};

export function GlowHost({
  tier,
  children,
  borderRadius,
  className,
  style,
}: GlowHostProps) {
  const tierClass = TIER_CLASS[tier];
  const cls = [tierClass, className].filter(Boolean).join(' ') || undefined;
  const mergedStyle: CSSProperties | undefined = borderRadius
    ? { borderRadius, ...style }
    : style;
  return (
    <div className={cls} style={mergedStyle}>
      {children}
    </div>
  );
}
