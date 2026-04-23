import { useCallback, useEffect, useRef, useState, type FormEventHandler, type JSX } from 'react';
import type { AuthFeedItem } from './AuthStatusFeed';
import { AuthCard } from './AuthCard';
import { AuthStatusFeed } from './AuthStatusFeed';
import { Ambient, Badge, Icon, MacWindow, Spark } from '../ui';

interface AuthScreenProps {
  onSuccess: () => void;
}

const FEED_ITEMS: AuthFeedItem[] = [
  {
    timestamp: '02:14:38',
    kind: 'datadog',
    message: 'us-wa-macc911-apex · 2.3k events/min',
    tone: 'mint',
  },
  {
    timestamp: '02:14:31',
    kind: 'ticket',
    message: '#41637 · Dispatch 4 · cannot hear caller',
    tone: 'amber',
  },
  {
    timestamp: '02:14:22',
    kind: 'memory',
    message: '7 similar tickets indexed to Confluence',
    tone: 'ink',
  },
  {
    timestamp: '02:14:07',
    kind: 'unleash',
    message: 'Unleashed AI · ready (tokens: 12k / 128k)',
    tone: 'violet',
  },
  {
    timestamp: '02:13:51',
    kind: 'zendesk',
    message: 'queue · 14 open · 3 high priority',
    tone: 'mint',
  },
];

export function AuthScreen({ onSuccess }: AuthScreenProps): JSX.Element {
  const [email, setEmail] = useState('operator@carbyne.com');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (authTimeoutRef.current !== null) {
        window.clearTimeout(authTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>((event) => {
    event.preventDefault();

    if (isAuthenticating) {
      return;
    }

    setIsAuthenticating(true);
    authTimeoutRef.current = window.setTimeout(() => {
      setIsAuthenticating(false);
      onSuccess();
    }, 500);
  }, [isAuthenticating, onSuccess]);

  return (
    <MacWindow
      title="NocLense · Sign in"
      right={
        <>
          <span className="mono">v4.2.0</span>
          <span aria-hidden="true">·</span>
          <span className="mono text-[var(--mint)]">all systems nominal</span>
        </>
      }
    >
      <Ambient>
        <div className="grid h-full grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,1fr)]">
          <section className="flex flex-col justify-between border-b border-[var(--line)] px-6 py-8 sm:px-8 xl:border-b-0 xl:border-r xl:px-14 xl:py-14">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[rgba(142,240,183,0.28)] bg-[linear-gradient(160deg,#1f5a3f,#0a1e15)] shadow-[0_4px_20px_-4px_rgba(142,240,183,0.3)]">
                <Icon name="radar" size={20} className="text-[var(--mint)]" />
              </div>
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-2)]">NocLense · Standalone</p>
                <p className="text-sm text-[var(--ink-3)]">Desktop investigation workspace</p>
              </div>
            </div>

            <div className="space-y-8 py-8 xl:py-12">
              <div className="flex items-center gap-3">
                <span className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--mint)]">001</span>
                <span className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Authenticate</span>
              </div>

              <div className="max-w-2xl space-y-5">
                <h1 className="text-4xl font-normal leading-none tracking-[-0.04em] text-[var(--ink-0)] sm:text-5xl xl:text-[60px]">
                  Make the <span className="font-serif italic text-[var(--mint)]">signal</span>
                  <br />
                  louder than the <span className="font-serif italic text-[var(--ink-1)]">noise</span>.
                </h1>
                <p className="max-w-[34rem] text-[15px] leading-7 text-[var(--ink-2)]">
                  A workspace for NOC engineers. Correlate logs, ticket context, and AI assistance without leaving the
                  room. Batch C starts by restoring a dedicated auth surface ahead of the dashboard and room ports.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="rounded-[var(--radius-panel)] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Signal health</p>
                      <p className="mt-2 text-sm text-[var(--ink-1)]">Ops telemetry remains live while auth resolves.</p>
                    </div>
                    <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.12em]">
                      Stub auth
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <Spark
                      data={[3, 6, 4, 7, 9, 8, 11, 10, 12, 11, 13, 12, 14]}
                      color="var(--mint)"
                      w={320}
                      h={44}
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <Badge className="justify-center mono px-3 py-2 text-[10px] uppercase tracking-[0.12em]">
                    Zendesk ready
                  </Badge>
                  <Badge variant="outline" className="justify-center mono px-3 py-2 text-[10px] uppercase tracking-[0.12em]">
                    Unleashed queued
                  </Badge>
                </div>
              </div>
            </div>

            <AuthStatusFeed items={FEED_ITEMS} />
          </section>

          <section className="relative flex items-center justify-center px-6 py-8 sm:px-8 xl:px-14">
            <div className="absolute right-10 top-8 hidden items-center gap-2 text-[11px] text-[var(--ink-3)] xl:flex">
              <span className="mono uppercase tracking-[0.14em]">Need an account?</span>
              <span className="border-b border-[var(--line-2)] text-[var(--ink-1)]">Ask your NOC lead</span>
            </div>

            <div className="w-full max-w-md">
              <AuthCard
                email={email}
                password={password}
                isAuthenticating={isAuthenticating}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={handleSubmit}
              />
            </div>
          </section>
        </div>
      </Ambient>
    </MacWindow>
  );
}
