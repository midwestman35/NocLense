import { useMemo, useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import { TuiSpinner } from '../../loading/TuiSpinner';
import { extractZendeskTicketId } from './ticketInput';

interface InvestigateUrlEntryProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (ticketId: string) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export default function InvestigateUrlEntry({
  value,
  onChange,
  onSubmit,
  loading = false,
  error = null,
  disabled = false,
}: InvestigateUrlEntryProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const resolvedError = useMemo(() => localError ?? error, [error, localError]);

  function handleSubmit() {
    const ticketId = extractZendeskTicketId(value);
    if (!ticketId) {
      setLocalError('Enter a Zendesk ticket URL or numeric ticket ID.');
      return;
    }

    setLocalError(null);
    onSubmit(ticketId);
  }

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-3"
      data-testid="investigate-url-entry"
    >
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-medium text-[var(--foreground)]">Investigate from Zendesk</p>
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Paste a ticket URL or enter the ticket number to load the case context.
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(event) => {
            setLocalError(null);
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }
          }}
          label="Zendesk ticket URL or ID"
          placeholder="https://example.zendesk.com/agent/tickets/12345"
          icon={<Link2 size={14} />}
          variant="search"
          className="h-10 text-[12px]"
          wrapperClassName="flex-1 gap-1.5"
          disabled={disabled || loading}
        />
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={handleSubmit}
          disabled={disabled || loading || !value.trim()}
          className="h-10 min-w-[8rem] gap-2 self-end text-[12px]"
          aria-label="Investigate ticket"
        >
          {loading ? (
            <>
              <TuiSpinner decorative kind="dots" className="text-[var(--muted-foreground)]" />
              Resolving
            </>
          ) : (
            <>
              Investigate
              <ArrowRight size={14} />
            </>
          )}
        </Button>
      </div>

      {loading && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
          <TuiSpinner kind="dots" label="Resolving Zendesk ticket" />
          Fetching ticket context
        </div>
      )}

      {resolvedError && (
        <p className="mt-2 text-[11px] text-[var(--destructive)]" role="alert">
          {resolvedError}
        </p>
      )}
    </div>
  );
}
