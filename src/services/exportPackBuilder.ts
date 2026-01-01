import type { Case } from '../types/case';
import type { NormalizedEvent } from '../types/event';
import type { ExportOptions, ExportPack, Provenance } from '../types/export';
import { redactEvent } from './redactor';

export function buildPack(case_: Case, events: NormalizedEvent[], options: ExportOptions, appVersion?: string, parserVersion?: string, importedFiles: string[] = []): ExportPack {
  const redactedEvents = events.map(e => redactEvent(e, options.redactionPreset));
  const truncated = redactedEvents.length > options.maxEvents;
  const finalEvents = truncated ? redactedEvents.slice(0, options.maxEvents) : redactedEvents;
  const provenance: Provenance = { importedFiles, parserVersion, appVersion, redactionPreset: options.redactionPreset, exportOptions: options, truncationNote: truncated ? `Truncated to ${options.maxEvents}` : undefined, exportedAt: Date.now() };
  return { report: buildReport(case_, finalEvents, options, truncated), caseJson: JSON.stringify({ case: case_, events: finalEvents }, null, 2), filteredLogs: finalEvents.map(e => JSON.stringify(e)).join('\n'), queries: `# Queries for ${case_.title}`, provenance };
}

function buildReport(case_: Case, events: NormalizedEvent[], options: ExportOptions, truncated: boolean): string {
  return `# Case Report\n\n**Title:** ${case_.title}\n**Severity:** ${case_.severity}\n**Summary:** ${case_.summary || 'N/A'}\n\n## Events: ${events.length}${truncated ? ' (truncated)' : ''}\n\nPack Type: ${options.packType}\nRedaction: ${options.redactionPreset}`;
}
