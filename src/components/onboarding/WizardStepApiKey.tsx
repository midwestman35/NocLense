import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Input } from '../ui';
import type { AIProviderId } from '../../types/ai';

const KEY_LINKS: Record<AIProviderId, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  codex: 'https://platform.openai.com/api-keys',
  claude: 'https://console.anthropic.com/settings/keys',
};

const LABELS: Record<AIProviderId, string> = {
  gemini: 'Google Gemini',
  codex: 'ChatGPT (OpenAI)',
  claude: 'Claude',
};

export function WizardStepApiKey({
  provider,
  apiKey,
  onApiKeyChange,
  showKey,
  onToggleShowKey,
  error,
}: {
  provider: AIProviderId;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  showKey: boolean;
  onToggleShowKey: () => void;
  error?: string | null;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Enter your {LABELS[provider]} API key</h3>
      <div className="relative">
        <Input value={apiKey} onChange={(e) => onApiKeyChange(e.target.value)} type={showKey ? 'text' : 'password'} placeholder="Paste API key" />
        <button type="button" onClick={onToggleShowKey} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label={showKey ? 'Hide API key' : 'Show API key'}>
          {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <a href={KEY_LINKS[provider]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        Get your key
        <ExternalLink size={12} />
      </a>
      <div className="text-xs text-[var(--muted-foreground)]">Stored locally. Never sent to NocLense servers.</div>
      {error ? <div className="text-xs text-[var(--destructive)]">{error}</div> : null}
    </div>
  );
}
