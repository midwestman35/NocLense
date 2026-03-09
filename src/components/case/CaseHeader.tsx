import { useMemo } from 'react';
import { useCase } from '../../store/caseContext';
import { useLogContext } from '../../contexts/LogContext';

function formatWindow(start?: number, end?: number): string {
  if (!start || !end) return 'Window not set';
  const startLabel = new Date(start).toLocaleString();
  const endLabel = new Date(end).toLocaleString();
  return `${startLabel} - ${endLabel}`;
}

export function CaseHeader() {
  const { activeCase } = useCase();
  const { activeCorrelations } = useLogContext();

  const pivotCount = activeCorrelations.length;
  const evidenceCount = activeCase?.bookmarks.length ?? 0;

  const windowLabel = useMemo(() => {
    if (!activeCase) return 'No active case';
    const caseWindow = activeCase.timeWindow ?? activeCase.state?.timeWindow;
    return formatWindow(caseWindow?.start, caseWindow?.end);
  }, [activeCase]);

  if (!activeCase) {
    return (
      <div
        className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]"
        style={{ backgroundImage: 'var(--panel-header-surface)' }}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-[var(--foreground)]">No active case</span>
          <span>Create or select a case to capture evidence and build a handoff pack.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-b border-[var(--border)] px-3 py-2 text-xs"
      style={{ backgroundImage: 'var(--panel-header-surface)' }}
    >
      <div className="flex flex-wrap items-center gap-2.5 text-[var(--muted-foreground)]">
        <span className="font-medium text-[var(--foreground)]">{activeCase.title}</span>
        {activeCase.externalRef ? <span>{activeCase.externalRef}</span> : null}
        <span className="rounded-md border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] px-2 py-0.5 uppercase tracking-[0.14em]">
          {activeCase.severity}
        </span>
        <span className="rounded-md border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] px-2 py-0.5 uppercase tracking-[0.14em]">
          {activeCase.status}
        </span>
        <span>{windowLabel}</span>
        <span>{pivotCount} pivots</span>
        <span>{evidenceCount} evidence</span>
      </div>
    </div>
  );
}
