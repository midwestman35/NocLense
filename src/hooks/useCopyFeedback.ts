/**
 * useCopyFeedback; copy-to-clipboard with transient "Copied!"
 * feedback state. Cleans up its pending timeout on unmount so an
 * unmount mid-flash does not call setState on an unmounted component.
 *
 * @param flashMs How long the copied=true state lingers after a
 * successful copy. Defaults to 2000ms.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCopyFeedbackResult {
  copied: boolean;
  /**
   * Writes text to the clipboard and flashes copied=true for
   * flashMs. If the clipboard write rejects, copied stays false
   * and the returned promise rejects with the underlying error.
   */
  copy: (text: string) => Promise<void>;
}

export function useCopyFeedback(flashMs = 2000): UseCopyFeedbackResult {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      if (!mountedRef.current) return;

      setCopied(true);

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setCopied(false);
        }
        timeoutRef.current = null;
      }, flashMs);
    },
    [flashMs],
  );

  return { copied, copy };
}
