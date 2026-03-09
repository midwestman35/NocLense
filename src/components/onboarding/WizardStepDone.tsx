import { CheckCircle } from 'lucide-react';

export function WizardStepDone({
  status,
}: {
  status?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[var(--foreground)]">
        <CheckCircle size={18} className="text-[var(--success)]" />
        <h3 className="text-sm font-medium">You're set up</h3>
      </div>
      <div className="text-sm text-[var(--muted-foreground)]">AI analysis is ready.</div>
      {status ? <div className="text-xs text-[var(--muted-foreground)]">{status}</div> : null}
    </div>
  );
}
