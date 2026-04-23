import { useMemo, type JSX } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import type { ZendeskTicket } from '../../../services/zendeskService';
import { Badge, Button, Card, CardContent, CardHeader } from '../../ui';
import type { AttachmentSelection } from './setupRoomShared';

interface AttachmentPanelProps {
  ticket: ZendeskTicket | null;
  loading: boolean;
  selections: AttachmentSelection[];
  onToggle: (id: number) => void;
  onRefresh: () => void;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({
  ticket,
  loading,
  selections,
  onToggle,
  onRefresh,
}: AttachmentPanelProps): JSX.Element {
  const selectedCount = useMemo(
    () => selections.filter((selection) => selection.selected).length,
    [selections],
  );
  const selectionById = useMemo(
    () => new Map(selections.map((selection) => [selection.id, selection.selected])),
    [selections],
  );

  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="justify-between">
        <span className="flex items-center gap-2">
          <FileText size={14} className="text-[var(--mint)]" />
          Attachments
        </span>
        <Badge variant={selectedCount > 0 ? 'level-info' : 'default'}>
          {selectedCount} selected
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={13} />
          {loading ? 'Loading ticket' : 'Refresh Ticket'}
        </Button>

        {!ticket && (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line-2)] px-3 py-6 text-center text-[12px] text-[var(--ink-3)]">
            Enter a ticket number and refresh to review Zendesk attachments.
          </div>
        )}

        {ticket && ticket.attachments.length === 0 && (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line-2)] px-3 py-6 text-center text-[12px] text-[var(--ink-3)]">
            No attachments on ticket #{ticket.id}.
          </div>
        )}

        {ticket && ticket.attachments.length > 0 && (
          <div className="max-h-[260px] divide-y divide-[var(--line)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--line)]">
            {ticket.attachments.map((attachment) => (
              <label
                key={attachment.id}
                className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-3)]"
              >
                <input
                  type="checkbox"
                  className="accent-[var(--mint)]"
                  checked={selectionById.get(attachment.id) ?? false}
                  onChange={() => onToggle(attachment.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-[var(--ink-0)]">
                    {attachment.fileName}
                  </span>
                  <span className="block text-[10px] text-[var(--ink-3)]">
                    {attachment.commentType} note
                  </span>
                </span>
                <span className="font-mono text-[10px] text-[var(--ink-3)]">
                  {formatBytes(attachment.size)}
                </span>
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
