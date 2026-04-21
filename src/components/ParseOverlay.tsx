import { useCuteLoadingLabel } from '../hooks/useCuteLoadingLabel';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { TuiSpinner } from './loading/TuiSpinner';

interface ParseOverlayProps {
  progress: number | null;
  rowsParsed?: number;
}

export default function ParseOverlay({ progress, rowsParsed }: ParseOverlayProps) {
  const reducedMotion = usePrefersReducedMotion();
  const active = progress !== null && progress < 100;
  const { phrase } = useCuteLoadingLabel('file-parse', active);
  const percentage = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  const isVisible = progress !== null;

  return (
    <div
      aria-hidden={!isVisible}
      data-testid="parse-overlay"
      data-state={isVisible ? 'open' : 'closed'}
      className={`overflow-hidden bg-[var(--card)] ${
        reducedMotion ? '' : 'transition-[max-height,padding,border-color] duration-200 ease-[var(--ease-enter-out)]'
      }`}
      style={{
        maxHeight: isVisible ? '72px' : '0px',
        paddingTop: isVisible ? '8px' : '0px',
        paddingBottom: isVisible ? '8px' : '0px',
        paddingLeft: isVisible ? '12px' : '0px',
        paddingRight: isVisible ? '12px' : '0px',
        borderBottomWidth: isVisible ? '1px' : '0px',
        borderBottomStyle: 'solid',
        borderBottomColor: isVisible ? 'var(--border)' : 'transparent',
      }}
    >
      {isVisible && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-xs text-[var(--foreground)]">
          {reducedMotion ? (
            <span aria-hidden="true" data-testid="parse-overlay-static-spinner" className="font-mono text-[var(--muted-foreground)]">
              █
            </span>
          ) : (
            <TuiSpinner
              decorative
              kind="block"
              data-testid="parse-overlay-spinner"
              className="text-[var(--muted-foreground)]"
            />
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-mono text-[var(--muted-foreground)]">{phrase}</span>
            {percentage !== null && (
              <span className="shrink-0 tabular-nums text-[var(--foreground)]">
                {percentage}%
              </span>
            )}
            {rowsParsed != null && (
              <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                {rowsParsed.toLocaleString()} rows parsed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
