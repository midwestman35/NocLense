import { useEffect, useState, type JSX } from 'react';
import { Button } from '../ui';
import { LoadingLabel } from '../loading/LoadingLabel';
import { TuiSpinner } from '../loading/TuiSpinner';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const SPLASH_PHRASES = [
  'Reviewing…',
  'Investigating…',
  'Taking a look…',
  'Thinking…',
  'Working…',
  'Puzzling it out…',
  'Digging in…',
  'Grepping…',
  'Tracing…',
  'Crunching…',
  'Brewing…',
  'Sifting…',
] as const;

const SPLASH_PHRASE_CYCLE_MS = 3500;

interface SplashScreenProps {
  onContinue: () => void;
}

export function SplashScreen({ onContinue }: SplashScreenProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % SPLASH_PHRASES.length);
    }, SPLASH_PHRASE_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const phrase = SPLASH_PHRASES[phraseIndex];

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--bg-0)] text-[var(--ink-0)]">
      <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-[var(--line)] px-6">
        <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--mint)]" />
          <span>NocLense</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="mono">v4.2.0</span>
          <span aria-hidden="true" className="text-[var(--ink-3)]">·</span>
          <span className="mono text-[var(--ink-3)]">Standalone</span>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 sm:px-8">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[18px] border border-[rgba(142,240,183,0.28)] bg-[linear-gradient(160deg,#1f5a3f,#0a1e15)] text-[var(--mint)] shadow-[0_12px_42px_-18px_rgba(142,240,183,0.55)]">
            <TuiSpinner
              decorative
              kind="braille"
              className="text-[48px] leading-none"
            />
          </div>

          <h1 className="whitespace-nowrap text-4xl font-normal leading-none tracking-[-0.04em] text-[var(--ink-0)] sm:text-5xl xl:text-[60px]">
            NocLense
          </h1>

          <div className="mt-4 text-[var(--ink-2)]">
            <LoadingLabel
              key={phrase}
              text={phrase}
              ariaStatus="Loading NocLense"
              className="text-[var(--ink-2)]"
              style={{ fontSize: '18px', letterSpacing: '0.02em' }}
            />
          </div>

          <Button type="button" size="lg" className="mt-8 w-48" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </section>
    </div>
  );
}
