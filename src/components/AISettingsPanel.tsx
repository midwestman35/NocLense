/**
 * AI Settings Panel Component
 * 
 * Purpose:
 * Provides a user interface for configuring AI features including API key management,
 * model selection, usage statistics, and privacy controls.
 * 
 * Architecture Decision:
 * Separate settings panel component keeps configuration UI isolated and reusable.
 * This component integrates with AIContext for state management and provides
 * real-time validation and feedback.
 * 
 * Key Features:
 * - API key input with show/hide toggle (password field for security)
 * - Model selection (Flash vs Pro for speed/quality trade-offs)
 * - Enable/disable toggle (privacy control)
 * - Usage statistics display (requests today, percentage of limit)
 * - Test connection button (validates API key before saving)
 * - Privacy notice (transparency about data being sent to Google)
 * - Security warnings (localStorage limitations)
 * 
 * Why Password Field for API Key?
 * - Prevents accidental exposure when screen sharing or recording
 * - Standard security practice for sensitive credentials
 * - Users can toggle visibility when needed
 * 
 * Why Real-time Validation?
 * - Prevents saving invalid keys that would fail later
 * - Provides immediate feedback during setup
 * - Reduces user frustration from configuration errors
 * 
 * Security Considerations:
 * - API key stored in localStorage (not fully secure, visible in dev tools)
 * - Security warning displayed to users
 * - Future: Use Electron secure storage (electron-store) for production builds
 * - API key never logged to console
 * 
 * Dependencies:
 * - AIContext: Provides AI state and actions
 * - lucide-react: Icons for UI elements
 * - Tailwind CSS: Styling (consistent with existing components)
 * 
 * @module components/AISettingsPanel
 */

import { useState, useCallback } from 'react';
import { useAI } from '../contexts/AIContext';
import { Eye, EyeOff, ExternalLink, AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import {
  AI_PROVIDERS,
  GEMINI_FREE_TIER_DAILY_LIMIT,
  getModelsForProvider,
  type AIConfig,
} from '../types/ai';

interface AISettingsPanelProps {
  /** Callback when panel should be closed */
  onClose?: () => void;
}

/**
 * AI Settings Panel Component
 * 
 * Why this component structure?
 * - Self-contained settings UI that can be used in modal or sidebar
 * - Clear sections for different configuration areas
 * - Real-time validation and feedback
 * - Accessible with proper ARIA labels and keyboard navigation
 */
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

  // Local state for API key input
  // Why: Separate from context to allow editing before saving
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const providerInfo = AI_PROVIDERS[provider];
  const providerModels = getModelsForProvider(provider);

  // Phase 6.2: Clear validation message when user starts typing (better feedback loop)
  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyInput(e.target.value);
    setValidationMessage(null);
  }, []);

  // Calculate usage percentage
  // Why: Visual indicator helps users understand quota consumption
  const usagePercentage = dailyRequestLimit > 0 
    ? Math.round((usageStats.requestsToday / dailyRequestLimit) * 100) 
    : 0;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;

  /**
   * Handle API key validation and saving
   * 
   * Why: Validates API key before saving to prevent user frustration
   * Shows clear success/error messages during validation
   */
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
        setValidationMessage({ type: 'success', text: 'API key validated successfully!' });
        setApiKeyInput(''); // Clear input after successful save
      } else {
        // Why: setApiKey() can fail for reasons beyond invalid credentials.
        // Keep this message generic; details are shown in the context error panel.
        setValidationMessage({
          type: 'error',
          text: `API key test failed for ${providerInfo.name}. Review details below and try again.`,
        });
      }
    } catch (e) {
      console.error('API key validation error:', e);
      setValidationMessage({ type: 'error', text: 'Failed to validate API key. Please check your connection.' });
    } finally {
      setIsValidating(false);
    }
  }, [apiKeyInput, providerInfo.name, setApiKey]);

  /**
   * Handle model selection change
   * 
   * Why: Allows users to choose between speed (Flash) and quality (Pro)
   */
  const handleModelChange = useCallback((newModel: AIConfig['model']) => {
    setModel(newModel);
  }, [setModel]);

  /**
   * Handle daily limit change
   * 
   * Why: Allows users to set lower limit than free tier for budget control
   */
  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= GEMINI_FREE_TIER_DAILY_LIMIT) {
      setDailyRequestLimit(value);
    }
  }, [setDailyRequestLimit]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-[var(--accent-blue)]" />
          <h2 className="text-lg font-semibold">AI Settings</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close settings"
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* API Key Section */}
        <section>
          <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">API Configuration</h3>
          
          <div className="space-y-3">
            <div>
              <label htmlFor="api-key" className="block text-xs text-[var(--text-secondary)] mb-1">
                {providerInfo.keyLabel}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={handleApiKeyChange}
                    placeholder={apiKeyConfigured ? 'API key configured' : 'Enter your API key'}
                    className="w-full px-3 py-2 bg-[var(--bg-light)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent"
                    disabled={isValidating}
                    aria-label="API key input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={isValidating || !apiKeyInput.trim()}
                  className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded text-sm font-medium hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test & Save'
                  )}
                </button>
              </div>
              
              {/* Validation message - Phase 6: Clear, actionable per .cursorrules */}
              {validationMessage && (
                <div className={`mt-2 flex items-start gap-2 text-xs ${
                  validationMessage.type === 'success' 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {validationMessage.type === 'success' ? (
                    <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span>{validationMessage.text}</span>
                    {validationMessage.type === 'error' && (
                      <a
                        href={providerInfo.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-[var(--accent-blue)] hover:underline inline-flex items-center gap-0.5"
                      >
                        Get {providerInfo.name} key
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Get API key link */}
              <div className="mt-2">
                <a
                  href={providerInfo.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1"
                >
                  Get API key for {providerInfo.name}
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Security warning */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold mb-1">Security Notice</div>
                  <div className="text-amber-200/80">
                    API keys are stored in browser localStorage (not fully secure). 
                    For production use, consider using Electron secure storage. 
                    Never share your API key or commit it to version control.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Provider Selection Section */}
        <section>
          <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">Provider Selection</h3>
          <div className="space-y-2">
            {Object.values(AI_PROVIDERS).map((providerOption) => (
              <label
                key={providerOption.id}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  provider === providerOption.id
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                    : 'border-[var(--border-color)] hover:bg-[var(--bg-light)]'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={providerOption.id}
                  checked={provider === providerOption.id}
                  onChange={() => setProvider(providerOption.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{providerOption.name}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Model Selection Section */}
        <section>
          <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">Model Selection</h3>
          <div className="space-y-2">
            {providerModels.map((modelInfo) => (
              <label
                key={modelInfo.id}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  model === modelInfo.id
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                    : 'border-[var(--border-color)] hover:bg-[var(--bg-light)]'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={modelInfo.id}
                  checked={model === modelInfo.id}
                  onChange={() => handleModelChange(modelInfo.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{modelInfo.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {modelInfo.description}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-1">
                    Speed: {modelInfo.speed} · Quality: {modelInfo.quality}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Usage Statistics Section */}
        <section>
          <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">Usage Statistics</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">Requests Today</span>
                <span className={`font-medium ${
                  isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-[var(--text-primary)]'
                }`}>
                  {usageStats.requestsToday} / {dailyRequestLimit}
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-light)] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-[var(--accent-blue)]'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              {isNearLimit && !isAtLimit && (
                <div className="text-xs text-amber-400 mt-1">
                  Approaching daily limit. Consider reducing usage or waiting until tomorrow.
                </div>
              )}
              {isAtLimit && (
                <div className="text-xs text-red-400 mt-1">
                  Daily limit reached. Requests will resume tomorrow at midnight UTC.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[var(--text-secondary)]">Total Tokens Used</div>
                <div className="text-[var(--text-primary)] font-medium mt-0.5">
                  {usageStats.totalTokensUsed.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[var(--text-secondary)]">Daily Limit</div>
                <div className="text-[var(--text-primary)] font-medium mt-0.5">
                  <input
                    type="number"
                    min="1"
                    max={GEMINI_FREE_TIER_DAILY_LIMIT}
                    value={dailyRequestLimit}
                    onChange={handleLimitChange}
                    className="w-20 px-2 py-1 bg-[var(--bg-light)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Enable/Disable Section */}
        <section>
          <h3 className="text-sm font-semibold mb-2 text-[var(--text-primary)]">Privacy & Control</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!apiKeyConfigured}
                className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)] disabled:opacity-50"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Enable AI Features</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {apiKeyConfigured 
                    ? 'AI features will be available throughout the application'
                    : 'Configure API key first to enable AI features'}
                </div>
              </div>
            </label>

            {/* Privacy notice */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-200">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold mb-1">Privacy Notice</div>
                  <div className="text-blue-200/80">
                    When you use AI features, selected log data is sent to the configured provider for analysis.
                    Only the logs you explicitly analyze are sent. Provider processing and retention follow {providerInfo.name} policy.
                    You can disable AI features at any time.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
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
