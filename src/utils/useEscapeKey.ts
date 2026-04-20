/**
 * useEscapeKey.ts
 *
 * Custom hook for handling Escape key presses in modals and dialogs.
 * Consolidates duplicate Escape key handling logic across ConsentModal, QuotaExceededModal.
 *
 * @module utils/useEscapeKey
 */

import { useEffect } from 'react';

/**
 * Register an Escape key handler that's automatically cleaned up on unmount.
 * Prevents key event from propagating.
 *
 * @param onEscape - Callback when Escape is pressed
 * @example
 * useEscapeKey(() => {
 *   handleDecline();
 * });
 */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);
}

/**
 * Register an Escape or Enter key handler.
 * Useful for dismissible modals that accept either key.
 *
 * @param onDismiss - Callback when Escape or Enter is pressed
 */
export function useEscapeOrEnterKey(onDismiss: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);
}
