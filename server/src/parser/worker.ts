/**
 * Server-side log parser — ports regex + processLogPayload from src/utils/parser.ts
 * Uses fs.createReadStream instead of File.slice()
 */

import fs from 'fs';
import { getDb, saveDb } from '../db/connection.js';

// ─── Types (mirroring src/types.ts LogEntry for DB insertion) ────────────────

export type LogLevel = 'INFO' | 'DEBUG' | 'ERROR' | 'WARN';

export interface ParsedLog {
  jobId: string;
  timestamp: number;
  rawTimestamp: string;
  level: LogLevel;
  component: string;
  displayComponent: string;
  message: string;
  displayMessage: string;
  payload: string;
  type: 'LOG' | 'JSON';
  jsonData: string | null;
  isSip: boolean;
  sipMethod: string | null;
  callId: string | null;
  reportId: string | null;
  operatorId: string | null;
  extensionId: string | null;
  stationId: string | null;
  sipFrom: string | null;
  sipTo: string | null;
  messageType: string | null;
  cncID: string | null;
  messageID: string | null;
  summaryMessage: string | null;
  fileName: string | null;
  fileColor: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYLOAD_CAP_BYTES = 500 * 1024;
const BATCH_SIZE = 1000;

// Regex patterns matching client-side parser
const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/i;
const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/i;

// ─── Helper functions (ported from client) ───────────────────────────────────

function normalizeLogLevel(level: string): LogLevel {
  const upper = level.toUpperCase().trim();
  if (['ERROR', 'ERR', 'CRITICAL', 'FATAL', 'SEVERE', 'FAILURE', 'FAIL'].includes(upper)) return 'ERROR';
  if (['WARN', 'WARNING', 'CAUTION'].includes(upper)) return 'WARN';
  if (['DEBUG', 'TRACE', 'VERBOSE', 'FINE', 'FINER', 'FINEST'].includes(upper)) return 'DEBUG';
  if (['INFO', 'INFORMATION', 'NOTICE', 'LOG'].includes(upper)) return 'INFO';
  if (upper.includes('ERR') || upper.includes('FATAL') || upper.includes('CRIT')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARN';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG';
  return 'INFO';
}

function getSipResponseLevel(sipMethod: string | null | undefined): LogLevel | null {
  if (!sipMethod) return null;
  const codeMatch = sipMethod.match(/^(\d{3})/);
  if (!codeMatch) return null;
  const code = parseInt(codeMatch[1], 10);
  if (code >= 400 && code < 500) return 'WARN';
  if (code >= 500) return 'ERROR';
  return null;
}

/** Simplified cleanupLogEntry — extracts service from pekko paths, cleans messages */
function cleanupLogEntry(component: string, message: string): { displayComponent: string; displayMessage: string } {
  let cleanedMessage = message;
  let extractedService: string | null = null;

  // Check if message starts with pekko path
  const messagePekkoMatch = message.match(/^\[pekko:\/\/operator-actor-system\/user\/controller\/((?:[^/$\]]+\/?)+)/);
  if (messagePekkoMatch) {
    const segments = messagePekkoMatch[1].split('/').filter((s: string) => s && !s.startsWith('$'));
    extractedService = segments[segments.length - 1] || null;
    cleanedMessage = message.replace(/^\[pekko:\/\/[^\]]+\]\s*/, '');
  } else {
    const pekkoMatch = component.match(/\/controller\/((?:[^/$]+\/?)+)/);
    if (pekkoMatch) {
      const segments = pekkoMatch[1].split('/').filter((s: string) => s && !s.startsWith('$'));
      extractedService = segments[segments.length - 1] || null;
    }
  }

  const displayComponent = extractedService
    ? toPascalCase(extractedService)
    : (component.split('.').pop()?.split('-')[0] || component);

  // Clean message
  let cleaned = cleanedMessage;
  cleaned = cleaned.replace(/\b[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}\s+\([^)]+\)/g, '');
  cleaned = cleaned.replace(/\s+at\s+\d{2}:\d{2}:\d{2}\s+[A-Z]{2,4}/g, '');
  cleaned = cleaned.replace(/Optional\[([^\]]+)\]/g, '$1');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^[\s,\]]+|[\s,\[]+$/g, '');
  cleaned = cleaned.replace(/\[CallTakingTimestamp\]\s+\d+:\s*/g, '');

  return {
    displayComponent: displayComponent.charAt(0).toUpperCase() + displayComponent.slice(1),
    displayMessage: cleaned.trim(),
  };
}

function toPascalCase(str: string): string {
  return str.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

/** Build JSON summary for CNC/FDX messages */
function buildJsonSummary(json: Record<string, unknown>, component: string): string | null {
  const messageType = json.messageType != null ? String(json.messageType) : null;
  const isHttpLogger = component?.includes('HTTP-Logger') ?? false;
  if (isHttpLogger) return null;

  const parts: string[] = [];

  if (messageType && (messageType.includes('OPERATORS_STATUSES') || messageType.includes('OPERATOR'))) {
    const operatorsStatuses = json.operatorsStatuses;
    const n = Array.isArray(operatorsStatuses) ? operatorsStatuses.length : 0;
    parts.push(n > 0 ? `${messageType} (${n} operators)` : messageType);
  } else if (json.reportNLPConversation && typeof json.reportNLPConversation === 'object') {
    const rnc = json.reportNLPConversation as Record<string, unknown>;
    const reportID = rnc.reportID != null ? String(rnc.reportID) : null;
    const transcript = rnc.transcript;
    let firstLine: string | null = null;
    if (Array.isArray(transcript) && transcript.length > 0 && typeof transcript[0] === 'string') {
      firstLine = transcript[0].slice(0, 60);
      if ((transcript[0] as string).length > 60) firstLine += '...';
    }
    if (reportID) parts.push(`report ${reportID}`);
    if (firstLine) parts.push(firstLine);
  } else if (json.fdxReportUpdateMessageData && typeof json.fdxReportUpdateMessageData === 'object') {
    const data = json.fdxReportUpdateMessageData as Record<string, unknown>;
    const reportId = data.reportID != null ? String(data.reportID) : null;
    const reportUpdateTypes = data.reportUpdateTypes;
    if (reportId) parts.push(`report ${reportId}`);
    if (Array.isArray(reportUpdateTypes) && reportUpdateTypes.length > 0) {
      parts.push(reportUpdateTypes.map((t: unknown) => String(t)).join(', '));
    } else if (reportUpdateTypes != null) {
      parts.push(String(reportUpdateTypes));
    }
  } else if (messageType) {
    parts.push(messageType);
  }

  return parts.length === 0 ? null : parts.join(' \u00b7 ');
}

/** Process log payload — extracts JSON, SIP, correlation IDs (ported from client) */
function processLogPayload(log: ParsedLog): void {
  const trimmedPayload = log.payload.trim();

  // 1. Check for JSON
  if (trimmedPayload.startsWith('{') && trimmedPayload.endsWith('}')) {
    try {
      const json = JSON.parse(trimmedPayload);
      log.type = 'JSON';
      log.jsonData = trimmedPayload;

      // Extract IDs from JSON
      if (json.reportNLPConversation?.reportID) log.reportId = String(json.reportNLPConversation.reportID);
      if (json.recipientsClientIDs && Array.isArray(json.recipientsClientIDs) && json.recipientsClientIDs.length > 0) {
        log.operatorId = json.recipientsClientIDs[0];
      }
      if (json.operatorID) log.operatorId = json.operatorID;
      if (json.extensionID) {
        log.extensionId = String(json.extensionID);
        if (log.extensionId.length > 2) log.stationId = log.extensionId.substring(2);
      }
      if (json.messageType != null) log.messageType = String(json.messageType);
      if (json.cncID != null) log.cncID = String(json.cncID);
      if (json.messageID != null) log.messageID = String(json.messageID);

      // Summary
      const summary = buildJsonSummary(json, log.component);
      if (summary) {
        log.summaryMessage = summary;
        log.displayMessage = summary;
      }

      // JSON-based level extraction
      if (log.level === 'INFO') {
        const jsonLevel = json.level || json.severity || json.logLevel ||
          json.Level || json.Severity || json.LogLevel ||
          json.log_level || json.loglevel;
        if (jsonLevel) {
          const normalized = normalizeLogLevel(String(jsonLevel));
          if (normalized === 'ERROR' || normalized === 'WARN') log.level = normalized;
        }
        const hasError = json.error || json.Error || json.ERROR ||
          json.exception || json.Exception ||
          json.stackTrace || json.stack_trace ||
          json.errorMessage || json.error_message;
        if (hasError && log.level === 'INFO') log.level = 'ERROR';
      }
    } catch {
      // Not valid JSON
    }
  }

  // Cap large payloads
  if (trimmedPayload.length > PAYLOAD_CAP_BYTES) {
    log.payload = trimmedPayload.slice(0, PAYLOAD_CAP_BYTES) + '\n... [payload truncated for display]';
  }

  // 2. Extract IDs via Regex fallback
  const combined = log.message + ' ' + log.payload;
  const reportIdMatch = combined.match(/report id:\s*(\d+)/i);
  if (reportIdMatch && !log.reportId) log.reportId = reportIdMatch[1];

  const extIdMatch = combined.match(/extensionID: Optional\[(\d+)\]/i);
  if (extIdMatch && !log.extensionId) {
    log.extensionId = extIdMatch[1];
    if (log.extensionId.length > 2) log.stationId = log.extensionId.substring(2);
  }

  // 3. Check for SIP
  if (log.payload.includes('SIP/2.0') || log.message.toLowerCase().includes('sip')) {
    log.isSip = true;

    const firstLine = log.payload.split('\n')[0] || '';
    const responseMatch = firstLine.match(/^SIP\/2\.0\s+(\d{3})\s+(.*)/i);
    if (responseMatch) {
      log.sipMethod = `${responseMatch[1]} ${responseMatch[2]}`;
    } else {
      const requestMatch = firstLine.match(/^([A-Z]+)\s+sip:.*SIP\/2\.0/i);
      if (requestMatch) {
        log.sipMethod = requestMatch[1];
      } else {
        const knownMethods = ['INVITE', 'ACK', 'BYE', 'CANCEL', 'OPTIONS', 'REGISTER', 'PRACK', 'UPDATE', 'SUBSCRIBE', 'NOTIFY', 'REFER', 'INFO', 'MESSAGE', 'PUBLISH'];
        for (const m of knownMethods) {
          if (firstLine.toUpperCase().includes(m)) {
            log.sipMethod = m;
            break;
          }
        }
      }
    }

    // Extract Call-ID
    const callIdMatch = log.payload.match(/Call-ID:\s*(.+)/i);
    if (callIdMatch) log.callId = callIdMatch[1].trim();

    // Extract From/To
    const fromMatch = log.payload.match(/From:\s*(.+)/i);
    if (fromMatch) log.sipFrom = fromMatch[1].trim();
    const toMatch = log.payload.match(/To:\s*(.+)/i);
    if (toMatch) log.sipTo = toMatch[1].trim();

    // Agent ID
    const agentIdMatch = log.payload.match(/agentid=([a-f0-9-]+)/i);
    if (agentIdMatch && !log.operatorId) log.operatorId = agentIdMatch[1];

    // SIP level detection
    if (log.level === 'INFO') {
      const sipLevel = getSipResponseLevel(log.sipMethod);
      if (sipLevel) log.level = sipLevel;
    }
  }
}

// ─── SQL Statements ──────────────────────────────────────────────────────────

const INSERT_SQL = `INSERT INTO logs (
  job_id, timestamp, raw_timestamp, level, component, display_component,
  message, display_message, payload, type, json_data, is_sip, sip_method,
  call_id, report_id, operator_id, extension_id, station_id,
  sip_from, sip_to, message_type, cnc_id, message_id,
  summary_message, file_name, file_color
) VALUES (
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?
)`;

// ─── Main parse function ─────────────────────────────────────────────────────

export interface ParseOptions {
  jobId: string;
  filePath: string;
  fileName: string;
  fileColor?: string;
}

export async function parseFile(opts: ParseOptions): Promise<void> {
  const { jobId, filePath, fileName, fileColor = '#3b82f6' } = opts;
  const db = getDb();

  // Mark job as parsing
  db.run(`UPDATE jobs SET status = 'parsing' WHERE id = ?`, [jobId]);

  const fileSize = fs.statSync(filePath).size;
  let totalParsed = 0;
  let buffer = '';
  let currentLog: ParsedLog | null = null;
  let bytesRead = 0;

  function insertBatch(logs: ParsedLog[]): void {
    db.run('BEGIN TRANSACTION');
    try {
      for (const log of logs) {
        db.run(INSERT_SQL, [
          log.jobId, log.timestamp, log.rawTimestamp, log.level, log.component, log.displayComponent,
          log.message, log.displayMessage, log.payload, log.type, log.jsonData, log.isSip ? 1 : 0, log.sipMethod,
          log.callId, log.reportId, log.operatorId, log.extensionId, log.stationId,
          log.sipFrom, log.sipTo, log.messageType, log.cncID, log.messageID,
          log.summaryMessage, log.fileName, log.fileColor,
        ]);
      }
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  }

  let batch: ParsedLog[] = [];

  function flushBatch(): void {
    if (batch.length === 0) return;
    insertBatch(batch);
    totalParsed += batch.length;
    const progress = Math.min(bytesRead / fileSize, 0.99);
    db.run(`UPDATE jobs SET total_parsed = ?, progress = ? WHERE id = ?`, [totalParsed, progress, jobId]);
    saveDb();
    batch = [];
  }

  function makeEmptyLog(): ParsedLog {
    return {
      jobId,
      timestamp: 0,
      rawTimestamp: '',
      level: 'INFO',
      component: '',
      displayComponent: '',
      message: '',
      displayMessage: '',
      payload: '',
      type: 'LOG',
      jsonData: null,
      isSip: false,
      sipMethod: null,
      callId: null,
      reportId: null,
      operatorId: null,
      extensionId: null,
      stationId: null,
      sipFrom: null,
      sipTo: null,
      messageType: null,
      cncID: null,
      messageID: null,
      summaryMessage: null,
      fileName,
      fileColor,
    };
  }

  function processLine(line: string): void {
    if (!line.trim()) return;

    let match = line.match(logRegex1);
    let dateFormat = 'original';

    if (!match) {
      match = line.match(logRegex2);
      dateFormat = 'iso';
    }

    if (match) {
      // Finalize previous log
      if (currentLog) {
        processLogPayload(currentLog);
        // Extract callId from message (Datadog style)
        const callIdMatch = currentLog.message.match(/callId[=:]\s*([^\s;,\[\]\(\)]+)/i) || currentLog.message.match(/Call-ID:\s*([^\s]+)/i);
        if (callIdMatch && !currentLog.callId) currentLog.callId = callIdMatch[1].trim();
        batch.push(currentLog);
        if (batch.length >= BATCH_SIZE) flushBatch();
      }

      const [, levelRaw, date, time, component, message] = match;
      const level = normalizeLogLevel(levelRaw);
      let timestampStr: string;
      let timestamp: number;

      // Parse timestamp
      const messageTimestampMatch = message.match(/(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4})/);
      if (messageTimestampMatch) {
        const messageTimestamp = new Date(messageTimestampMatch[1]).getTime();
        if (!isNaN(messageTimestamp)) {
          timestamp = messageTimestamp;
          timestampStr = messageTimestampMatch[1];
        } else {
          ({ timestamp, timestampStr } = parseTimestamp(dateFormat, date, time));
        }
      } else {
        ({ timestamp, timestampStr } = parseTimestamp(dateFormat, date, time));
      }

      const cleaned = cleanupLogEntry(component, message.trim());
      let specialTag = '';
      if (message.includes('MEDIA_TIMEOUT') || line.includes('MEDIA_TIMEOUT')) specialTag += '[MEDIA_TIMEOUT] ';
      if (line.includes('X-Recovery: true') || message.includes('X-Recovery: true')) specialTag += '[RECOVERED] ';
      if (specialTag) cleaned.displayMessage = specialTag + cleaned.displayMessage;

      if (message.includes('[std-logger]')) cleaned.displayComponent = 'std-logger';

      currentLog = {
        ...makeEmptyLog(),
        timestamp: isNaN(timestamp) ? Date.now() : timestamp,
        rawTimestamp: timestampStr,
        level,
        component,
        displayComponent: cleaned.displayComponent,
        message: message.trim(),
        displayMessage: cleaned.displayMessage,
      };
    } else {
      // Continuation line
      if (currentLog) {
        currentLog.payload += (currentLog.payload ? '\n' : '') + line;
      }
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 2 * 1024 * 1024 });

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
        bytesRead += Buffer.byteLength(chunkStr, 'utf-8');
        const text = buffer + chunkStr;
        const lines = text.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      });

      stream.on('end', () => {
        // Process remaining buffer
        if (buffer.trim()) {
          if (currentLog) {
            currentLog.payload += (currentLog.payload ? '\n' : '') + buffer;
          }
        }
        // Finalize last log
        if (currentLog) {
          processLogPayload(currentLog);
          const callIdMatch = currentLog.message.match(/callId[=:]\s*([^\s;,\[\]\(\)]+)/i) || currentLog.message.match(/Call-ID:\s*([^\s]+)/i);
          if (callIdMatch && !currentLog.callId) currentLog.callId = callIdMatch[1].trim();
          batch.push(currentLog);
        }
        flushBatch();
        resolve();
      });

      stream.on('error', reject);
    });

    db.run(`UPDATE jobs SET status = 'complete', total_parsed = ?, progress = 1, completed_at = ? WHERE id = ?`, [totalParsed, Date.now(), jobId]);
    saveDb();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.run(`UPDATE jobs SET status = 'error', error = ? WHERE id = ?`, [message, jobId]);
    saveDb();
    throw err;
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

// ─── Timestamp parsing helper ────────────────────────────────────────────────

function parseTimestamp(dateFormat: string, date: string, time: string): { timestamp: number; timestampStr: string } {
  let timestampStr: string;
  let timestamp: number;

  if (dateFormat === 'iso') {
    timestampStr = `${date} ${time}`;
    const isoString = `${date}T${time.replace(',', '.')}`;
    timestamp = new Date(isoString).getTime();
  } else {
    let timeWithoutMs = time;
    let milliseconds = 0;
    const msMatch = time.match(/(.+?),\s*(\d+)$/);
    if (msMatch) {
      timeWithoutMs = msMatch[1].trim();
      milliseconds = parseInt(msMatch[2], 10);
    }
    timestampStr = `${date} ${time}`;
    const baseTimestamp = new Date(`${date} ${timeWithoutMs}`).getTime();
    timestamp = !isNaN(baseTimestamp) ? baseTimestamp + milliseconds : NaN;
  }

  return { timestamp, timestampStr };
}
