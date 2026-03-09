import { useEffect, useMemo, useState } from 'react';
import { Dialog, Button } from '../ui';
import { useAI } from '../../contexts/AIContext';
import type { AIProviderId } from '../../types/ai';
import { WizardStepIntro } from './WizardStepIntro';
import { WizardStepProvider } from './WizardStepProvider';
import { WizardStepApiKey } from './WizardStepApiKey';
import { WizardStepConsent } from './WizardStepConsent';
import { WizardStepDone } from './WizardStepDone';

const TITLES = ['Get set up', 'Choose provider', 'Add API key', 'Consent', 'Ready'];

export function AIOnboardingWizard({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const {
    provider: currentProvider,
    setProvider,
    setApiKey,
    setEnabled,
    consentToAI,
    hasConsentedToAI,
    setOnboardingCompleted,
  } = useAI();
  const [step, setStep] = useState(0);
  const [provider, setLocalProvider] = useState<AIProviderId>(currentProvider);
  const [apiKey, setApiKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setLocalProvider(currentProvider);
    setApiKeyValue('');
    setShowKey(false);
    setError(null);
    setDoneStatus(null);
  }, [currentProvider, open]);

  const footer = useMemo(() => {
    if (step === 0) {
      return (
        <>
          <Button variant="ghost" onClick={onClose}>Skip for now</Button>
          <Button onClick={() => setStep(1)}>Next</Button>
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
          <Button onClick={() => { setProvider(provider); setStep(2); }}>Next</Button>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
          <Button
            onClick={async () => {
              setError(null);
              setIsSavingKey(true);
              setProvider(provider);
              const ok = await setApiKey(apiKey);
              setIsSavingKey(false);
              if (ok) {
                setStep(3);
              } else {
                setError('That key could not be validated.');
              }
            }}
            disabled={!apiKey.trim() || isSavingKey}
          >
            {isSavingKey ? 'Saving...' : 'Next'}
          </Button>
        </>
      );
    }
    if (step === 3) {
      return (
        <>
          <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
          <Button onClick={() => { if (!hasConsentedToAI) consentToAI(); setStep(4); }}>I consent</Button>
        </>
      );
    }
    return (
      <>
        <Button
          variant="outline"
          onClick={async () => {
            setDoneStatus('Re-validating your saved connection...');
            setProvider(provider);
            const ok = await setApiKey(apiKey);
            setDoneStatus(ok ? 'Connection looks good.' : 'Connection test failed. Review your key in settings.');
          }}
          disabled={!apiKey.trim()}
        >
          Test connection
        </Button>
        <Button
          onClick={() => {
            setEnabled(true);
            setOnboardingCompleted(true);
            onComplete();
          }}
        >
          Open AI assistant
        </Button>
      </>
    );
  }, [apiKey, consentToAI, hasConsentedToAI, isSavingKey, onClose, onComplete, provider, setApiKey, setEnabled, setOnboardingCompleted, setProvider, step]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={TITLES[step] ?? 'AI setup'}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>{step + 1} / 5</span>
        </div>
        {step === 0 && <WizardStepIntro />}
        {step === 1 && <WizardStepProvider provider={provider} onSelect={setLocalProvider} />}
        {step === 2 && (
          <WizardStepApiKey
            provider={provider}
            apiKey={apiKey}
            onApiKeyChange={setApiKeyValue}
            showKey={showKey}
            onToggleShowKey={() => setShowKey((prev) => !prev)}
            error={error}
          />
        )}
        {step === 3 && <WizardStepConsent />}
        {step === 4 && <WizardStepDone status={doneStatus} />}
      </div>
    </Dialog>
  );
}
