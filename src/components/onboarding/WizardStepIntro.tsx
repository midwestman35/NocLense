import { Sparkles } from 'lucide-react';

export function WizardStepIntro() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[var(--foreground)]">
        <Sparkles size={18} />
        <h3 className="text-base font-semibold">Get the most out of NocLense</h3>
      </div>
      <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
        <div>› Ask questions about your logs in plain English</div>
        <div>› Get root-cause analysis and call-path explanations</div>
        <div>› Use Gemini (free) or ChatGPT / Claude (paid)</div>
      </div>
    </div>
  );
}
