/**
 * usePrefersReducedMotion.ts — React hook for the `prefers-reduced-motion`
 * media query, re-reactive on system changes.
 *
 * Phase 01a utility, consumed by useCuteLoadingLabel and any other hook
 * that needs to short-circuit animation logic at the JS level. CSS-only
 * animations already handle reduced motion via @media queries in
 * `loading.css`; this hook is for JS-driven intervals (e.g. the 2500ms
 * phrase cycle).
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefers(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return prefers;
}
