/**
 * logArchive.ts
 *
 * Generates a zip archive of loaded log entries for attachment to Zendesk tickets.
 * Uses JSZip to bundle log text files. Filename follows the NOC naming convention:
 *   {OrgName}_{SiteOrPosition}_{YYYY-MM-DD}_logs.zip
 */
import type { LogEntry } from '../types';

export interface ArchiveOptions {
  orgName: string;
  siteOrPosition: string;
  dateStr: string; // YYYY-MM-DD
}

/**
 * Derive a safe filename component by stripping special chars and collapsing spaces.
 */
function safeName(s: string): string {
  return s.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);
}

/**
 * Build the default archive filename (without .zip extension) from ticket/org context.
 */
export function buildArchiveFilename(options: Partial<ArchiveOptions>): string {
  const org = safeName(options.orgName ?? 'Unknown_Org');
  const site = safeName(options.siteOrPosition ?? 'Unknown_Site');
  const date = options.dateStr ?? new Date().toISOString().slice(0, 10);
  return `${org}_${site}_${date}_logs`;
}

/**
 * Convert an array of LogEntry objects into a formatted plain-text string.
 */
function logsToText(logs: LogEntry[]): string {
  return logs
    .map(l => `[${l.rawTimestamp}] [${l.level}] [${l.displayComponent}]: ${l.displayMessage}`)
    .join('\n');
}

/**
 * Generate a Blob containing a zip archive with the log entries as a text file.
 *
 * @param logs - All log entries to include in the archive
 * @param filename - Base filename (without .zip); used for the inner text file name too
 * @returns A Blob of type application/zip
 */
export async function generateLogArchive(
  logs: LogEntry[],
  filename: string
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const content = logsToText(logs);
  zip.file(`${filename}.txt`, content);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Trigger a browser download of the zip archive.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
