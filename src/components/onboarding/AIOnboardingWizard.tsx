import { useEffect, useMemo, useState } from 'react';
import { Dialog, Button } from '../ui';
import { useAI } from '../../contexts/AIContext';
import { WizardStepIntro } from './WizardStepIntro';
import { WizardStepConsent } from './WizardStepConsent';
import { WizardStepDone } from './WizardStepDone';

const TITLES = ['Get started', 'Privacy & consent', 'Ready'];

export function AIOnboardingWizard({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { setEnabled, consentToAI, hasConsentedToAI, setOnboardingCompleted } = useAI();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

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
          <Button onClick={() => { if (!hasConsentedToAI) consentToAI(); setStep(2); }}>I consent</Button>
        </>
      );
    }
    return (
      <Button
        onClick={() => {
          setEnabled(true);
          setOnboardingCompleted(true);
          onComplete();
        }}
      >
        Open AI assistant
      </Button>
    );
  }, [consentToAI, hasConsentedToAI, onClose, onComplete, setEnabled, setOnboardingCompleted, step]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={TITLES[step] ?? 'AI setup'}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>{step + 1} / 3</span>
        </div>
        {step === 0 && <WizardStepIntro />}
        {step === 1 && <WizardStepConsent />}
        {step === 2 && <WizardStepDone />}
      </div>
    </Dialog>
  );
}
