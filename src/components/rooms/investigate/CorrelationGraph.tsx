import { type JSX } from 'react';
import { Database } from 'lucide-react';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';
import { CorrelationGraph as CoreCorrelationGraph } from '../../correlation-graph/CorrelationGraph';

export function CorrelationGraph(): JSX.Element {
  return (
    <WorkspaceCard
      id="correlation-graph"
      title="Correlation Graph"
      icon={<Database size={14} />}
      accentColor="var(--correlation-call-id)"
      defaultExpanded={false}
      className={CARD_GRID_CLASSES['correlation-graph']}
    >
      <CoreCorrelationGraph />
    </WorkspaceCard>
  );
}
