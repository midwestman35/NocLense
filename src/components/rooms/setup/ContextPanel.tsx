import type { JSX } from 'react';
import { Clock3, Ticket } from 'lucide-react';
import type { ZendeskTicket } from '../../../services/zendeskService';
import { Badge, Card, CardContent, CardHeader, Input, Separator } from '../../ui';
import { TIMEZONE_OPTIONS } from '../../ai/diagnose/timezoneOptions';
import type { SetupContextDraft } from './setupRoomShared';

interface ContextPanelProps {
  context: SetupContextDraft;
  ticket: ZendeskTicket | null;
  onContextChange: (context: SetupContextDraft) => void;
}

export function ContextPanel({
  context,
  ticket,
  onContextChange,
}: ContextPanelProps): JSX.Element {
  const update = (patch: Partial<SetupContextDraft>) => {
    onContextChange({ ...context, ...patch });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="justify-between">
        <span className="flex items-center gap-2">
          <Ticket size={14} className="text-[var(--mint)]" />
          Investigation Context
        </span>
        <Badge variant={ticket ? 'level-info' : 'default'}>
          {ticket ? `#${ticket.id}` : 'Unlinked'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Ticket Number"
            value={context.ticketId}
            onChange={(event) => update({ ticketId: event.target.value.replace(/\D/g, '') })}
            placeholder="41637"
          />
          <Input
            label="Severity"
            value={context.severity}
            onChange={(event) => update({ severity: event.target.value })}
            placeholder="P2 audio impairment"
          />
          <Input
            label="Call Center Name"
            value={context.cnc}
            onChange={(event) => update({ cnc: event.target.value })}
            placeholder="us-wa-macc911-apex"
          />
          <label className="flex flex-col gap-[var(--space-1)]">
            <span className="text-[11px] font-[var(--font-weight-medium)] uppercase tracking-[0.08em] text-[var(--ink-2)]">
              Timezone
            </span>
            <select
              className="field h-9 text-[13px] text-[var(--ink-0)]"
              value={context.timezone}
              onChange={(event) => update({ timezone: event.target.value })}
            >
              {TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[11px] font-[var(--font-weight-medium)] uppercase tracking-[0.08em] text-[var(--ink-2)]">
            Notes
          </span>
          <textarea
            className="field min-h-20 resize-none text-[13px] text-[var(--ink-0)]"
            value={context.notes}
            onChange={(event) => update({ notes: event.target.value })}
            placeholder="Dispatch symptom, affected position, known call identifiers."
          />
        </label>

        {ticket && (
          <>
            <Separator />
            <div className="grid gap-2 text-[11px] text-[var(--ink-2)]">
              <p className="text-[13px] font-medium text-[var(--ink-0)]">{ticket.subject}</p>
              <p>{ticket.status} - {ticket.requesterName}{ticket.orgName ? ` - ${ticket.orgName}` : ''}</p>
              <p className="flex items-center gap-1.5">
                <Clock3 size={12} />
                {ticket.requesterTimezone ?? ticket.orgTimezone ?? context.timezone}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
