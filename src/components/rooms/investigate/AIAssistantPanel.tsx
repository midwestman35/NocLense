import { type JSX } from 'react';
import { Sparkles } from 'lucide-react';
import { AISidebar } from '../../AISidebar';
import { Badge } from '../../ui';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';
import type { CitationId } from '../../../types/canonical';
import type { InvestigationSetup } from '../../../types/investigation';

interface AIAssistantPanelProps {
  pendingSetup: InvestigationSetup | null;
  onSetupAI: () => void;
  onSetupConsumed: () => void;
  onCitationClick: (citationId: CitationId) => void;
}

export function AIAssistantPanel({
  pendingSetup,
  onSetupAI,
  onSetupConsumed,
  onCitationClick,
}: AIAssistantPanelProps): JSX.Element {
  return (
    <WorkspaceCard
      id="ai-assistant"
      title="AI Assistant"
      icon={<Sparkles size={14} />}
      accentColor="#76ce40"
      badge={<Badge variant="level-info">Unleashed</Badge>}
      className={CARD_GRID_CLASSES['ai-assistant']}
    >
      <div className="h-full min-h-0 overflow-hidden">
        <AISidebar
          onSetupAI={onSetupAI}
          pendingSetup={pendingSetup}
          onSetupConsumed={onSetupConsumed}
          onCitationClick={onCitationClick}
        />
      </div>
    </WorkspaceCard>
  );
}
