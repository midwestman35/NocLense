import AiPanel from './ai/AiPanel';
import type { InvestigationSetup } from '../types/investigation';
import type { CitationId } from '../types/canonical';

interface AISidebarProps {
  onSetupAI?: () => void;
  /** Ticket ID pre-loaded from the Import screen — auto-switches to Diagnose tab */
  pendingTicketId?: string;
  /** Called once DiagnoseTab has consumed the pending ticket */
  onTicketHandled?: () => void;
  /** Full investigation setup from the setup modal — triggers auto-scan in DiagnoseTab */
  pendingSetup?: InvestigationSetup | null;
  /** Called once DiagnoseTab has consumed the setup */
  onSetupConsumed?: () => void;
  onCitationClick?: (citationId: CitationId) => void;
}

export function AISidebar({
  onSetupAI: _onSetupAI,
  pendingTicketId,
  onTicketHandled,
  pendingSetup,
  onSetupConsumed,
  onCitationClick,
}: AISidebarProps) {
  return (
    <AiPanel
      onClose={() => {}}
      pendingTicketId={pendingTicketId}
      onTicketHandled={onTicketHandled}
      pendingSetup={pendingSetup}
      onSetupConsumed={onSetupConsumed}
      onCitationClick={onCitationClick}
    />
  );
}
