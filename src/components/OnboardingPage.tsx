/**
 * AI Settings Onboarding Page — Soft gate walkthrough
 *
 * Shown on first run until user completes setup or skips. Multi-step walkthrough
 * with links and how-to's for setting up AI assistant features.
 *
 * @module components/OnboardingPage
 */

import { useState } from 'react';
import { Sparkles, Settings, CheckCircle2, ArrowRight, ArrowLeft, ExternalLink, ChevronRight } from 'lucide-react';
import { useAI } from '../contexts/AIContext';
import { AI_PROVIDERS, type AIProviderId } from '../types/ai';

const STORAGE_KEY = 'noclense_onboarding_completed';

export function getOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(completed: boolean): void {
  try {
    if (completed) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to persist onboarding state:', e);
  }
}

const TOTAL_STEPS = 4;

/** Provider-specific how-to instructions */
const PROVIDER_HOWTOS: Record<AIProviderId, { steps: string[]; linkText: string }> = {
  unleash: {
    steps: [
      'Contact your Carbyne IT admin to obtain your Unleashed AI bearer token',
      'Copy the token and paste it in AI Settings',
    ],
    linkText: 'Open Unleashed AI portal',
  },
  gemini: {
    steps: [
      'Go to ai.google.dev and sign in with your Google account',
      'Click "Get API key" and create a new key',
      'Copy the key and paste it in AI Settings',
    ],
    linkText: 'Get Gemini API key',
  },
  claude: {
    steps: [
      'Go to console.anthropic.com and sign up or log in',
      'Navigate to API Keys and create a new key',
      'Copy the key and paste it in AI Settings',
    ],
    linkText: 'Get Claude API key',
  },
  codex: {
    steps: [
      'Go to platform.openai.com and sign in',
      'Open API Keys and create a new secret key',
      'Copy the key and paste it in AI Settings',
    ],
    linkText: 'Get OpenAI API key',
  },
};

interface OnboardingPageProps {
  onOpenSettings: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingPage({ onOpenSettings, onComplete, onSkip }: OnboardingPageProps) {
  const { apiKeyConfigured, isEnabled } = useAI();
  const [step, setStep] = useState(1);
  const isReady = apiKeyConfigured && isEnabled;

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Progress */}
      <div className="shrink-0 px-6 pt-6">
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[var(--accent-blue)]' : 'bg-[var(--border-color)]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex items-start justify-center p-6 pb-12">
        <div className="max-w-xl w-full">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)]/20 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-[var(--accent-blue)]" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Get the most out of NocLense
              </h1>
              <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
              </p>
              <ul className="text-left w-full space-y-2 text-sm text-[var(--text-secondary)] mb-8">
                <li className="flex items-center gap-2">
                  <ChevronRight size={16} className="text-[var(--accent-blue)] flex-shrink-0" />
                  Ask questions about your logs in plain English
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight size={16} className="text-[var(--accent-blue)] flex-shrink-0" />
                  Get root-cause analysis and call-path explanations
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight size={16} className="text-[var(--accent-blue)] flex-shrink-0" />
                  Use Gemini, Claude, or OpenAI API keys
                </li>
              </ul>
            </div>
          )}

          {/* Step 2: Choose provider */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Choose an AI provider
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Pick one option. You can change it anytime in AI Settings.
              </p>
              <div className="space-y-2">
                {Object.values(AI_PROVIDERS).map((p) => (
                  <a
                    key={p.id}
                    href={p.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent-blue)]/50 hover:bg-[var(--bg-light)]/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{p.name}</span>
                      <ExternalLink size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)]" />
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{p.keyLabel}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: How to get API key */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                How to get your API key
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Each provider has a free tier. Follow the steps for your chosen provider.
              </p>
              <div className="space-y-4">
                {Object.entries(PROVIDER_HOWTOS).map(([id, { steps, linkText }]) => {
                  const provider = AI_PROVIDERS[id as AIProviderId];
                  return (
                    <div
                      key={id}
                      className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--surface)]"
                    >
                      <div className="font-medium text-sm mb-2">{provider.name}</div>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-[var(--text-secondary)] mb-3">
                        {steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                      <a
                        href={provider.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent-blue)] hover:underline inline-flex items-center gap-1"
                      >
                        {linkText}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Configure & finish */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                Configure and go
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Open AI Settings to add your API key, choose a model, and enable AI features.
              </p>
              <ul className="text-left w-full space-y-3 mb-6">
                <li className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  {apiKeyConfigured ? (
                    <CheckCircle2 className="w-5 h-5 text-mint flex-shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-[var(--border-color)] flex-shrink-0" />
                  )}
                  <span>API key configured</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  {isEnabled ? (
                    <CheckCircle2 className="w-5 h-5 text-mint flex-shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-[var(--border-color)] flex-shrink-0" />
                  )}
                  <span>AI features enabled</span>
                </li>
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col gap-3 mt-8">
            {step === 4 && (
              <>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-full px-4 py-3 rounded-lg bg-cyan text-ink-0 font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <Settings size={18} />
                  Open AI Settings
                </button>
                <button
                  type="button"
                  onClick={onComplete}
                  disabled={!isReady}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-primary)] font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue to app
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="w-full px-4 py-2.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Skip for now
                </button>
              </>
            )}
            {step < 4 && (
              <>
                <div className="flex gap-3">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className="px-4 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-primary)] font-medium flex items-center gap-2 hover:bg-[var(--bg-light)] transition-colors"
                    >
                      <ArrowLeft size={18} />
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-cyan text-ink-0 font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    {step === 3 ? 'Next: Configure' : 'Next'}
                    <ArrowRight size={18} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onSkip}
                  className="w-full px-4 py-2.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mt-2"
                >
                  Skip for now
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
