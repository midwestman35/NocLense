import { useState, type JSX } from 'react';
import { AuthScreen } from '../auth/AuthScreen';
import { Ambient, Badge, Button, Card, CardContent, CardHeader, Icon, MacWindow } from '../ui';

type Surface = 'auth' | 'dashboard';

export function AppSurface(): JSX.Element {
  const [surface, setSurface] = useState<Surface>('auth');

  if (surface === 'auth') {
    return <AuthScreen onSuccess={() => setSurface('dashboard')} />;
  }

  return <DashboardPlaceholder onReset={() => setSurface('auth')} />;
}

function DashboardPlaceholder({ onReset }: { onReset: () => void }): JSX.Element {
  return (
    <MacWindow
      title="NocLense · Dashboard"
      right={
        <>
          <span className="mono">07D pending</span>
          <span aria-hidden="true" className="text-[var(--ink-3)]">·</span>
          <span className="mono text-[var(--mint)]">auth handoff complete</span>
        </>
      }
    >
      <Ambient>
        <div className="flex h-full items-center justify-center px-6 py-8 sm:px-8 xl:px-12">
          <Card
            variant="elevated"
            className="w-full max-w-4xl border-[var(--line-2)] bg-[linear-gradient(180deg,rgba(18,24,20,0.92),rgba(10,13,18,0.86))]"
            data-testid="dashboard-placeholder"
          >
            <CardHeader className="justify-between">
              <div className="space-y-1">
                <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--mint)]">Authenticated</p>
                <h2 className="text-xl font-medium tracking-[-0.02em] text-[var(--ink-0)]">Dashboard coming in 07D</h2>
              </div>
              <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.14em]">
                Batch C
              </Badge>
            </CardHeader>

            <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:p-8">
              <div className="space-y-4">
                <p className="max-w-[52ch] text-sm leading-6 text-[var(--ink-2)]">
                  Slice 07C.1 only establishes the auth handoff. The real dashboard surface will replace this
                  checkpoint in 07D and wire into the existing case repository and case library services.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PlaceholderMetric
                    icon="ticket"
                    label="Cases"
                    value="07D"
                    detail="Repository wiring lands next."
                  />
                  <PlaceholderMetric
                    icon="db"
                    label="Signals"
                    value="Live"
                    detail="Investigate room remains intact until later slices."
                  />
                  <PlaceholderMetric
                    icon="activity"
                    label="Status"
                    value="Stub"
                    detail="Auth success now resolves after 500ms."
                  />
                </div>
              </div>

              <div className="glass rounded-[var(--radius-panel)] border border-[var(--line)] p-5">
                <div className="flex items-center gap-2">
                  <Icon name="shield" size={14} />
                  <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-2)]">Next slice</p>
                </div>
                <h3 className="mt-3 text-lg font-medium tracking-[-0.02em] text-[var(--ink-0)]">
                  Replace this placeholder with the editorial dashboard
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
                  Auth now has a dedicated entry surface. The next commit swaps this holding card for the shipped
                  dashboard layout and real data wiring.
                </p>
                <Button type="button" variant="ghost" className="mt-6 w-full justify-center" onClick={onReset}>
                  <Icon name="arrowRight" size={14} />
                  Return to auth
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Ambient>
    </MacWindow>
  );
}

function PlaceholderMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: 'ticket' | 'db' | 'activity';
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="glass rounded-[var(--radius-input)] border border-[var(--line)] p-4">
      <div className="flex items-center gap-2 text-[var(--ink-2)]">
        <Icon name={icon} size={14} />
        <span className="mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-[var(--ink-0)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--ink-3)]">{detail}</p>
    </div>
  );
}
