import { cleanupLogEntry } from '../utils/messageCleanup';
import { dbManager } from '../utils/indexedDB';
import { validateFile } from '../utils/fileUtils';
import { parseLogFile } from '../utils/parser';
import { uploadFile, getJobStatus } from '../api/client';
import type { ImportedDataset, LogEntry, LogLevel, LogSourceType } from '../types';

const FILE_COLORS = ['#3b82f6', '#eab308', '#06b6d4', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#64748b'];

export interface ImportFilesResult {
  logs: LogEntry[];
  datasets: ImportedDataset[];
  warnings: string[];
  usedIndexedDB: boolean;
  nextLogId: number;
}

export interface ImportTextResult {
  logs: LogEntry[];
  dataset: ImportedDataset;
  warnings: string[];
  nextLogId: number;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sourceLabelFor(sourceType: LogSourceType): string {
  switch (sourceType) {
    case 'apex':
      return 'APEX';
    case 'datadog':
      return 'Datadog';
    case 'aws':
      return 'AWS Console';
    default:
      return 'Unknown Source';
  }
}

function normalizeLevelFromText(message: string): LogLevel {
  const upper = message.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('EXCEPTION') || upper.includes('FAILED')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARN';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG';
  return 'INFO';
}

function detectTimestamp(value: string | undefined, fallback: number): { timestamp: number; rawTimestamp: string } {
  if (!value) {
    return { timestamp: fallback, rawTimestamp: new Date(fallback).toISOString() };
  }

  const parsed = new Date(value).getTime();
  if (!Number.isNaN(parsed)) {
    return { timestamp: parsed, rawTimestamp: value };
  }

  return { timestamp: fallback, rawTimestamp: value };
}

function hydrateFallbackFields(log: LogEntry): LogEntry {
  const combined = `${log.message}\n${log.payload}`;

  const callIdMatch = combined.match(/call[ -]?id[=:]\s*([^\s;,\]]+)/i);
  if (callIdMatch) {
    log.callId = callIdMatch[1].trim();
    log._callIdLower = log.callId.toLowerCase();
  }

  const reportMatch = combined.match(/report(?: id)?[=:]\s*([A-Za-z0-9-]+)/i);
  if (reportMatch) {
    log.reportId = reportMatch[1];
  }

  const extensionMatch = combined.match(/extension(?:ID)?[=:]\s*(?:Optional\[)?(\d+)/i);
  if (extensionMatch) {
    log.extensionId = extensionMatch[1];
    if (extensionMatch[1].length > 2) {
      log.stationId = extensionMatch[1].slice(2);
    }
  }

  const cncMatch = combined.match(/cncID[=:]\s*([A-Za-z0-9-]+)/i);
  if (cncMatch) {
    log.cncID = cncMatch[1];
  }

  const messageIdMatch = combined.match(/messageID[=:]\s*([A-Za-z0-9-]+)/i);
  if (messageIdMatch) {
    log.messageID = messageIdMatch[1];
  }

  if (log.payload.trim().startsWith('{') && log.payload.trim().endsWith('}')) {
    try {
      log.json = JSON.parse(log.payload);
      log.type = 'JSON';
    } catch {
      // Ignore invalid JSON payloads in fallback mode.
    }
  }

  log._messageLower = log.message.toLowerCase();
  log._componentLower = log.component.toLowerCase();
  log._payloadLower = log.payload.toLowerCase();
  return log;
}

function finalizeManualLog(
  id: number,
  timestampValue: string | undefined,
  component: string,
  message: string,
  payload: string,
  fileName: string,
  fileColor: string,
  fallbackTime: number
): LogEntry {
  const { timestamp, rawTimestamp } = detectTimestamp(timestampValue, fallbackTime);
  const cleaned = cleanupLogEntry(component, message);
  return hydrateFallbackFields({
    id,
    timestamp,
    rawTimestamp,
    level: normalizeLevelFromText(`${message}\n${payload}`),
    component,
    displayComponent: cleaned.displayComponent,
    message,
    displayMessage: cleaned.displayMessage,
    payload,
    type: 'LOG',
    isSip: false,
    sipMethod: null,
    fileName,
    fileColor,
  });
}

function annotateLogs(logs: LogEntry[], dataset: ImportedDataset): LogEntry[] {
  return logs.map((log) => ({
    ...log,
    sourceType: dataset.sourceType,
    sourceLabel: dataset.sourceLabel,
    importBatchId: dataset.importBatchId,
    importedAt: dataset.importedAt,
  }));
}

function createDataset(args: {
  sourceType: LogSourceType;
  fileName: string;
  kind: ImportedDataset['kind'];
  size: number;
  logCount: number;
  warnings: string[];
  importBatchId?: string;
  importedAt?: number;
}): ImportedDataset {
  const importBatchId = args.importBatchId ?? createId('import');
  const importedAt = args.importedAt ?? Date.now();

  return {
    id: createId('dataset'),
    importBatchId,
    sourceType: args.sourceType,
    sourceLabel: sourceLabelFor(args.sourceType),
    fileName: args.fileName,
    kind: args.kind,
    size: args.size,
    importedAt,
    logCount: args.logCount,
    warnings: args.warnings,
  };
}

function parseAwsConsoleText(text: string, startId: number, fileName: string, fileColor: string): { logs: LogEntry[]; warnings: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const logs: LogEntry[] = [];
  let nextId = startId;
  let fallbackUsed = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const syntheticTime = Date.now() + index;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const payload = JSON.parse(trimmed) as Record<string, unknown>;
        const message = String(payload['@message'] ?? payload.message ?? payload.msg ?? trimmed);
        const component = String(payload['@logStream'] ?? payload.logStream ?? payload.service ?? payload.source ?? 'AWS Console');
        const timestampValue = String(payload['@timestamp'] ?? payload.timestamp ?? payload.time ?? payload.date ?? '');
        logs.push(
          finalizeManualLog(nextId++, timestampValue, component, message, JSON.stringify(payload, null, 2), fileName, fileColor, syntheticTime)
        );
        return;
      } catch {
        // Fall through to simpler line parsing.
      }
    }

    const tabParts = trimmed.split('\t');
    if (tabParts.length >= 2 && /^\d{4}-\d{2}-\d{2}/.test(tabParts[0])) {
      const [timestampValue, message, ...rest] = tabParts;
      const payload = rest.join('\t');
      logs.push(finalizeManualLog(nextId++, timestampValue, 'AWS Console', message, payload, fileName, fileColor, syntheticTime));
      return;
    }

    const spacedMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?Z?)\s+(.*)$/);
    if (spacedMatch) {
      logs.push(finalizeManualLog(nextId++, spacedMatch[1], 'AWS Console', spacedMatch[2], '', fileName, fileColor, syntheticTime));
      return;
    }

    fallbackUsed = true;
    logs.push(finalizeManualLog(nextId++, undefined, 'AWS Console', trimmed, '', fileName, fileColor, syntheticTime));
  });

  return {
    logs,
    warnings: fallbackUsed ? ['Some AWS lines were imported with fallback parsing.'] : [],
  };
}

function parseGenericFallbackText(text: string, startId: number, fileName: string, fileColor: string, sourceType: LogSourceType): LogEntry[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) =>
      finalizeManualLog(startId + index, undefined, sourceLabelFor(sourceType), line.trim(), '', fileName, fileColor, Date.now() + index)
    );
}

export async function importFiles(
  files: File[],
  options: {
    sourceType: LogSourceType;
    startId?: number;
    onProgress?: (progress: number) => void;
    useIndexedDB?: boolean;
  }
): Promise<ImportFilesResult> {
  const warnings: string[] = [];
  const datasets: ImportedDataset[] = [];
  let allLogs: LogEntry[] = [];
  let currentMaxId = options.startId ?? 1;
  let usedIndexedDB = false;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid file');
    }
    if (validation.warning) {
      warnings.push(validation.warning);
    }

    const dataset = createDataset({
      sourceType: options.sourceType,
      fileName: file.name,
      kind: 'file',
      size: file.size,
      logCount: 0,
      warnings: validation.warning ? [validation.warning] : [],
    });

    const color = FILE_COLORS[index % FILE_COLORS.length];
    const startId = currentMaxId;
    const result = await parseLogFile(
      file,
      color,
      startId,
      (progress) => {
        options.onProgress?.((index + progress) / files.length);
      },
      options.useIndexedDB ?? true
    );

    if (Array.isArray(result)) {
      const annotated = annotateLogs(result, dataset);
      dataset.logCount = annotated.length;
      allLogs = allLogs.concat(annotated);
      if (annotated.length > 0) {
        currentMaxId = Math.max(currentMaxId, annotated[annotated.length - 1].id + 1);
      }
    } else {
      usedIndexedDB = true;
      dataset.logCount = result.totalParsed;
      await dbManager.updateLogsByIdRange(startId, startId + result.totalParsed - 1, {
        sourceType: dataset.sourceType,
        sourceLabel: dataset.sourceLabel,
        importBatchId: dataset.importBatchId,
        importedAt: dataset.importedAt,
      });
      currentMaxId += result.totalParsed;
    }

    datasets.push(dataset);
  }

  return {
    logs: allLogs,
    datasets,
    warnings,
    usedIndexedDB,
    nextLogId: currentMaxId,
  };
}

export async function appendLogsToIndexedDB(logs: LogEntry[], datasets: ImportedDataset[]): Promise<void> {
  if (logs.length === 0) return;

  await dbManager.addLogsBatch(logs);

  const metadata = await dbManager.getMetadata();
  const minTimestamp = logs.reduce((min, log) => Math.min(min, log.timestamp), Number.POSITIVE_INFINITY);
  const maxTimestamp = logs.reduce((max, log) => Math.max(max, log.timestamp), Number.NEGATIVE_INFINITY);
  const fileNames = new Set(metadata?.fileNames ?? []);
  datasets.forEach((dataset) => fileNames.add(dataset.fileName));

  await dbManager.updateMetadata({
    totalLogs: (metadata?.totalLogs ?? 0) + logs.length,
    fileNames: Array.from(fileNames),
    dateRange: {
      min: Math.min(metadata?.dateRange.min ?? minTimestamp, minTimestamp),
      max: Math.max(metadata?.dateRange.max ?? maxTimestamp, maxTimestamp),
    },
  });
}

export async function importPastedLogs(
  text: string,
  options: {
    sourceType: LogSourceType;
    startId?: number;
    label?: string;
  }
): Promise<ImportTextResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Paste log content to import.');
  }

  const fileName = options.label?.trim() || `${options.sourceType}-pasted.log`;
  const dataset = createDataset({
    sourceType: options.sourceType,
    fileName,
    kind: 'paste',
    size: new Blob([trimmed]).size,
    logCount: 0,
    warnings: [],
  });

  let logs: LogEntry[] = [];
  let warnings: string[] = [];
  const startId = options.startId ?? 1;
  const color = FILE_COLORS[2];

  if (options.sourceType === 'aws') {
    const awsResult = parseAwsConsoleText(trimmed, startId, fileName, color);
    logs = awsResult.logs;
    warnings = warnings.concat(awsResult.warnings);
  }

  if (logs.length === 0) {
    const tempFile = new File([trimmed], fileName, { type: 'text/plain' });
    const parsed = await parseLogFile(tempFile, color, startId, undefined, false);
    if (Array.isArray(parsed) && parsed.length > 0) {
      logs = parsed;
    }
  }

  if (logs.length === 0) {
    warnings.push(
      options.sourceType === 'aws'
        ? 'AWS paste format was not fully recognized; imported each line as a standalone event.'
        : 'The pasted content did not match a known parser; imported each line as a standalone event.'
    );
    logs = parseGenericFallbackText(trimmed, startId, fileName, color, options.sourceType);
  }

  dataset.logCount = logs.length;
  dataset.warnings = warnings;

  return {
    logs: annotateLogs(logs, dataset),
    dataset,
    warnings,
    nextLogId: startId + logs.length,
  };
}

// ─── Server Upload ───────────────────────────────────────────────────────────

export interface ServerImportResult {
  jobId: string;
  fileName: string;
}

/**
 * Upload files to the NocLense server for server-side parsing.
 * Returns job IDs. The caller should poll getJobStatus() for progress.
 */
export async function importFilesViaServer(
  files: File[],
  options: {
    onProgress?: (fileIndex: number, progress: number) => void;
  } = {}
): Promise<ServerImportResult[]> {
  const results: ServerImportResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options.onProgress?.(i, 0);

    const jobId = await uploadFile(file);
    results.push({ jobId, fileName: file.name });

    // Poll until parsing completes (or errors)
    let status = await getJobStatus(jobId);
    while (status.status === 'pending' || status.status === 'parsing') {
      options.onProgress?.(i, status.progress);
      await new Promise((r) => setTimeout(r, 2000));
      status = await getJobStatus(jobId);
    }

    if (status.status === 'error') {
      throw new Error(`Server parsing failed for ${file.name}: ${status.error}`);
    }

    options.onProgress?.(i, 1);
  }

  return results;
}
