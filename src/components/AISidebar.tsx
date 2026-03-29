import AiPanel from './ai/AiPanel';

export function AISidebar({ onSetupAI: _onSetupAI }: { onSetupAI?: () => void }) {
  // Rendered inside the fixed right sidebar — no close button needed
  return <AiPanel onClose={() => {}} />;
}
