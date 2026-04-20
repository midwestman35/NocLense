/**
 * GlowHost.tsx — wrapper primitive that renders the live-glow overlay
 * on a non-clipping outer element.
 *
 * Why it exists: `.glow-live` paints a pseudo-element box-shadow
 * OUTSIDE the element's box. Any host with `overflow: hidden` clips
 * that overlay. Cards in this codebase (src/components/workspace/
 * WorkspaceCard.tsx) use overflow-hidden for content scrolling, so
 * applying `.glow-live` directly to a card yields a clipped glow.
 * GlowHost wraps the clipping surface in a non-clipping div and
 * applies `.glow-live` to that outer wrapper.
 *
 * Usage:
 *   <GlowHost live={isLive} borderRadius="var(--card-radius)">
 *     <WorkspaceCard>...</WorkspaceCard>
 *   </GlowHost>
 *
 * `borderRadius` tells the wrapper to match the child's rounding so
 * the glow overlay's `border-radius: inherit` resolves correctly.
 * If omitted, the overlay is rectangular.
 */

import type { CSSProperties, ReactNode } from 'react';

export interface GlowHostProps {
  /** When true, the host renders the live-glow overlay. */
  live: boolean;
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

export function GlowHost({
  live,
  children,
  borderRadius,
  className,
  style,
}: GlowHostProps) {
  const cls = [live && 'glow-live', className].filter(Boolean).join(' ');
  const mergedStyle: CSSProperties | undefined = borderRadius
    ? { borderRadius, ...style }
    : style;
  return (
    <div className={cls || undefined} style={mergedStyle}>
      {children}
    </div>
  );
}
