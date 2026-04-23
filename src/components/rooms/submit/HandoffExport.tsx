import { useCallback, useState, type JSX } from 'react';
import { Archive, CheckCircle2, Download, Link } from 'lucide-react';
import { Badge, Button } from '../../ui';
import { useEvidence } from '../../../contexts/EvidenceContext';
import {
  buildNoclenseZip,
  noclenseFileName,
} from '../../../services/investigationExporter';
import { downloadBlob } from '../../../services/zipBuilder';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';

const APP_VERSION = '2.0.0';

interface HandoffTarget {
  name: string;
  detail: string;
  state: 'ready' | 'manual' | 'blocked';
}

const HANDOFF_TARGETS: HandoffTarget[] = [
  {
    name: 'Zendesk',
    detail: 'Post closure note and attach the investigation package',
    state: 'manual',
  },
  {
    name: 'Confluence',
    detail: 'Archive investigation context for future incidents',
    state: 'manual',
  },
  {
    name: 'Jira',
    detail: 'Copy corrective-action template when follow-up work is needed',
    state: 'ready',
  },
];

export function HandoffExport(): JSX.Element {
  const { investigation, evidenceSet } = useEvidence();
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!investigation || !evidenceSet) {
      setExportError('No investigation to export.');
      return;
    }

    setExportLoading(true);
    setExportError(null);
    try {
      const { blob } = await buildNoclenseZip(investigation, evidenceSet, APP_VERSION);
      downloadBlob(noclenseFileName(investigation), blob);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export failed. Check disk space and try again.',
      );
    } finally {
      setExportLoading(false);
    }
  }, [investigation, evidenceSet]);

  return (
    <WorkspaceCard
      id="handoff-export"
      title="Handoff Export"
      icon={<Link size={14} />}
      accentColor="#8b5cf6"
      collapsible={false}
      className="min-h-0"
      meta={<span>{HANDOFF_TARGETS.length} targets</span>}
    >
      <div className="flex min-h-0 flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          {HANDOFF_TARGETS.map((target) => (
            <div
              key={target.name}
              className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[rgba(255,255,255,0.03)] text-[var(--mint)]">
                <CheckCircle2 size={13} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-[var(--ink-0)]">{target.name}</span>
                <span className="block truncate font-mono text-[10px] text-[var(--ink-3)]">
                  {target.detail}
                </span>
              </span>
              <Badge variant={target.state === 'ready' ? 'level-info' : 'outline'}>
                {target.state}
              </Badge>
            </div>
          ))}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[rgba(0,0,0,0.22)] p-3">
          <div className="flex items-center gap-2 text-[12px] text-[var(--ink-1)]">
            <Archive size={14} className="text-[var(--mint)]" />
            <span>.noclense package</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
            Exports manifest.json, investigation.json, and evidence.json through the existing
            investigation exporter.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => void handleExport()}
          disabled={exportLoading}
          className="w-full justify-center"
          aria-label="Export investigation as .noclense file"
        >
          <Download size={13} />
          {exportLoading ? 'Exporting' : 'Export .noclense'}
        </Button>

        {exportError && (
          <p role="alert" className="text-[11px] text-[var(--red)]">
            {exportError}
          </p>
        )}
      </div>
    </WorkspaceCard>
  );
}
