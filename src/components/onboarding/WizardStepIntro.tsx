import { Sparkles } from 'lucide-react';

export function WizardStepIntro() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[var(--foreground)]">
        <Sparkles size={18} />
        <h3 className="text-base font-semibold">Unleashed AI is ready for your team</h3>
      </div>
      <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
        <div>✦ Pre-configured with your NOC context — no API key needed</div>
        <div>✦ Summarize logs, detect anomalies, and classify entries automatically</div>
        <div>✦ Paste a Zendesk ticket to correlate it directly against your logs</div>
        <div>✦ Ask questions in plain English via the Chat tab</div>
        <div className="text-xs pt-1 opacity-70">Responses may take 15–30 seconds.</div>
      </div>
    </div>
  );
}
