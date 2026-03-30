import { Sparkles } from 'lucide-react';

export function WizardStepIntro() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[var(--foreground)]">
        <Sparkles size={18} />
        <h3 className="text-base font-semibold">Unleashed AI is ready for your team</h3>
      </div>
      <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
        <div>✦ Pre-configured with your team's Confluence, Zendesk, and Slack context — no setup needed</div>
        <div>✦ Summarize logs, detect anomalies, and auto-classify entries with one click</div>
        <div>✦ <span className="text-[var(--foreground)] font-medium">Chat</span> — ask questions about your logs in plain English</div>
        <div>✦ <span className="text-[var(--foreground)] font-medium">Ticket</span> — fetch any Zendesk ticket and correlate it against your loaded logs</div>
        <div>✦ <span className="text-[var(--foreground)] font-medium">Diagnose</span> — AI pinpoints the exact log rows related to the issue (highlighted in violet), explains each one, and suggests additional log sources to check (Datadog, HOMER, Firewall, etc.)</div>
        <div>✦ Add AI-highlighted logs to your Case, post a diagnosis as a private Zendesk comment, or create a Jira escalation ticket — all from the Diagnose tab</div>
        <div className="text-xs pt-1 opacity-70">Responses may take 15–30 seconds.</div>
      </div>
    </div>
  );
}
