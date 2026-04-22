/**
 * anime.js v4 utility hooks for NocLense.
 *
 * Boundary rule: Motion handles mount/unmount (Dialog, Sheet).
 * anime.js handles stagger, timeline orchestration, and SVG.
 */

import { useEffect, useRef, useState, type DependencyList, type RefObject } from 'react';
import type { JSAnimation, Timeline } from 'animejs';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// Lazy-load anime.js so it stays out of the initial bundle
let animeModule: typeof import('animejs') | null = null;
let animePromise: Promise<typeof import('animejs')> | null = null;
function loadAnime() {
  if (animeModule) return Promise.resolve(animeModule);
  if (!animePromise) {
    animePromise = import('animejs').then((m) => {
      animeModule = m;
      return m;
    });
  }
  return animePromise;
}

// ── useAnimeStagger ──────────────────────────────────────────────

export interface StaggerOptions {
  translateY?: [number, number];
  opacity?: [number, number];
  scale?: [number, number];
  delay?: number;
  stagger?: number;
  duration?: number;
  easing?: string;
}

const STAGGER_DEFAULTS: Required<StaggerOptions> = {
  translateY: [8, 0],
  opacity: [0, 1],
  scale: [1, 1],
  delay: 0,
  stagger: 40,
  duration: 300,
  easing: 'easeOutCubic',
};

/**
 * Stagger-animate children matching `selector` inside `containerRef`
 * whenever `deps` change.
 */
export function useAnimeStagger(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  deps: DependencyList,
  options?: StaggerOptions
) {
  const animRef = useRef<JSAnimation | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const targets = el.querySelectorAll(selector);
    if (targets.length === 0) return;

    const opts = { ...STAGGER_DEFAULTS, ...options };

    if (prefersReducedMotion) {
      animRef.current?.pause();
      targets.forEach((target) => {
        const targetElement = target as HTMLElement;
        targetElement.style.opacity = String(opts.opacity[1]);
        targetElement.style.transform =
          `translateY(${opts.translateY[1]}px) scale(${opts.scale[1]})`;
      });
      return;
    }

    let cancelled = false;
    loadAnime().then(({ animate, stagger }) => {
      if (cancelled) return;
      // Reset initial state
      targets.forEach((t) => {
        (t as HTMLElement).style.opacity = String(opts.opacity[0]);
      });

      const props: Record<string, unknown> = {
        translateY: opts.translateY,
        opacity: opts.opacity,
        delay: stagger(opts.stagger, { start: opts.delay }),
        duration: opts.duration,
        ease: opts.easing,
      };
      if (opts.scale[0] !== opts.scale[1]) {
        props.scale = opts.scale;
      }
      animRef.current = animate(targets, props as any);
    });

    return () => {
      cancelled = true;
      animRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, ...deps]);
}

// ── useAnimeTimeline ─────────────────────────────────────────────

export interface TimelineStep {
  targets: string | HTMLElement | NodeListOf<Element>;
  properties: Record<string, any>;
  offset?: string | number;
}

/**
 * Build and control an anime.js timeline.
 * Rebuilds when `deps` change.
 */
export function useAnimeTimeline(
  steps: TimelineStep[],
  deps: DependencyList
) {
  const tlRef = useRef<Timeline | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (steps.length === 0) return;
    if (prefersReducedMotion) {
      tlRef.current?.pause();
      tlRef.current = null;
      return;
    }

    let cancelled = false;
    loadAnime().then(({ createTimeline }) => {
      if (cancelled) return;
      const tl = createTimeline({ autoplay: false, defaults: { ease: 'easeOutCubic' } });
      steps.forEach(({ targets, properties, offset }) => {
        tl.add(targets, { ...properties } as any, offset);
      });
      tlRef.current = tl;
    });

    return () => {
      cancelled = true;
      tlRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, ...deps]);

  return {
    play: () => tlRef.current?.play(),
    pause: () => tlRef.current?.pause(),
    restart: () => tlRef.current?.restart(),
    seek: (time: number) => tlRef.current?.seek(time),
    get timeline() { return tlRef.current; },
  };
}

// ── useAnimeValue ────────────────────────────────────────────────

/**
 * Tween a numeric value and return it as React state.
 * Useful for counters, progress bars, animated stats.
 */
export function useAnimeValue(
  from: number,
  to: number,
  options?: { duration?: number; easing?: string; delay?: number }
): number {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(() => (prefersReducedMotion ? to : from));
  const animRef = useRef<JSAnimation | null>(null);
  const objRef = useRef({ val: from });

  useEffect(() => {
    if (from === to) {
      objRef.current.val = to;
      setValue(to);
      return;
    }

    if (prefersReducedMotion) {
      animRef.current?.pause();
      objRef.current.val = to;
      setValue(to);
      return;
    }

    objRef.current.val = from;
    let cancelled = false;

    loadAnime().then(({ animate }) => {
      if (cancelled) return;
      animRef.current = animate(objRef.current, {
        val: to,
        duration: options?.duration ?? 600,
        ease: options?.easing ?? 'easeOutCubic',
        delay: options?.delay ?? 0,
        onUpdate: () => {
          if (!cancelled) setValue(Math.round(objRef.current.val));
        },
      } as any);
    });

    return () => {
      cancelled = true;
      animRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, prefersReducedMotion]);

  return value;
}
