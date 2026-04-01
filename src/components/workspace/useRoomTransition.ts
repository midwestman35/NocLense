/**
 * useRoomTransition — orchestrates exit/enter animations between rooms.
 *
 * Pattern: exit current room → instant swap → enter new room.
 * Each room type has distinct enter/exit choreography.
 */

import { useRef, useCallback, useState } from 'react';
import type { Phase } from './types';

type TransitionState = 'idle' | 'exiting' | 'entering';

interface UseRoomTransitionOptions {
  /** Ref to the grid container (WorkspaceGrid wrapper) */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Duration for exit animation in ms */
  exitDuration?: number;
  /** Duration for enter animation in ms */
  enterDuration?: number;
}

/**
 * Returns a `transitionTo` function that animates between phases,
 * and a `transitionState` for conditional rendering (e.g. overlay).
 */
export function useRoomTransition({
  containerRef,
  exitDuration = 250,
  enterDuration = 350,
}: UseRoomTransitionOptions) {
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const animatingRef = useRef(false);

  const transitionTo = useCallback(
    async (from: Phase, to: Phase, swapPhase: () => void) => {
      const container = containerRef.current;
      if (!container || animatingRef.current) {
        // No container or already animating — just swap immediately
        swapPhase();
        return;
      }

      animatingRef.current = true;
      setTransitionState('exiting');

      // ── Exit animation ──
      const exitDirection = getExitDirection(from, to);

      // Apply exit styles
      container.style.transition = `opacity ${exitDuration}ms var(--room-transition-ease), transform ${exitDuration}ms var(--room-transition-ease)`;
      container.style.opacity = '0';
      container.style.transform = exitDirection;

      await delay(exitDuration);

      // ── Swap phase (React re-render) ──
      container.style.transition = 'none';
      container.style.transform = getEnterStartTransform(from, to);
      container.style.opacity = '0';
      swapPhase();

      // Wait for React to paint the new room
      await nextFrame();
      await nextFrame();

      // ── Enter animation ──
      setTransitionState('entering');
      container.style.transition = `opacity ${enterDuration}ms var(--room-transition-ease), transform ${enterDuration}ms var(--room-transition-ease)`;
      container.style.opacity = '1';
      container.style.transform = 'translateY(0) scale(1)';

      await delay(enterDuration);

      // ── Stagger cards in (Investigate room) ──
      if (to === 'investigate') {
        const newCards = container.querySelectorAll<HTMLElement>('[data-card-id]');
        await staggerCards(newCards);
      }

      // ── Cleanup ──
      container.style.transition = '';
      container.style.transform = '';
      container.style.opacity = '';
      setTransitionState('idle');
      animatingRef.current = false;
    },
    [containerRef, exitDuration, enterDuration]
  );

  return { transitionTo, transitionState };
}

// ── Helpers ──────────────────────────────────────────────────────

function getExitDirection(from: Phase, to: Phase): string {
  if (from === 'import' && to === 'investigate') {
    return 'scale(1.02) translateY(-8px)'; // Scale up slightly, drift up
  }
  if (from === 'investigate' && to === 'submit') {
    return 'scale(0.98) translateY(-12px)'; // Shrink, drift up
  }
  if (from === 'submit' && to === 'import') {
    return 'scale(0.95) translateY(8px)'; // Shrink down
  }
  // Back navigation
  if (from === 'investigate' && to === 'import') {
    return 'scale(0.98) translateY(8px)'; // Shrink, drift down (reverse)
  }
  if (from === 'submit' && to === 'investigate') {
    return 'scale(1.02) translateY(8px)'; // Expand slightly, drift down
  }
  return 'translateY(-8px) opacity(0)';
}

function getEnterStartTransform(_from: Phase, to: Phase): string {
  if (to === 'investigate') {
    return 'scale(0.98) translateY(8px)'; // Enter from below, slightly smaller
  }
  if (to === 'submit') {
    return 'scale(0.96) translateY(12px)'; // Enter from below
  }
  if (to === 'import') {
    return 'scale(1.02) translateY(-8px)'; // Enter from above, slightly larger
  }
  return 'translateY(8px)';
}

async function staggerCards(cards: NodeListOf<HTMLElement>): Promise<void> {
  if (cards.length === 0) return;

  // Set initial state
  cards.forEach((card) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(6px)';
  });

  // Stagger reveal
  const staggerDelay = 40; // ms between each card
  for (let i = 0; i < cards.length; i++) {
    await delay(staggerDelay);
    const card = cards[i];
    card.style.transition = 'opacity 200ms var(--room-transition-ease), transform 200ms var(--room-transition-ease)';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }

  // Cleanup after last card finishes
  await delay(200);
  cards.forEach((card) => {
    card.style.transition = '';
    card.style.transform = '';
    card.style.opacity = '';
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
