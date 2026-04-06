import { clsx } from 'clsx';
import type { Phase } from './types';
import { PHASE_ORDER, PHASE_LABELS } from './types';

interface PhaseDotsProps {
  current: Phase;
  onNavigate: (phase: Phase) => void;
  className?: string;
}

export function PhaseDots({ current, onNavigate, className }: PhaseDotsProps) {
  const currentIdx = PHASE_ORDER.indexOf(current);

  return (
    <div className={clsx('flex items-center gap-1', className)} role="navigation" aria-label="Investigation phases">
      {PHASE_ORDER.map((phase, i) => {
        const isActive = phase === current;
        const isCompleted = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={phase} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className="w-5 h-px transition-colors duration-300"
                style={{ backgroundColor: isCompleted || isActive ? 'var(--phase-dot-complete)' : 'var(--phase-dot-inactive)' }}
              />
            )}
            <button
              aria-label={PHASE_LABELS[phase]}
              aria-current={isActive ? 'step' : undefined}
              data-completed={isCompleted ? 'true' : undefined}
              onClick={() => {
                if (isCompleted) onNavigate(phase);
              }}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-300',
                isActive && 'text-[var(--phase-dot-active)]',
                isCompleted && 'text-[var(--phase-dot-complete)] cursor-pointer hover:text-[var(--phase-dot-active)]',
                isFuture && 'text-[var(--phase-dot-inactive)] cursor-default',
              )}
              disabled={isFuture}
            >
              <span
                className={clsx(
                  'block rounded-full transition-all duration-300',
                  isActive && 'animate-phase-pulse',
                )}
                style={{
                  width: 'var(--phase-dot-size)',
                  height: 'var(--phase-dot-size)',
                  backgroundColor: isActive
                    ? 'var(--phase-dot-active)'
                    : isCompleted
                      ? 'var(--phase-dot-complete)'
                      : 'var(--phase-dot-inactive)',
                }}
              />
              {PHASE_LABELS[phase]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
