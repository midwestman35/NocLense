import { useCallback, useRef, type ReactNode } from 'react';
import { PhaseHeader } from './PhaseHeader';
import { WorkspaceGrid } from './WorkspaceGrid';
import { useRoomTransition } from './useRoomTransition';
import type { Phase } from './types';

interface RoomRouterProps {
  /** Which room is active — parent owns this state */
  phase: Phase;
  /** Called when user clicks phase dots or triggers a phase change */
  onPhaseChange: (phase: Phase) => void;
  ticketId?: string;
  priorityLabel?: string;
  statusLabel?: string;
  onSettingsClick?: () => void;
  importContent: ReactNode;
  investigateContent: ReactNode;
  submitContent: ReactNode;
}

export function RoomRouter({
  phase,
  onPhaseChange,
  ticketId,
  priorityLabel,
  statusLabel,
  onSettingsClick,
  importContent,
  investigateContent,
  submitContent,
}: RoomRouterProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const currentPhaseRef = useRef<Phase>(phase);
  currentPhaseRef.current = phase;

  const { transitionTo } = useRoomTransition({
    containerRef: gridRef,
  });

  const handlePhaseChange = useCallback((nextPhase: Phase) => {
    if (nextPhase === currentPhaseRef.current) return;
    const from = currentPhaseRef.current;

    transitionTo(from, nextPhase, () => {
      onPhaseChange(nextPhase);
    });
  }, [onPhaseChange, transitionTo]);

  const roomContent: Record<Phase, ReactNode> = {
    import: importContent,
    investigate: investigateContent,
    submit: submitContent,
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <PhaseHeader
        phase={phase}
        onPhaseChange={handlePhaseChange}
        ticketId={ticketId}
        priorityLabel={priorityLabel}
        statusLabel={statusLabel}
        onSettingsClick={onSettingsClick}
      />
      <div ref={gridRef} className="flex-1 min-h-0">
        <WorkspaceGrid layout={phase}>
          {roomContent[phase]}
        </WorkspaceGrid>
      </div>
    </div>
  );
}
