import { useCallback, useRef, type ReactNode } from 'react';
import { PhaseHeader } from './PhaseHeader';
import { WorkspaceGrid } from './WorkspaceGrid';
import { useAnimeTimeline, type TimelineStep } from '../../utils/anime';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Build transition timeline steps (placeholder — Phase 4 will implement the full choreography)
  const transitionSteps: TimelineStep[] = [];
  useAnimeTimeline(transitionSteps, [phase]);

  const handlePhaseChange = useCallback((nextPhase: Phase) => {
    onPhaseChange(nextPhase);
  }, [onPhaseChange]);

  const roomContent: Record<Phase, ReactNode> = {
    import: importContent,
    investigate: investigateContent,
    submit: submitContent,
  };

  return (
    <div ref={containerRef} className="flex h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <PhaseHeader
        phase={phase}
        onPhaseChange={handlePhaseChange}
        ticketId={ticketId}
        priorityLabel={priorityLabel}
        statusLabel={statusLabel}
        onSettingsClick={onSettingsClick}
      />
      <WorkspaceGrid layout={phase}>
        {roomContent[phase]}
      </WorkspaceGrid>
    </div>
  );
}
