import type { AIProviderId } from '../../types/ai';

const PROVIDER_COPY: Record<AIProviderId, string> = {
  gemini: 'Free tier · gemini-3.1-flash-lite-preview',
  codex: 'Paid · GPT-4.1 Mini',
  claude: 'Paid · Claude Sonnet 4.6',
};

const PROVIDER_LABELS: Record<AIProviderId, string> = {
  gemini: 'Google Gemini',
  codex: 'ChatGPT (OpenAI)',
  claude: 'Claude (Anthropic)',
};

export function WizardStepProvider({
  provider,
  onSelect,
}: {
  provider: AIProviderId;
  onSelect: (provider: AIProviderId) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Choose your AI provider</h3>
      {(['gemini', 'codex', 'claude'] as AIProviderId[]).map((providerId) => (
        <button
          key={providerId}
          type="button"
          onClick={() => onSelect(providerId)}
          className={`w-full rounded-md border p-3 text-left ${provider === providerId ? 'border-[var(--ring)] bg-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--accent)]'}`}
        >
          <div className="text-sm font-medium text-[var(--foreground)]">{PROVIDER_LABELS[providerId]}</div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">{PROVIDER_COPY[providerId]}</div>
        </button>
      ))}
    </div>
  );
}
