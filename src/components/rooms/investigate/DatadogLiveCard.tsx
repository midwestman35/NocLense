import type { JSX } from 'react';
import { Database } from 'lucide-react';
import { useLiveSurface, useSurfaceTier } from '../../../contexts/RoomLiveStateContext';
import type { GlowTier } from '../../../contexts/roomLiveStateStore';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';

function tierToAccent(tier: GlowTier): string {
  switch (tier) {
    case 'alert':
      return 'var(--destructive)';
    case 'live':
    case 'ready':
      return '#a855f7';
    case 'idle':
    default:
      return 'var(--muted-foreground)';
  }
}

export function DatadogLiveCard(): JSX.Element {
  useLiveSurface('datadog-live', 'datadog-stream');
  const tier = useSurfaceTier('datadog-live');

  return (
    <WorkspaceCard
      id="datadog-live"
      title="Datadog Live"
      icon={<Database size={14} />}
      accentColor={tierToAccent(tier)}
      defaultExpanded={false}
      className={CARD_GRID_CLASSES['datadog-live']}
      dataAttributes={{
        'data-surface': 'datadog-live',
        'data-tier': tier,
      }}
    >
      <div className="p-3 text-xs text-[var(--muted-foreground)]">
        <p>Streaming production errors from Datadog API.</p>
        <p className="mt-2 text-[9px] uppercase tracking-wider">Tier: {tier}</p>
      </div>
    </WorkspaceCard>
  );
}
