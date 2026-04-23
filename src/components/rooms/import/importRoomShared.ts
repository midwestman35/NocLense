import type { ImportedDataset, LogSourceType } from '../../../types';
import type { Attachment, Case } from '../../../types/case';

export const FILE_STREAM_THRESHOLD_BYTES = 50 * 1024 * 1024;

export const SOURCE_OPTIONS: Array<{
  id: LogSourceType;
  label: string;
  description: string;
  icon: 'doc' | 'db' | 'terminal' | 'shield';
}> = [
  { id: 'apex', label: 'APEX', description: 'Application logs and exported text files.', icon: 'doc' },
  { id: 'datadog', label: 'Datadog', description: 'CSV or text exports from Datadog.', icon: 'db' },
  { id: 'aws', label: 'AWS Console', description: 'Paste CloudWatch or AWS console output.', icon: 'terminal' },
  { id: 'unknown', label: 'Unknown', description: 'Use when the source is mixed or uncertain.', icon: 'shield' },
];

function toAttachment(dataset: ImportedDataset): Attachment {
  return {
    id: dataset.id,
    importBatchId: dataset.importBatchId,
    fileName: dataset.fileName,
    sourceType: dataset.sourceType,
    sourceLabel: dataset.sourceLabel,
    size: dataset.size,
    importedAt: dataset.importedAt,
    kind: dataset.kind,
    warnings: dataset.warnings,
  };
}

export function mergeAttachments(existing: Attachment[], datasets: ImportedDataset[]): Attachment[] {
  const next = [...existing];
  datasets.forEach((dataset) => {
    if (!next.some((attachment) => attachment.importBatchId === dataset.importBatchId)) {
      next.push(toAttachment(dataset));
    }
  });
  return next.sort((left, right) => left.importedAt - right.importedAt);
}

export function upsertImportedCase(cases: Case[], importedCase: Case): Case[] {
  const nextCases = cases.some((caseItem) => caseItem.id === importedCase.id)
    ? cases.map((caseItem) => (caseItem.id === importedCase.id ? importedCase : caseItem))
    : [...cases, importedCase];

  return nextCases.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function normalizeTicketInput(value: string): string {
  return value.trim().replace(/\D/g, '');
}

export function formatTimeRange(min: number | null, max: number | null): string {
  if (min === null || max === null || Number.isNaN(min) || Number.isNaN(max)) {
    return 'Awaiting timestamps';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${formatter.format(min)} – ${formatter.format(max)}`;
}
