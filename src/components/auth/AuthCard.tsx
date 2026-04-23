import type { FormEventHandler, JSX } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, Icon, Input } from '../ui';

interface AuthCardProps {
  email: string;
  password: string;
  isAuthenticating: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function AuthCard({
  email,
  password,
  isAuthenticating,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthCardProps): JSX.Element {
  return (
    <Card
      variant="elevated"
      className="border-[var(--line-2)] bg-[linear-gradient(180deg,rgba(18,24,20,0.9),rgba(10,13,18,0.84))] shadow-[0_32px_100px_-56px_rgba(0,0,0,0.95),0_0_72px_-40px_rgba(142,240,183,0.28)]"
    >
      <CardHeader className="items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Step 1 of 1</p>
          <div>
            <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--ink-0)]">Sign in to continue</h2>
            <p className="mt-2 max-w-[34ch] text-[13.5px] leading-6 text-[var(--ink-2)]">
              Org SSO is stubbed for Batch C. Any values resolve to an authenticated session after 500ms.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.12em]">
          Stub flow
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="operator@carbyne.com"
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Use your org password"
            autoComplete="current-password"
          />

          <Button type="submit" size="lg" className="w-full justify-center" disabled={isAuthenticating}>
            <Icon name={isAuthenticating ? 'activity' : 'shield'} size={14} />
            {isAuthenticating ? 'Signing in…' : 'Continue with SSO'}
          </Button>
        </form>

        <div className="rounded-[var(--radius-input)] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4">
          <div className="flex items-center gap-2 text-[var(--ink-2)]">
            <Icon name="lock" size={13} />
            <p className="mono text-[10px] uppercase tracking-[0.16em]">Credential boundary</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            End-user login is not written to the keyring in this slice. The local keychain remains reserved for
            vendor credentials such as Zendesk, Datadog, and Unleashed AI.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--ink-3)]">
          <span aria-live="polite">{isAuthenticating ? 'Resolving authenticated session…' : 'Awaiting operator identity.'}</span>
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--mint)]">500ms</span>
        </div>
      </CardContent>
    </Card>
  );
}
