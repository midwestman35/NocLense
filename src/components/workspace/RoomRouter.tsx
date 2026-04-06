import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Action buttons for the header (Import, Export, Clear, etc.) */
  headerActions?: ReactNode;
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
  headerActions,
  importContent,
  investigateContent,
  submitContent,
}: RoomRouterProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [displayPhase, setDisplayPhase] = useState<Phase>(phase);
  const displayPhaseRef = useRef<Phase>(phase);
  displayPhaseRef.current = displayPhase;

  const { transitionTo } = useRoomTransition({
    containerRef: gridRef,
  });

  const handlePhaseChange = useCallback((nextPhase: Phase) => {
    if (nextPhase === phase) return;
    onPhaseChange(nextPhase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    if (phase === displayPhaseRef.current) return;

    void transitionTo(displayPhaseRef.current, phase, () => {
      setDisplayPhase(phase);
    });
  }, [displayPhase, phase, transitionTo]);

  const roomContent: Record<Phase, ReactNode> = {
    import: importContent,
    investigate: investigateContent,
    submit: submitContent,
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <PhaseHeader
        phase={displayPhase}
        onPhaseChange={handlePhaseChange}
        ticketId={ticketId}
        priorityLabel={priorityLabel}
        statusLabel={statusLabel}
        actions={headerActions}
      />
      <div ref={gridRef} className="flex-1 min-h-0">
        <WorkspaceGrid layout={displayPhase}>
          {roomContent[displayPhase]}
        </WorkspaceGrid>
      </div>
    </div>
  );
}
