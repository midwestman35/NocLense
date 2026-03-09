import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronRight, FileSearch, PackageCheck } from 'lucide-react';
import { Button, Dialog } from '../ui';

const STEPS = [
  {
    title: 'Build the case first',
    icon: Briefcase,
    bullets: [
      'Open the Case panel from the left rail to create or select the incident you are working.',
      'Keep the incident reference, severity, owner, and time window attached to the same investigation.',
      'NocLense now saves your working state with the case so it is easier to resume later.',
    ],
  },
  {
    title: 'Capture evidence while you correlate',
    icon: FileSearch,
    bullets: [
      'Import APEX or Datadog files, or paste AWS Console and CloudWatch logs into the same workspace.',
      'Use the log details drawer to add evidence, notes, tags, and copyable citations as you narrow the issue.',
      'Imported datasets now retain provenance so you can explain where each signal came from.',
    ],
  },
  {
    title: 'Hand off with less cleanup',
    icon: PackageCheck,
    bullets: [
      'Export an Evidence Pack when you are ready to bring findings to the owning stakeholder.',
      'The pack includes case context, evidence, events, follow-up queries, and provenance in one place.',
      'Use AI as optional support, not a requirement, for the core investigation flow.',
    ],
  },
] as const;

export function ProductUpdateWizard({
  open,
  onClose,
  onOpenCasePanel,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCasePanel: () => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
  }, [open]);

  const currentStep = useMemo(() => STEPS[step] ?? STEPS[0], [step]);
  const StepIcon = currentStep.icon;

  const footer = useMemo(() => {
    if (step === 0) {
      return (
        <>
          <Button variant="ghost" onClick={onClose}>Skip for now</Button>
          <Button onClick={() => setStep(1)}>Next</Button>
        </>
      );
    }

    if (step < STEPS.length - 1) {
      return (
        <>
          <Button variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</Button>
          <Button onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>Next</Button>
        </>
      );
    }

    return (
      <>
        <Button variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</Button>
        <Button
          onClick={() => {
            onOpenCasePanel();
            onClose();
          }}
        >
          Open case panel
        </Button>
      </>
    );
  }, [onClose, onOpenCasePanel, step]);

  return (
    <Dialog open={open} onClose={onClose} title="What is new in v2.0" footer={footer}>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>{step + 1} / {STEPS.length}</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[var(--foreground)]">
            <StepIcon size={18} />
            <h3 className="text-base font-semibold">{currentStep.title}</h3>
          </div>

          <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
            {currentStep.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-[var(--green-house-300)]" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
