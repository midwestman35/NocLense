import type { JSX } from 'react';
import { Badge, Card, CardContent, Icon } from '../../ui';

export interface ImportSummaryData {
  datasetCount: number;
  entryCount: number;
  fileLabel: string;
  formatLabel: string;
  storageMode: 'memory' | 'indexeddb';
  timeRangeLabel: string;
}

interface ImportSummaryProps {
  summary: ImportSummaryData;
}

function formatEntryCount(value: number): string {
  return `${value.toLocaleString()} entr${value === 1 ? 'y' : 'ies'}`;
}

export function ImportSummary({ summary }: ImportSummaryProps): JSX.Element {
  return (
    <Card className="border-[rgba(142,240,183,0.22)] bg-[linear-gradient(180deg,rgba(142,240,183,0.05),rgba(255,255,255,0.02))]">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="check" size={14} stroke="var(--mint)" />
            <div>
              <p className="text-sm font-medium text-[var(--ink-0)]">Import ready</p>
              <p className="text-xs text-[var(--ink-3)]">{summary.fileLabel}</p>
            </div>
          </div>
          <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--mint)]">
            {summary.storageMode === 'indexeddb' ? 'IndexedDB streaming' : 'In-memory'}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Entries" value={formatEntryCount(summary.entryCount)} icon="activity" />
          <SummaryMetric label="Datasets" value={`${summary.datasetCount}`} icon="doc" />
          <SummaryMetric label="Format" value={summary.formatLabel} icon="filter" />
          <SummaryMetric label="Time range" value={summary.timeRangeLabel} icon="clock" />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: 'activity' | 'doc' | 'filter' | 'clock';
}): JSX.Element {
  return (
    <div className="rounded-[var(--radius-input)] border border-[var(--line)] bg-[rgba(255,255,255,0.015)] p-3">
      <div className="flex items-center gap-2 text-[var(--ink-3)]">
        <Icon name={icon} size={12} />
        <span className="mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-[var(--ink-0)]">{value}</p>
    </div>
  );
}
