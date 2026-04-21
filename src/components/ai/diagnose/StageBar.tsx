import clsx from 'clsx';
import {
  DIAGNOSE_PIPELINE_STAGES,
  type DiagnosePipelineStage,
} from './pipelineUi';

interface StageBarProps {
  activeStage?: DiagnosePipelineStage | null;
  completedStages?: DiagnosePipelineStage[];
  className?: string;
}

function getStageState(
  stageId: DiagnosePipelineStage,
  activeStage: DiagnosePipelineStage | null | undefined,
  completedStages: Set<DiagnosePipelineStage>
): 'complete' | 'active' | 'pending' {
  if (completedStages.has(stageId)) {
    return 'complete';
  }
  if (stageId === activeStage) {
    return 'active';
  }
  return 'pending';
}

export default function StageBar({
  activeStage = null,
  completedStages = [],
  className,
}: StageBarProps) {
  const completed = new Set(completedStages);

  return (
    <ol
      aria-label="Diagnosis pipeline"
      className={clsx(
        'flex shrink-0 items-start gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--muted)] px-3 py-3',
        className
      )}
    >
      {DIAGNOSE_PIPELINE_STAGES.map((stage, index) => {
        const state = getStageState(stage.id, activeStage, completed);
        const isActive = state === 'active';
        const isComplete = state === 'complete';
        const isPending = state === 'pending';

        return (
          <li key={stage.id} className="flex min-w-[7.25rem] flex-1 items-center gap-2">
            <div
              aria-current={isActive ? 'step' : undefined}
              aria-label={stage.label}
              data-stage-id={stage.id}
              data-stage-state={state}
              className="flex min-w-0 items-center gap-2"
              title={stage.description}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-[background-color,border-color,box-shadow,color]"
                style={{
                  backgroundColor: isComplete
                    ? 'var(--success)'
                    : isActive
                      ? 'var(--accent)'
                      : 'var(--background)',
                  borderColor: isComplete
                    ? 'var(--success)'
                    : isActive
                      ? 'var(--ring)'
                      : 'var(--border)',
                  boxShadow: isActive
                    ? '0 0 0 3px color-mix(in srgb, var(--ring) 18%, transparent)'
                    : 'none',
                  color: isPending ? 'var(--muted-foreground)' : 'var(--foreground)',
                }}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate text-[11px] font-medium"
                  style={{
                    color: isPending ? 'var(--muted-foreground)' : 'var(--foreground)',
                  }}
                >
                  {stage.label}
                </span>
                <span className="block truncate text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {stage.description}
                </span>
              </span>
            </div>

            {index < DIAGNOSE_PIPELINE_STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className="h-px flex-1"
                style={{
                  backgroundColor: isComplete ? 'var(--success)' : 'var(--border)',
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
