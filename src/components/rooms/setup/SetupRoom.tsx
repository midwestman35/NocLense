import { useMemo, useState, type JSX } from 'react';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { fetchZendeskTicket, type ZendeskTicket } from '../../../services/zendeskService';
import { loadAiSettings, saveAiSettings, type AiSettings } from '../../../store/aiSettings';
import { Button, Card, CardContent, CardHeader, Icon, Separator, useToast } from '../../ui';
import { AttachmentPanel } from './AttachmentPanel';
import { ContextPanel } from './ContextPanel';
import { CredentialCard } from './CredentialCard';
import {
  buildAttachmentSelections,
  countConfiguredVendors,
  type AttachmentSelection,
  type SetupContextDraft,
  type VendorId,
} from './setupRoomShared';

interface SetupRoomProps {
  onBack?: () => void;
  onContinue?: () => void;
}

const VENDOR_ORDER: VendorId[] = ['zendesk', 'datadog', 'jira', 'confluence'];

export function SetupRoom({ onBack, onContinue }: SetupRoomProps): JSX.Element {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [context, setContext] = useState<SetupContextDraft>({
    ticketId: '',
    severity: '',
    timezone: 'Eastern Time (US & Canada)',
    cnc: '',
    notes: '',
  });
  const [ticket, setTicket] = useState<ZendeskTicket | null>(null);
  const [attachments, setAttachments] = useState<AttachmentSelection[]>([]);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const configuredCount = useMemo(() => countConfiguredVendors(settings), [settings]);

  const handleSave = () => {
    saveAiSettings(settings);
    toast('Setup configuration saved to existing AI settings storage.', { variant: 'success' });
  };

  const refreshTicket = async () => {
    if (!context.ticketId.trim()) {
      toast('Enter a Zendesk ticket number before refreshing.', { variant: 'warning' });
      return;
    }

    setLoadingTicket(true);
    try {
      const nextTicket = await fetchZendeskTicket(settings, context.ticketId);
      setTicket(nextTicket);
      setAttachments(buildAttachmentSelections(nextTicket));
      setContext((current) => ({
        ...current,
        timezone: nextTicket.requesterTimezone ?? nextTicket.orgTimezone ?? current.timezone,
        severity: current.severity || nextTicket.priority || '',
      }));
      toast(`Loaded Zendesk ticket #${nextTicket.id}.`, { variant: 'success' });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), { variant: 'error' });
    } finally {
      setLoadingTicket(false);
    }
  };

  const toggleAttachment = (id: number) => {
    setAttachments((current) => current.map((item) => (
      item.id === id ? { ...item, selected: !item.selected } : item
    )));
  };

  return (
    <section className="h-full min-h-0 w-full overflow-hidden px-6 py-5">
      <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--mint)]">
                Investigation Setup
              </p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--ink-0)]">
                Vendor credentials and incident context
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft size={13} />
                Import
              </Button>
              <Button type="button" size="sm" onClick={handleSave}>
                <Save size={13} />
                Save All
              </Button>
              <Button type="button" size="sm" onClick={onContinue}>
                Investigate
                <ArrowRight size={13} />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {VENDOR_ORDER.map((vendor) => (
              <CredentialCard
                key={vendor}
                vendor={vendor}
                settings={settings}
                context={context}
                onSettingsChange={setSettings}
                onSaved={handleSave}
              />
            ))}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3">
          <Card variant="elevated" className="shrink-0 overflow-hidden">
            <CardHeader>
              <Icon name="spark" size={14} stroke="var(--mint)" />
              Setup Status
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-mono text-[22px] text-[var(--ink-0)]">{configuredCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">vendors ready</p>
                </div>
                <div>
                  <p className="font-mono text-[22px] text-[var(--ink-0)]">
                    {attachments.filter((attachment) => attachment.selected).length}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">attachments</p>
                </div>
              </div>
              <Separator />
              <p className="text-[11px] leading-relaxed text-[var(--ink-2)]">
                Saved values continue through loadAiSettings() and saveAiSettings(), matching the Phase 06 setup path.
              </p>
            </CardContent>
          </Card>

          <ContextPanel context={context} ticket={ticket} onContextChange={setContext} />
          <AttachmentPanel
            ticket={ticket}
            loading={loadingTicket}
            selections={attachments}
            onToggle={toggleAttachment}
            onRefresh={() => void refreshTicket()}
          />
        </aside>
      </div>
    </section>
  );
}
