import { useState, useCallback, useEffect } from 'react';
import { useAI } from '../contexts/AIContext';
import { Eye, EyeOff, ExternalLink, AlertTriangle, CheckCircle2, Loader2, Settings2 } from 'lucide-react';
import { getApiKeyStorageStatus } from '../store/apiKeyStorage';
import { AI_PROVIDERS, GEMINI_FREE_TIER_DAILY_LIMIT, getModelsForProvider, type AIConfig } from '../types/ai';

interface AISettingsPanelProps {
  onClose?: () => void;
}

export default function AISettingsPanel({ onClose }: AISettingsPanelProps) {
  const {
    isEnabled,
    apiKeyConfigured,
    provider,
    model,
    usageStats,
    dailyRequestLimit,
    error,
    setApiKey,
    setModel,
    setProvider,
    setEnabled,
    setDailyRequestLimit,
  } = useAI();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isElectronRuntime, setIsElectronRuntime] = useState(false);
  const [secureStorageAvailable, setSecureStorageAvailable] = useState(false);
  const providerInfo = AI_PROVIDERS[provider];
  const providerModels = getModelsForProvider(provider);

  useEffect(() => {
    let cancelled = false;
    const loadStorageStatus = async () => {
      const status = await getApiKeyStorageStatus();
      if (!cancelled) {
        setIsElectronRuntime(status.isElectron);
        setSecureStorageAvailable(status.secureStorageAvailable);
      }
    };
    void loadStorageStatus();
    return () => { cancelled = true; };
  }, []);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyInput(e.target.value);
    setValidationMessage(null);
  }, []);

  const usagePercentage = dailyRequestLimit > 0 ? Math.round((usageStats.requestsToday / dailyRequestLimit) * 100) : 0;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;

  const handleTestConnection = useCallback(async () => {
    if (!apiKeyInput.trim()) {
      setValidationMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setIsValidating(true);
    setValidationMessage(null);
    try {
      const isValid = await setApiKey(apiKeyInput.trim());
      if (isValid) {
        setValidationMessage({ type: 'success', text: 'API key validated successfully.' });
        setApiKeyInput('');
      } else {
        setValidationMessage({ type: 'error', text: `API key test failed for ${providerInfo.name}.` });
      }
    } catch (e) {
      console.error('API key validation error:', e);
      setValidationMessage({ type: 'error', text: 'Failed to validate API key. Please check your connection.' });
    } finally {
      setIsValidating(false);
    }
  }, [apiKeyInput, providerInfo.name, setApiKey]);

  const handleModelChange = useCallback((newModel: AIConfig['model']) => {
    setModel(newModel);
  }, [setModel]);

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!Number.isNaN(value) && value >= 1 && value <= GEMINI_FREE_TIER_DAILY_LIMIT) {
      setDailyRequestLimit(value);
    }
  }, [setDailyRequestLimit]);

  return (
    <div className="flex flex-col h-full bg-[var(--card)] text-[var(--foreground)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-[var(--muted-foreground)]" />
          <h2 className="text-sm font-semibold">AI Settings</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Close settings">
            x
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section>
          <h3 className="text-[11px] font-semibold mb-2 uppercase tracking-[0.16em] text-[var(--muted-foreground)]">API Configuration</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="api-key" className="block text-xs text-[var(--muted-foreground)] mb-1">{providerInfo.keyLabel}</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={handleApiKeyChange}
                    placeholder={apiKeyConfigured ? 'API key configured' : 'Enter your API key'}
                    className="w-full px-3 py-2 bg-[var(--accent)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    disabled={isValidating}
                    aria-label="API key input"
                  />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button onClick={handleTestConnection} disabled={isValidating || !apiKeyInput.trim()} className="px-4 py-2 bg-[var(--foreground)] text-[var(--background)] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isValidating ? <><Loader2 size={16} className="animate-spin" />Testing...</> : 'Test & Save'}
                </button>
              </div>
              {validationMessage && (
                <div className={`mt-2 flex items-start gap-2 text-xs ${validationMessage.type === 'success' ? 'text-[var(--success)]' : 'text-[var(--destructive)]'}`}>
                  {validationMessage.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <span>{validationMessage.text}</span>
                    {validationMessage.type === 'error' && (
                      <a href={providerInfo.helpUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-[var(--foreground)] hover:underline inline-flex items-center gap-0.5">
                        Get key
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-2 text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                <a href={providerInfo.helpUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] inline-flex items-center gap-1">
                  Get API key for {providerInfo.name}
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="p-3 border border-[var(--border)] bg-[var(--accent)] text-xs text-[var(--muted-foreground)]">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold mb-1 text-[var(--foreground)]">Storage</div>
                  <div>
                    {secureStorageAvailable
                      ? 'API keys are stored using Electron secure storage tied to your OS credentials.'
                      : isElectronRuntime
                        ? 'Secure storage is unavailable on this system, so API keys fall back to browser localStorage.'
                        : 'API keys are stored in browser localStorage. For production use, run the Electron build to use secure storage.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold mb-2 uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Provider Selection</h3>
          <div className="space-y-2">
            {Object.values(AI_PROVIDERS).map((providerOption) => (
              <label key={providerOption.id} className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${provider === providerOption.id ? 'border-[var(--ring)] bg-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--accent)]'}`}>
                <input type="radio" name="provider" value={providerOption.id} checked={provider === providerOption.id} onChange={() => setProvider(providerOption.id)} className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{providerOption.name}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold mb-2 uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Model Selection</h3>
          <div className="space-y-2">
            {providerModels.map((modelInfo) => (
              <label key={modelInfo.id} className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${model === modelInfo.id ? 'border-[var(--ring)] bg-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--accent)]'}`}>
                <input type="radio" name="model" value={modelInfo.id} checked={model === modelInfo.id} onChange={() => handleModelChange(modelInfo.id)} className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{modelInfo.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{modelInfo.description}</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">Speed: {modelInfo.speed} | Quality: {modelInfo.quality}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold mb-2 uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Usage Statistics</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--muted-foreground)]">Requests Today</span>
                <span className={`font-medium ${isAtLimit ? 'text-[var(--destructive)]' : isNearLimit ? 'text-[var(--warning)]' : 'text-[var(--foreground)]'}`}>{usageStats.requestsToday} / {dailyRequestLimit}</span>
              </div>
              <div className="w-full h-2 bg-[var(--accent)] overflow-hidden">
                <div className={`${isAtLimit ? 'bg-[var(--destructive)]' : isNearLimit ? 'bg-[var(--warning)]' : 'bg-[var(--foreground)]'} h-full`} style={{ width: `${Math.min(usagePercentage, 100)}%` }} />
              </div>
              {isNearLimit && !isAtLimit && <div className="text-xs text-[var(--warning)] mt-1">Approaching daily limit.</div>}
              {isAtLimit && <div className="text-xs text-[var(--destructive)] mt-1">Daily limit reached. Requests resume tomorrow at midnight UTC.</div>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[var(--muted-foreground)]">Total Tokens Used</div>
                <div className="text-[var(--foreground)] font-medium mt-0.5">{usageStats.totalTokensUsed.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[var(--muted-foreground)]">Daily Limit</div>
                <input type="number" min="1" max={GEMINI_FREE_TIER_DAILY_LIMIT} value={dailyRequestLimit} onChange={handleLimitChange} className="w-20 mt-0.5 px-2 py-1 bg-[var(--accent)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold mb-2 uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Privacy & Control</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isEnabled} onChange={(e) => setEnabled(e.target.checked)} disabled={!apiKeyConfigured} className="w-4 h-4" />
              <div className="flex-1">
                <div className="text-sm font-medium">Enable AI Features</div>
                <div className="text-xs text-[var(--muted-foreground)]">{apiKeyConfigured ? 'AI features will be available throughout the application.' : 'Configure an API key first to enable AI features.'}</div>
              </div>
            </label>
            <div className="p-3 border border-[var(--border)] bg-[var(--accent)] text-xs text-[var(--muted-foreground)]">
              Selected log data is sent only when you explicitly ask for AI analysis. Provider processing follows {providerInfo.privacyNoticeName} policy.
            </div>
          </div>
        </section>

        {error && (
          <div className="p-3 border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-xs text-[var(--destructive)]">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
