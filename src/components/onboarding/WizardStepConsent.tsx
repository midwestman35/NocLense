export function WizardStepConsent() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Review privacy and consent</h3>
      <div className="grid gap-3 md:grid-cols-2 text-xs">
        <div className="border border-[var(--border)] p-3 bg-[var(--accent)]">
          <div className="font-medium text-[var(--foreground)] mb-2">What we send</div>
          <div className="space-y-1 text-[var(--muted-foreground)]">
            <div>Selected log messages, timestamps, and levels</div>
            <div>Relevant component names and correlation IDs</div>
            <div>Your question or analysis request</div>
          </div>
        </div>
        <div className="border border-[var(--border)] p-3 bg-[var(--accent)]">
          <div className="font-medium text-[var(--foreground)] mb-2">What we do not send</div>
          <div className="space-y-1 text-[var(--muted-foreground)]">
            <div>Your API key</div>
            <div>Logs you did not explicitly analyze</div>
            <div>Any NocLense server-side copy of your dataset</div>
          </div>
        </div>
      </div>
    </div>
  );
}
