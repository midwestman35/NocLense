import type { Case } from '../types/case';
import type { ImportedDataset, LogEntry } from '../types';
import type { NormalizedEvent } from '../types/event';
import type { ExportOptions, ExportPack, Provenance } from '../types/export';
import { redactEvent } from './redactor';
import { generateCloudWatchQuery, generateDatadogQuery, generateSIPQuery } from './queryGenerator';

function normalizeLogEntry(log: LogEntry): NormalizedEvent {
  return {
    id: String(log.id),
    timestamp: log.timestamp,
    message: log.summaryMessage ?? log.message,
    payload: log.json && typeof log.json === 'object' ? (log.json as Record<string, unknown>) : { raw: log.payload },
    extractedFields: {
      fileName: log.fileName,
      sourceLabel: log.sourceLabel,
      sourceType: log.sourceType,
      reportId: log.reportId,
      operatorId: log.operatorId,
      extensionId: log.extensionId,
      stationId: log.stationId,
      cncID: log.cncID,
      messageID: log.messageID,
    },
    source: log.sourceLabel,
    service: log.displayComponent,
    level: log.level.toLowerCase() as NormalizedEvent['level'],
    callId: log.callId,
    sipMethod: log.sipMethod ?? undefined,
    sipStatus: log.sipMethod?.match(/^(\d{3})/)?.[1],
  };
}

function formatTimeWindow(start?: number, end?: number): string {
  if (!start || !end) return 'Not set';
  return `${new Date(start).toLocaleString()} - ${new Date(end).toLocaleString()}`;
}

function inferTimeWindow(case_: Case, logs: LogEntry[]): { start: number; end: number } {
  if (case_.timeWindow?.start && case_.timeWindow?.end) {
    return case_.timeWindow;
  }
  if (case_.state?.timeWindow?.start && case_.state?.timeWindow?.end) {
    return case_.state.timeWindow;
  }
  const timestamps = logs.map((log) => log.timestamp).filter(Boolean);
  return {
    start: Math.min(...timestamps),
    end: Math.max(...timestamps),
  };
}

function inferCorrelationKeys(case_: Case, logs: LogEntry[]): Record<string, string> {
  const keys: Record<string, string> = {};
  const addValue = (key: string, value?: string) => {
    if (value && !keys[key]) {
      keys[key] = value;
    }
  };

  const stateCorrelations = case_.state?.filters.activeCorrelations ?? [];
  stateCorrelations.forEach((item) => {
    if (!item.excluded) {
      addValue(item.type, item.value);
    }
  });

  logs.forEach((log) => {
    addValue('callId', log.callId);
    addValue('reportId', log.reportId);
    addValue('messageID', log.messageID);
    addValue('cncID', log.cncID);
    addValue('extensionId', log.extensionId);
    addValue('stationId', log.stationId);
  });

  return keys;
}

function buildReport(case_: Case, logs: LogEntry[], options: ExportOptions, truncated: boolean): string {
  const timeWindow = inferTimeWindow(case_, logs);
  const evidenceList = case_.bookmarks
    .map((bookmark) => {
      const matchingLog = logs.find((log) => log.id === bookmark.logId);
      return `- [${bookmark.tag}] ${matchingLog?.summaryMessage ?? matchingLog?.message ?? `Log ${bookmark.logId}`}${bookmark.note ? ` - ${bookmark.note}` : ''}`;
    })
    .join('\n');

  const attachments = case_.attachments
    .map((attachment) => `- ${attachment.fileName} (${attachment.sourceLabel}, ${attachment.kind})`)
    .join('\n');

  return [
    '# Evidence Pack',
    '',
    `**Title:** ${case_.title}`,
    `**Incident Ref:** ${case_.externalRef ?? 'N/A'}`,
    `**Severity:** ${case_.severity}`,
    `**Status:** ${case_.status}`,
    `**Owner:** ${case_.owner ?? 'Unassigned'}`,
    `**Stakeholder Team:** ${case_.stakeholderTeam ?? 'Not set'}`,
    `**Time Window:** ${formatTimeWindow(timeWindow.start, timeWindow.end)}`,
    `**Evidence Events:** ${logs.length}${truncated ? ' (truncated)' : ''}`,
    '',
    '## Summary',
    case_.summary || 'N/A',
    '',
    '## Impact',
    case_.impact || 'N/A',
    '',
    '## Attached Sources',
    attachments || '- None recorded',
    '',
    '## Evidence Notes',
    evidenceList || '- No evidence bookmarks recorded',
    '',
    `Pack Type: ${options.packType}`,
    `Redaction: ${options.redactionPreset}`,
  ].join('\n');
}

function buildQuerySheet(case_: Case, logs: LogEntry[]): string {
  if (logs.length === 0) {
    return '# Follow-up Queries\n\nNo evidence events were selected for this pack.';
  }

  const timeWindow = inferTimeWindow(case_, logs);
  const correlationKeys = inferCorrelationKeys(case_, logs);
  const primaryService = logs.find((log) => log.displayComponent)?.displayComponent;
  const primaryCallId = logs.find((log) => log.callId)?.callId;
  const primarySipMethod = logs.find((log) => log.sipMethod)?.sipMethod ?? undefined;

  return [
    '# Follow-up Queries',
    '',
    '## Datadog',
    generateDatadogQuery(primaryService, correlationKeys, timeWindow),
    '',
    '## AWS / CloudWatch',
    generateCloudWatchQuery(correlationKeys, timeWindow),
    '',
    '## SIP',
    generateSIPQuery(primaryCallId, undefined, primarySipMethod),
  ].join('\n');
}

export function buildPack(
  case_: Case,
  logs: LogEntry[],
  importedDatasets: ImportedDataset[],
  options: ExportOptions,
  appVersion?: string,
  parserVersion?: string
): ExportPack {
  const normalizedEvents = logs.map(normalizeLogEntry);
  const redactedEvents = normalizedEvents.map((event) => redactEvent(event, options.redactionPreset));
  const truncated = redactedEvents.length > options.maxEvents;
  const finalEvents = truncated ? redactedEvents.slice(0, options.maxEvents) : redactedEvents;

  const provenance: Provenance = {
    importedFiles: importedDatasets.map((dataset) => dataset.fileName),
    importedDatasets,
    parserVersion,
    appVersion,
    redactionPreset: options.redactionPreset,
    exportOptions: options,
    truncationNote: truncated ? `Truncated to ${options.maxEvents}` : undefined,
    exportedAt: Date.now(),
  };

  return {
    report: buildReport(case_, logs.slice(0, options.maxEvents), options, truncated),
    caseJson: JSON.stringify({ case: case_, events: finalEvents }, null, 2),
    filteredLogs: finalEvents.map((event) => JSON.stringify(event)).join('\n'),
    queries: buildQuerySheet(case_, logs.slice(0, options.maxEvents)),
    provenance,
  };
}
