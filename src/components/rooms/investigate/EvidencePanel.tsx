import { type JSX } from 'react';
import { Bookmark } from 'lucide-react';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';
import CoreEvidencePanel from '../../evidence/EvidencePanel';
import type { EvidenceSet } from '../../../types/canonical';
import { useBundleSizePulse } from '../../../hooks/useBundleSizePulse';

interface EvidencePanelProps {
  evidenceSet: EvidenceSet | null;
}

function EvidenceCountBadge({ evidenceSet }: EvidencePanelProps): JSX.Element {
  const { pulseKey } = useBundleSizePulse(evidenceSet);

  return (
    <span
      key={pulseKey}
      className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--warning)] motion-safe:animate-[bundle-pulse_300ms_var(--ease-enter-out,ease-out)_both]"
    >
      {evidenceSet?.items.length ?? 0}
    </span>
  );
}

export function EvidencePanel({ evidenceSet }: EvidencePanelProps): JSX.Element {
  return (
    <WorkspaceCard
      id="evidence"
      title="Evidence"
      icon={<Bookmark size={14} />}
      accentColor="#f59e0b"
      badge={<EvidenceCountBadge evidenceSet={evidenceSet} />}
      className={CARD_GRID_CLASSES.evidence}
    >
      <CoreEvidencePanel />
    </WorkspaceCard>
  );
}
