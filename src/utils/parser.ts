import type { LogEntry, LogLevel } from '../types';
import { fileStream } from '../services/fileStream';
import {
    isBrowserImportFile,
    readImportFileSliceText,
    readImportFileText,
    toBrowserImportFile,
} from '../services/importFileSource';
import type { ImportFileSource } from '../services/importFileSource';
import { cleanupLogEntry } from './messageCleanup';
import { dbManager } from './indexedDB';
import { formatLogTimestamp } from './logTimestamp';
import Papa from 'papaparse';

/**
 * Log Parser for LogScrub
 * 
 * Supports multiple log formats:
 * 1. Original: [LEVEL] [MM/DD/YYYY, time] [component]: message
 * 2. ISO Date: [LEVEL] [YYYY-MM-DD HH:MM:SS,mmm] [component] message
 * 3. Homer SIP Export: Text format with session metadata and SIP messages
 */

/**
 * Normalize log level strings to standard LogLevel values
 * Handles case-insensitivity and alternative level names (CRITICAL, FATAL, SEVERE, ERR, etc.)
 */
function normalizeLogLevel(level: string): LogLevel {
    const upper = level.toUpperCase().trim();
    
    // Map alternative ERROR names
    if (['ERROR', 'ERR', 'CRITICAL', 'FATAL', 'SEVERE', 'FAILURE', 'FAIL'].includes(upper)) {
        return 'ERROR';
    }
    // Map alternative WARN names
    if (['WARN', 'WARNING', 'CAUTION'].includes(upper)) {
        return 'WARN';
    }
    // Map alternative DEBUG names
    if (['DEBUG', 'TRACE', 'VERBOSE', 'FINE', 'FINER', 'FINEST'].includes(upper)) {
        return 'DEBUG';
    }
    // Default to INFO for INFO and any unrecognized levels
    if (['INFO', 'INFORMATION', 'NOTICE', 'LOG'].includes(upper)) {
        return 'INFO';
    }
    
    // Fallback: try to infer from partial matches
    if (upper.includes('ERR') || upper.includes('FATAL') || upper.includes('CRIT')) {
        return 'ERROR';
    }
    if (upper.includes('WARN')) {
        return 'WARN';
    }
    if (upper.includes('DEBUG') || upper.includes('TRACE')) {
        return 'DEBUG';
    }
    
    return 'INFO'; // Default fallback
}

const OPERATOR_CLIENT_HEADER_REGEX = /^\[(ERROR|WARN|INFO|DEBUG)\] \[(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}:\d{2} (?:AM|PM)),(\d{1,3})\] \[([^\]]+)\]: (.*)$/;
const OPERATOR_CLIENT_HEADER_PREFIX_REGEX = /^\[(ERROR|WARN|INFO|DEBUG)\]/;
const OPERATOR_CLIENT_SNIFF_BYTES = 64 * 1024;
const UTF8_ENCODER = new TextEncoder();
const OPERATOR_CLIENT_TRACE_ID_PATHS = ['traceId', 'trace_id', 'trace.id'] as const;
const OPERATOR_CLIENT_STATION_ID_PATHS = ['cpeStation.id', 'station.id', 'stationId'] as const;
const OPERATOR_CLIENT_CNC_ID_PATHS = ['cpeUser.cncID', 'cnc.id', 'cncID'] as const;
const OPERATOR_CLIENT_CALL_ID_PATHS = ['callId', 'call_id', 'call.id', 'Call-ID'] as const;
const OPERATOR_CLIENT_OPERATOR_ID_PATHS = ['operator.id', 'operatorId', 'cpeUser.operatorId'] as const;
const OPERATOR_CLIENT_EXTENSION_ID_PATHS = ['extension.id', 'extensionId', 'cpeUser.extensionId'] as const;

interface OperatorClientLine {
    text: string;
    byteOffset: number;
    lineNumber: number;
}

interface OperatorClientState {
    currentLog: LogEntry | null;
    bodyLines: string[];
    nextId: number;
    warnedMalformedHeader: boolean;
    sourceTimezone: string;
}

interface OperatorClientBufferedLineState {
    buffer: string;
    bufferStartByteOffset: number;
    nextLineNumber: number;
}

interface ImportTextChunk {
    offset: number;
    nextOffset: number;
    text: string;
    isLast: boolean;
}

async function processImportFileChunks(
    file: ImportFileSource,
    chunkSize: number,
    onChunk: (chunk: ImportTextChunk) => Promise<void>,
): Promise<void> {
    if (!isBrowserImportFile(file)) {
        await fileStream.streamTextChunks(file.path, chunkSize, async (chunk) => {
            await onChunk({
                offset: chunk.offset,
                nextOffset: chunk.offset + chunk.byteLength,
                text: chunk.text,
                isLast: chunk.isLast,
            });
        });
        return;
    }

    let offset = 0;
    while (offset < file.size) {
        const nextOffset = Math.min(offset + chunkSize, file.size);
        const text = await file.slice(offset, nextOffset).text();
        await onChunk({
            offset,
            nextOffset,
            text,
            isLast: nextOffset >= file.size,
        });
        offset = nextOffset;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getHostTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function resolveOperatorClientTimeZone(timezone?: string): string {
    return timezone?.trim() || getHostTimeZone();
}

function getTimeZoneOffsetMilliseconds(epochMs: number, timeZone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(new Date(epochMs));
    const values: Partial<Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>> = {};

    for (const part of parts) {
        if (
            part.type === 'year' ||
            part.type === 'month' ||
            part.type === 'day' ||
            part.type === 'hour' ||
            part.type === 'minute' ||
            part.type === 'second'
        ) {
            values[part.type] = part.value;
        }
    }

    if (!values.year || !values.month || !values.day || !values.hour || !values.minute || !values.second) {
        return 0;
    }

    const zonedAsUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second),
    );

    return zonedAsUtc - (epochMs - (epochMs % 1000));
}

function isValidOperatorClientDate(year: number, month: number, day: number): boolean {
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function parseTimestampInTimeZone(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    millisecond: number,
    timeZone: string,
): number {
    try {
        const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
        let resolved = localAsUtc;

        for (let i = 0; i < 2; i++) {
            resolved = localAsUtc - getTimeZoneOffsetMilliseconds(resolved, timeZone);
        }

        return Number.isFinite(resolved) ? resolved : 0;
    } catch {
        return 0;
    }
}

function parseOperatorClientTimestamp(rawTimestamp: string, timeZone: string): number {
    const match = rawTimestamp.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM),(\d{1,3})$/,
    );
    if (!match) {
        return 0;
    }

    const [, monthRaw, dayRaw, yearRaw, hourRaw, minuteRaw, secondRaw, ampm, millisRaw] = match;
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const year = Number(yearRaw);
    const hour12 = Number(hourRaw);
    const minute = Number(minuteRaw);
    const second = Number(secondRaw);
    const millisecond = Number(millisRaw);

    if (
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        !Number.isInteger(year) ||
        !Number.isInteger(hour12) ||
        !Number.isInteger(minute) ||
        !Number.isInteger(second) ||
        !Number.isInteger(millisecond) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour12 < 1 ||
        hour12 > 12 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59 ||
        millisecond < 0 ||
        millisecond > 999 ||
        !isValidOperatorClientDate(year, month, day)
    ) {
        return 0;
    }

    let hour = hour12 % 12;
    if (ampm === 'PM') {
        hour += 12;
    }

    return parseTimestampInTimeZone(year, month, day, hour, minute, second, millisecond, timeZone);
}

export function getOperatorClientValueAtPath(source: unknown, path: string): string | undefined {
    const value = path.split('.').reduce<unknown>((current, segment) => {
        if (!isRecord(current)) {
            return undefined;
        }

        return current[segment];
    }, source);

    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function getFirstOperatorClientValue(
    source: unknown,
    paths: readonly string[],
): string | undefined {
    for (const path of paths) {
        const value = getOperatorClientValueAtPath(source, path);
        if (value !== undefined) {
            return value;
        }
    }

    return undefined;
}

function isOperatorClientLogText(text: string): boolean {
    const firstNonEmptyLine = text
        .split(/\r?\n/)
        .find((line) => line.trim().length > 0);

    return firstNonEmptyLine !== undefined && OPERATOR_CLIENT_HEADER_REGEX.test(firstNonEmptyLine);
}

function createOperatorClientState(startId: number, sourceTimezone: string): OperatorClientState {
    return {
        currentLog: null,
        bodyLines: [],
        nextId: startId,
        warnedMalformedHeader: false,
        sourceTimezone,
    };
}

function createOperatorClientEntry(
    level: LogLevel,
    rawTimestamp: string,
    component: string,
    messageHead: string,
    fileColor: string,
    fileName: string,
    lineNumber: number,
    byteOffset: number,
    sourceTimezone: string,
    id: number,
): LogEntry {
    const cleaned = cleanupLogEntry(component, messageHead);
    const timestamp = parseOperatorClientTimestamp(rawTimestamp, sourceTimezone);

    return {
        id,
        timestamp,
        rawTimestamp,
        displayTimestamp: formatLogTimestamp(timestamp),
        level,
        component,
        displayComponent: cleaned.displayComponent,
        message: messageHead,
        displayMessage: cleaned.displayMessage,
        payload: '',
        type: 'LOG',
        isSip: false,
        fileName,
        fileColor,
        sourceType: 'apex',
        sourceLabel: 'Operator Client',
        lineNumber,
        byteOffset,
        sourceTimezone,
        _messageLower: messageHead.toLowerCase(),
        _componentLower: component.toLowerCase(),
    };
}

function finalizeOperatorClientEntry(log: LogEntry, bodyLines: string[]): LogEntry {
    const rawBody = bodyLines.join('\n');
    const trimmedBody = rawBody.trim();

    log.payload = rawBody;
    log._payloadLower = rawBody.toLowerCase();

    if (!trimmedBody.startsWith('{') && !trimmedBody.startsWith('[')) {
        return log;
    }

    try {
        const parsed = JSON.parse(trimmedBody) as unknown;
        log.json = parsed;
        log.type = 'JSON';
        log.jsonMalformed = false;
        log.traceId = getFirstOperatorClientValue(parsed, OPERATOR_CLIENT_TRACE_ID_PATHS);
        log.stationId = getFirstOperatorClientValue(parsed, OPERATOR_CLIENT_STATION_ID_PATHS);
        log.cncID = getFirstOperatorClientValue(parsed, OPERATOR_CLIENT_CNC_ID_PATHS);
        log.callId = getFirstOperatorClientValue(parsed, OPERATOR_CLIENT_CALL_ID_PATHS);
        log.operatorId = getFirstOperatorClientValue(parsed, OPERATOR_CLIENT_OPERATOR_ID_PATHS);
        log.extensionId = getFirstOperatorClientValue(parsed, OPERATOR_CLIENT_EXTENSION_ID_PATHS);
        if (log.callId) {
            log._callIdLower = log.callId.toLowerCase();
        }
    } catch {
        log.jsonMalformed = true;
    }

    return log;
}

function flushOperatorClientState(state: OperatorClientState): LogEntry | null {
    if (state.currentLog === null) {
        return null;
    }

    const finalized = finalizeOperatorClientEntry(state.currentLog, state.bodyLines);
    state.currentLog = null;
    state.bodyLines = [];
    return finalized;
}

function processOperatorClientLine(
    state: OperatorClientState,
    line: OperatorClientLine,
    fileColor: string,
    fileName: string,
): LogEntry | null {
    const headerMatch = line.text.match(OPERATOR_CLIENT_HEADER_REGEX);
    if (headerMatch) {
        const finalized = flushOperatorClientState(state);
        const [, levelRaw, datePart, timePart, millisPart, component, messageHeadRaw] = headerMatch;
        const rawTimestamp = `${datePart}, ${timePart},${millisPart}`;
        const messageHead = messageHeadRaw.trim();
        state.currentLog = createOperatorClientEntry(
            normalizeLogLevel(levelRaw),
            rawTimestamp,
            component,
            messageHead,
            fileColor,
            fileName,
            line.lineNumber,
            line.byteOffset,
            state.sourceTimezone,
            state.nextId,
        );
        state.nextId += 1;
        return finalized;
    }

    if (state.currentLog !== null) {
        if (!state.warnedMalformedHeader && OPERATOR_CLIENT_HEADER_PREFIX_REGEX.test(line.text)) {
            console.warn(`Malformed Operator Client header treated as body in ${fileName}`);
            state.warnedMalformedHeader = true;
        }
        state.bodyLines.push(line.text);
    }

    return null;
}

function splitTextIntoOperatorClientLines(text: string): OperatorClientLine[] {
    const lines: OperatorClientLine[] = [];
    let byteOffset = 0;
    let lineNumber = 1;

    for (const match of text.matchAll(/([^\r\n]*)(\r\n|\n|$)/g)) {
        const fullMatch = match[0];
        if (fullMatch.length === 0) {
            break;
        }

        const lineText = match[1];
        const lineEnding = match[2];
        lines.push({
            text: lineText,
            byteOffset,
            lineNumber,
        });
        byteOffset += UTF8_ENCODER.encode(fullMatch).length;
        lineNumber += 1;

        if (lineEnding.length === 0) {
            break;
        }
    }

    return lines;
}

function createOperatorClientBufferedLineState(): OperatorClientBufferedLineState {
    return {
        buffer: '',
        bufferStartByteOffset: 0,
        nextLineNumber: 1,
    };
}

function processBufferedOperatorClientChunk(
    streamState: OperatorClientBufferedLineState,
    chunkText: string,
    isFinalChunk: boolean,
    onLine: (line: OperatorClientLine) => void,
): void {
    const textToProcess = streamState.buffer + chunkText;
    let lineByteOffset = streamState.bufferStartByteOffset;
    let retainedBuffer = '';
    let retainedBufferOffset = lineByteOffset;

    for (const match of textToProcess.matchAll(/([^\r\n]*)(\r\n|\n|$)/g)) {
        const fullMatch = match[0];
        if (fullMatch.length === 0) {
            break;
        }

        const lineText = match[1];
        const lineEnding = match[2];

        if (lineEnding.length === 0 && !isFinalChunk) {
            retainedBuffer = lineText;
            retainedBufferOffset = lineByteOffset;
            break;
        }

        onLine({
            text: lineText,
            byteOffset: lineByteOffset,
            lineNumber: streamState.nextLineNumber,
        });
        lineByteOffset += UTF8_ENCODER.encode(fullMatch).length;
        streamState.nextLineNumber += 1;

        if (lineEnding.length === 0) {
            retainedBuffer = '';
            retainedBufferOffset = lineByteOffset;
            break;
        }
    }

    streamState.buffer = retainedBuffer;
    streamState.bufferStartByteOffset = retainedBuffer ? retainedBufferOffset : lineByteOffset;
}

export function parseOperatorClientLog(
    text: string,
    fileColor: string,
    startId: number,
    fileName: string,
    timezone?: string,
): LogEntry[] {
    const logs: LogEntry[] = [];
    const state = createOperatorClientState(startId, resolveOperatorClientTimeZone(timezone));

    for (const line of splitTextIntoOperatorClientLines(text)) {
        const finalized = processOperatorClientLine(state, line, fileColor, fileName);
        if (finalized !== null) {
            logs.push(finalized);
        }
    }

    const finalEntry = flushOperatorClientState(state);
    if (finalEntry !== null) {
        logs.push(finalEntry);
    }

    return logs;
}

/**
 * Detect log level from SIP response code
 * 4xx = Client errors (WARN), 5xx = Server errors (ERROR), 6xx = Global failures (ERROR)
 */
function getSipResponseLevel(sipMethod: string | null | undefined): LogLevel | null {
    if (!sipMethod) return null;
    
    const codeMatch = sipMethod.match(/^(\d{3})/);
    if (!codeMatch) return null;
    
    const code = parseInt(codeMatch[1], 10);
    
    // 1xx Provisional - INFO
    // 2xx Success - INFO
    // 3xx Redirection - INFO
    // 4xx Client Error - WARN (client-side issues, not server errors)
    // 5xx Server Error - ERROR
    // 6xx Global Failure - ERROR
    if (code >= 400 && code < 500) {
        return 'WARN';
    }
    if (code >= 500) {
        return 'ERROR';
    }
    
    return null; // Keep original level for 1xx, 2xx, 3xx
}

/**
 * Detect whether a CSV is a Carbyne Call Log (vs Datadog extract).
 * Call logs start with: ID,Created,Phone,Last Estimated Address,...
 */
function isCallLogCSV(firstLine: string): boolean {
    const lower = firstLine.toLowerCase();
    return lower.includes('id,created,phone') || (lower.includes('termination reason') && lower.includes('station'));
}

/**
 * Parse Carbyne APEX Call Log CSV format.
 * Columns: ID, Created, Phone, Last Estimated Address, Last Estimated Coordinates,
 *   Duration, Termination Reason, Station, Location, Audio, Video, Chat,
 *   Questionnaire, Images, Intelligence, Transcript, Type, Queue Name,
 *   Agent Name, Agent ID, Waiting Time, Triaged, Triaged Voluntary,
 *   Misrouted, Discrepancy Report, Translated
 *
 * Each row becomes a LogEntry so it can be correlated with other log sources.
 */
const parseCallLogCSV = (text: string, fileColor: string, startId: number): LogEntry[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const parsedLogs: LogEntry[] = [];
    let idCounter = startId;

    // Parse header to find column indices
    const headers = lines[0].split(',').map(h => h.trim());
    const col = (name: string): number => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

    const iId = col('ID');
    const iCreated = col('Created');
    const iPhone = col('Phone');
    const iDuration = col('Duration');
    const iTermReason = col('Termination Reason');
    const iStation = col('Station');
    const iType = col('Type');
    const iQueue = col('Queue Name');
    const iAgent = col('Agent Name');
    const iAgentId = col('Agent ID');
    const iWaiting = col('Waiting Time');
    const iAddress = col('Last Estimated Address');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV split (call log CSVs don't have quoted fields with commas)
        const cols = line.split(',');
        const get = (idx: number): string => (idx >= 0 && idx < cols.length) ? cols[idx].trim() : '';

        const callId = get(iId);
        const created = get(iCreated);
        const phone = get(iPhone);
        const duration = get(iDuration);
        const termReason = get(iTermReason);
        const station = get(iStation);
        const callType = get(iType);
        const queue = get(iQueue);
        const agent = get(iAgent);
        const agentId = get(iAgentId);
        const waiting = get(iWaiting);
        const address = get(iAddress);

        if (!callId || !created) continue;

        // Parse timestamp: "Mar-28-2026 19:01:04"
        const timestamp = new Date(created.replace(/-/g, ' ')).getTime();
        if (isNaN(timestamp)) continue;

        // Determine level based on termination reason
        let level: LogLevel = 'INFO';
        const termLower = termReason.toLowerCase();
        if (termLower.includes('abandon') || termLower.includes('missed') || termLower.includes('fail')) {
            level = 'WARN';
        }
        if (duration === '0:00:00' && termLower !== 'agent ended call') {
            level = 'WARN'; // Zero-duration calls are suspicious
        }

        // Build readable message
        const message = `Call #${callId} | ${callType} | ${phone} → ${queue} | Agent: ${agent || 'N/A'} | Station: ${station} | Duration: ${duration} | ${termReason}`;

        // Build payload with all fields for deep inspection
        const payloadParts: string[] = [
            `Call ID: ${callId}`,
            `Created: ${created}`,
            `Phone: ${phone}`,
            `Type: ${callType}`,
            `Queue: ${queue}`,
            `Agent: ${agent} (ID: ${agentId})`,
            `Station: ${station}`,
            `Duration: ${duration}`,
            `Waiting Time: ${waiting}`,
            `Termination: ${termReason}`,
        ];
        if (address) payloadParts.push(`Address: ${address}`);

        const entry: LogEntry = {
            id: idCounter++,
            timestamp,
            rawTimestamp: created,
            displayTimestamp: formatLogTimestamp(timestamp),
            level,
            component: 'Call Log',
            displayComponent: 'Call Log',
            message,
            displayMessage: message,
            payload: payloadParts.join('\n'),
            type: 'LOG',
            isSip: false,
            stationId: station || undefined,
            fileName: 'call-log.csv',
            fileColor,
            sourceType: 'apex',
            _messageLower: message.toLowerCase(),
            _componentLower: 'call log',
        };

        // Pre-compute lowercase payload
        entry._payloadLower = entry.payload.toLowerCase();

        parsedLogs.push(entry);
    }

    return parsedLogs;
};

/**
 * Parse Datadog CSV export format
 * CSV Format: Date,Host,Service,Content
 * Content field contains JSON with nested log data
 */
const parseDatadogCSV = (text: string, fileColor: string, startId: number): LogEntry[] => {
    const lines = text.split(/\r?\n/);
    const parsedLogs: LogEntry[] = [];
    let idCounter = startId;

    // Skip header row (Date,Host,Service,Content)
    // Handle multiline CSV: content JSON may span lines if it contains newlines
    // Reassemble lines that are part of the same CSV row (detect by opening/closing quotes)
    const csvRows: string[] = [];
    let accumulator = '';
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        if (accumulator) {
            // We're in the middle of a multiline row
            accumulator += '\n' + line;
            // Check if this line completes the row (ends with closing quote)
            if (line.trimEnd().endsWith('"')) {
                csvRows.push(accumulator);
                accumulator = '';
            }
        } else if (line.startsWith('"') && !line.trimEnd().endsWith('"')) {
            // Start of a multiline row
            accumulator = line;
        } else {
            csvRows.push(line);
        }
    }
    if (accumulator) csvRows.push(accumulator); // flush any remaining

    for (let i = 0; i < csvRows.length; i++) {
        const line = csvRows[i].trim();
        if (!line) continue;

        try {
            // Parse CSV line - handle quoted fields (may contain newlines now)
            const csvMatch = line.match(/^"([^"]+)","([^"]+)","([^"]+)","([\s\S]+)"$/);
            if (!csvMatch) continue;

            const [, isoDate, host, service, contentJson] = csvMatch;

            // Parse the JSON content (need to unescape double quotes)
            const unescapedJson = contentJson.replace(/""/g, '"');
            const content = JSON.parse(unescapedJson);

            if (!content.log) continue;

            const log = content.log;

            // Extract log data from the nested structure
            const timestamp = new Date(isoDate).getTime();
            const level: LogLevel = normalizeLogLevel(log.logLevel || 'INFO');
            const component = log.logSource || service || 'Unknown';
            const message = log.message || '';
            const rawTimestamp = log.timestamp || isoDate;

            // Build payload from additional data
            let payload = '';
            if (log.machineData) {
                payload += `Machine: ${log.machineData.name || ''}\n`;
                payload += `Stack: ${log.machineData.stack || ''}\n`;
                payload += `Call Center: ${log.machineData.callCenterName || ''}\n`;
            }

            // Add thread name if available
            if (log.threadName) {
                payload += `Thread: ${log.threadName}\n`;
            }

            // Add exception/stack trace if available
            if (log.optionCause) {
                payload += `\nException:\n${log.optionCause}`;
            }

            // Clean up component and message
            const cleanupResult = cleanupLogEntry(component, message);

            const entry: LogEntry = {
                id: idCounter++,
                timestamp,
                rawTimestamp,
                displayTimestamp: formatLogTimestamp(timestamp),
                level,
                component,
                displayComponent: cleanupResult.displayComponent,
                message,
                displayMessage: cleanupResult.displayMessage,
                payload: payload.trim(),
                type: 'LOG',
                isSip: false,
                fileName: `${host}-${service}`,
                fileColor,
                sourceType: 'datadog',
                sourceLabel: `DD:${component}`,
            };

            // Extract CNC and station/operator info from machineData
            if (log.machineData) {
                if (log.machineData.callCenterName) {
                    entry.cncID = String(log.machineData.callCenterName);
                }
                if (log.machineData.name) {
                    entry.stationId = String(log.machineData.name);
                }
            }

            // Extract correlation IDs from message
            // Fix: Use more permissive regex to match various Call-ID formats and trim whitespace
            // Matches: callId=value, callId:value, Call-ID:value (case insensitive)
            const callIdMatch = message.match(/callId[=:]\s*([^\s;,()[\]]+)/i) || message.match(/Call-ID:\s*([^\s]+)/i);
            if (callIdMatch) {
                const extractedCallId = callIdMatch[1].trim(); // Fix: Trim whitespace for consistent comparison
                entry.callId = extractedCallId;
                // Phase 2 Optimization: Pre-compute lowercase callId
                entry._callIdLower = extractedCallId.toLowerCase();
            }

            const extensionMatch = message.match(/extensionID:\s*Optional\[(\d+)\]/);
            if (extensionMatch) {
                entry.extensionId = extensionMatch[1];
            }

            // Phase 2 Optimization: Pre-compute lowercase strings for CSV entries
            entry._messageLower = message.toLowerCase();
            entry._componentLower = component.toLowerCase();
            if (payload) {
                entry._payloadLower = payload.toLowerCase();
            }

            parsedLogs.push(entry);

        } catch (error) {
            console.warn(`Failed to parse CSV line ${i}:`, error);
            continue;
        }
    }

    return parsedLogs;
};

/**
 * Parse Homer SIP capture export format
 * Format: Session metadata followed by SIP messages delimited by "----- MESSAGE"
 * Each message has: Timestamp, Direction, Protocol, Raw SIP content
 */
const parseHomerText = (text: string, fileColor: string, startId: number, fileName: string = 'homer-export'): LogEntry[] => {
    const parsedLogs: LogEntry[] = [];
    let idCounter = startId;

    const lines = text.split(/\r?\n/);
    let currentMessage: string[] = [];
    let currentTimestamp: number | null = null;
    let currentTimestampStr: string = '';
    let currentDirection: string = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this is a proto: header line (starts new message)
        // Format: proto:PROTOCOL TIMESTAMP SOURCE ---> DESTINATION
        // Example: proto:TCP 2026-01-09T22:46:45.367125Z  10.20.137.235:14632 ---> 10.20.153.78:5070
        const protoMatch = trimmed.match(/^proto:(\S+)\s+(\S+)\s+(\S+)\s*(--->|&lt;---)\s*(\S+)/i);
        if (protoMatch) {
            // If we have a previous message, process it
            if (currentMessage.length > 0 && currentTimestamp !== null) {
                const sipPayload = currentMessage.join('\n');
                const firstLine = currentMessage[0] || '';
                
                // Create message summary from first line
                let message = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
                if (currentDirection) {
                    message = `[${currentDirection}] ${message}`;
                }

                // Create log entry
                const entry: LogEntry = {
                    id: idCounter++,
                    timestamp: currentTimestamp,
                    rawTimestamp: currentTimestampStr,
                    displayTimestamp: formatLogTimestamp(currentTimestamp),
                    level: 'INFO' as LogLevel, // Will be updated based on SIP response code
                    component: 'Homer SIP',
                    displayComponent: 'Homer SIP',
                    message,
                    displayMessage: message,
                    payload: sipPayload,
                    type: 'LOG',
                    isSip: true,
                    sipMethod: null,
                    fileName: fileName,
                    fileColor,
                    sourceLabel: 'Homer SIP',
                    _messageLower: message.toLowerCase(),
                    _componentLower: 'homer sip'
                };

                // Process SIP payload to extract Call-ID, methods, etc.
                processLogPayload(entry);

                // Update level based on SIP response code (4xx=WARN, 5xx/6xx=ERROR)
                const sipLevel = getSipResponseLevel(entry.sipMethod);
                if (sipLevel) {
                    entry.level = sipLevel;
                }

                parsedLogs.push(entry);
            }

            // Start new message
            const [, , timestampStr, source, directionArrow, destination] = protoMatch;
            currentTimestampStr = timestampStr;
            const parsedTimestamp = new Date(timestampStr).getTime();
            currentTimestamp = !isNaN(parsedTimestamp) ? parsedTimestamp : null;
            
            // Determine direction from arrow
            currentDirection = directionArrow === '--->' 
                ? `${source} → ${destination}` 
                : directionArrow === '&lt;---'
                    ? `${destination} ← ${source}`
                    : '';
            
            currentMessage = [];
            continue;
        }

        // Collect SIP message lines (skip blank line after proto header, collect everything else until next proto:)
        if (currentTimestamp !== null) {
            // Skip the blank line immediately after proto header
            if (currentMessage.length === 0 && !trimmed) {
                continue;
            }
            // Collect all lines until we hit the next proto: header
            if (trimmed || currentMessage.length > 0) {
                currentMessage.push(line);
            }
        }
    }

    // Process the last message if file doesn't end with a proto: line
    if (currentMessage.length > 0 && currentTimestamp !== null) {
        const sipPayload = currentMessage.join('\n');
        const firstLine = currentMessage[0] || '';
        
        let message = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
        if (currentDirection) {
            message = `[${currentDirection}] ${message}`;
        }

        const entry: LogEntry = {
            id: idCounter++,
            timestamp: currentTimestamp,
            rawTimestamp: currentTimestampStr,
            displayTimestamp: formatLogTimestamp(currentTimestamp),
            level: 'INFO' as LogLevel, // Will be updated based on SIP response code
            component: 'Homer SIP',
            displayComponent: 'Homer SIP',
            message,
            displayMessage: message,
            payload: sipPayload,
            type: 'LOG',
            isSip: true,
            sipMethod: null,
            fileName: fileName,
            fileColor,
            sourceLabel: 'Homer SIP',
            _messageLower: message.toLowerCase(),
            _componentLower: 'homer sip'
        };

        processLogPayload(entry);

        // Update level based on SIP response code (4xx=WARN, 5xx/6xx=ERROR)
        const sipLevel = getSipResponseLevel(entry.sipMethod);
        if (sipLevel) {
            entry.level = sipLevel;
        }

        parsedLogs.push(entry);
    }

    return parsedLogs;
};

/**
 * Streaming parser that processes file chunks line-by-line without accumulating full text
 * This prevents memory exhaustion on large files (e.g., 740MB+)
 */
async function parseOperatorClientLogStreaming(
    file: ImportFileSource,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void,
    timezone?: string,
): Promise<LogEntry[]> {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const fileSize = file.size;
    const logs: LogEntry[] = [];
    const state = createOperatorClientState(startId, resolveOperatorClientTimeZone(timezone));
    const lineState = createOperatorClientBufferedLineState();
    let chunkCount = 0;
    const YIELD_INTERVAL = 5;

    await processImportFileChunks(file, CHUNK_SIZE, async ({ text, nextOffset, isLast }) => {
        chunkCount += 1;

        processBufferedOperatorClientChunk(
            lineState,
            text,
            isLast,
            (line) => {
                const finalized = processOperatorClientLine(state, line, fileColor, file.name);
                if (finalized !== null) {
                    logs.push(finalized);
                }
            },
        );

        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (onProgress) {
            const progress = 0.1 + (Math.min(nextOffset, fileSize) / fileSize) * 0.85;
            onProgress(Math.min(progress, 0.95));
        }
    });

    const finalEntry = flushOperatorClientState(state);
    if (finalEntry !== null) {
        logs.push(finalEntry);
    }

    if (onProgress) {
        onProgress(1.0);
    }

    return logs;
}

async function parseOperatorClientLogStreamingToIndexedDB(
    file: ImportFileSource,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void,
    timezone?: string,
): Promise<{ totalParsed: number; minTimestamp: number; maxTimestamp: number }> {
    await dbManager.init();

    const CHUNK_SIZE = 2 * 1024 * 1024;
    const BATCH_SIZE = 500;
    const fileSize = file.size;
    const state = createOperatorClientState(startId, resolveOperatorClientTimeZone(timezone));
    const lineState = createOperatorClientBufferedLineState();
    let chunkCount = 0;
    let batch: LogEntry[] = [];
    let totalParsed = 0;
    let minTimestamp = Infinity;
    let maxTimestamp = -Infinity;
    const YIELD_INTERVAL = 5;

    const writeBatch = async (): Promise<void> => {
        if (batch.length === 0) {
            return;
        }

        await dbManager.addLogsBatch(batch);
        totalParsed += batch.length;
        batch = [];
    };

    const enqueueEntry = async (entry: LogEntry): Promise<void> => {
        batch.push(entry);
        if (entry.timestamp < minTimestamp) minTimestamp = entry.timestamp;
        if (entry.timestamp > maxTimestamp) maxTimestamp = entry.timestamp;

        if (batch.length >= BATCH_SIZE) {
            await writeBatch();
        }
    };

    await processImportFileChunks(file, CHUNK_SIZE, async ({ text, nextOffset, isLast }) => {
        chunkCount += 1;

        const finalizedEntries: LogEntry[] = [];
        processBufferedOperatorClientChunk(
            lineState,
            text,
            isLast,
            (line) => {
                const finalized = processOperatorClientLine(state, line, fileColor, file.name);
                if (finalized !== null) {
                    finalizedEntries.push(finalized);
                }
            },
        );

        for (const entry of finalizedEntries) {
            await enqueueEntry(entry);
        }

        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (onProgress) {
            const progress = 0.1 + (Math.min(nextOffset, fileSize) / fileSize) * 0.85;
            onProgress(Math.min(progress, 0.95));
        }
    });

    const finalEntry = flushOperatorClientState(state);
    if (finalEntry !== null) {
        await enqueueEntry(finalEntry);
    }

    await writeBatch();

    const existingMetadata = await dbManager.getMetadata();
    const existingFileNames = existingMetadata?.fileNames || [];
    if (!existingFileNames.includes(file.name)) {
        existingFileNames.push(file.name);
    }

    await dbManager.updateMetadata({
        totalLogs: (existingMetadata?.totalLogs || 0) + totalParsed,
        fileNames: existingFileNames,
        dateRange: {
            min: Math.min(existingMetadata?.dateRange.min || Infinity, minTimestamp === Infinity ? 0 : minTimestamp),
            max: Math.max(existingMetadata?.dateRange.max || -Infinity, maxTimestamp === -Infinity ? 0 : maxTimestamp),
        },
    });

    if (onProgress) {
        onProgress(1.0);
    }

    return { totalParsed, minTimestamp, maxTimestamp };
}

export const parseLogFileStreaming = async (
    file: ImportFileSource,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void,
    timezone?: string,
): Promise<LogEntry[]> => {
    const ocSniff = await readImportFileSliceText(file, 0, Math.min(OPERATOR_CLIENT_SNIFF_BYTES, file.size));
    if (isOperatorClientLogText(ocSniff)) {
        return parseOperatorClientLogStreaming(file, fileColor, startId, onProgress, timezone);
    }

    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for better performance
    const fileSize = file.size;
    const parsedLogs: LogEntry[] = [];
    let idCounter = startId;
    let buffer = ''; // Buffer for incomplete lines at chunk boundaries
    let chunkCount = 0;
    const YIELD_INTERVAL = 5; // Yield every 5 chunks
    
    // Regex patterns - case insensitive, supports alternative level names
    // Matches: INFO, DEBUG, ERROR, WARN, CRITICAL, FATAL, SEVERE, ERR, WARNING, TRACE, etc.
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/i;
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/i;
    
    let currentLog: LogEntry | null = null;
    let payloadLines: string[] = [];
    let lineCount = 0;
    const YIELD_EVERY_N_LINES = 5000; // Yield every 5000 lines

    await processImportFileChunks(file, CHUNK_SIZE, async ({ text, nextOffset }) => {
        chunkCount++;

        // Combine buffer with new chunk
        const textToProcess = buffer + text;

        // Split into lines, keeping last incomplete line in buffer
        const lines = textToProcess.split(/\r?\n/);
        buffer = lines.pop() || ''; // Last line might be incomplete

        // Process complete lines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            lineCount++;

            // Yield control periodically
            if (lineCount % YIELD_EVERY_N_LINES === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (onProgress) {
                    const progress = 0.1 + (nextOffset / fileSize) * 0.8;
                    onProgress(Math.min(progress, 0.95));
                }
            }

            if (!line.trim()) continue; // Skip empty lines

            let match = line.match(logRegex1);
            let dateFormat = 'original';

            if (!match) {
                match = line.match(logRegex2);
                dateFormat = 'iso';
            }

            if (match) {
                // Push previous log if exists
                if (currentLog) {
                    if (payloadLines.length > 0) {
                        currentLog.payload = payloadLines.join("\n");
                        payloadLines = [];
                    }
                    processLogPayload(currentLog);
                    parsedLogs.push(currentLog);
                }

                const [, levelRaw, date, time, component, message] = match;
                const level = normalizeLogLevel(levelRaw); // Normalize level (case-insensitive, aliases)
                let timestampStr: string;
                let timestamp: number;

                // Parse timestamp (same logic as main parser)
                const messageTimestampMatch = message.match(/(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4})/);
                
                if (messageTimestampMatch) {
                    try {
                        const messageTimestamp = new Date(messageTimestampMatch[1]).getTime();
                        if (!isNaN(messageTimestamp)) {
                            timestamp = messageTimestamp;
                            timestampStr = messageTimestampMatch[1];
                        } else {
                            throw new Error('Invalid timestamp');
                        }
                    } catch {
                        if (dateFormat === 'iso') {
                            timestampStr = `${date} ${time}`;
                            const isoString = `${date}T${time.replace(',', '.')}`;
                            timestamp = new Date(isoString).getTime();
                        } else {
                            timestampStr = `${date} ${time}`;
                            timestamp = new Date(timestampStr).getTime();
                        }
                    }
                } else {
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
                        
                        if (!isNaN(baseTimestamp)) {
                            timestamp = baseTimestamp + milliseconds;
                        } else {
                            timestamp = NaN;
                        }
                    }
                }

                const cleaned = cleanupLogEntry(component, message.trim());
                if (message.includes('[std-logger]')) {
                    cleaned.displayComponent = 'std-logger';
                }

                let specialTag = "";
                if (message.includes('MEDIA_TIMEOUT') || line.includes('MEDIA_TIMEOUT')) {
                    specialTag += "⚠️ [MEDIA_TIMEOUT] ";
                }
                if (line.includes('X-Recovery: true') || message.includes('X-Recovery: true')) {
                    specialTag += "🔄 [RECOVERED] ";
                }
                if (specialTag) {
                    cleaned.displayMessage = specialTag + cleaned.displayMessage;
                }

                const trimmedMessage = message.trim();
                const resolvedTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
                currentLog = {
                    id: idCounter++,
                    timestamp: resolvedTimestamp,
                    rawTimestamp: timestampStr,
                    displayTimestamp: formatLogTimestamp(resolvedTimestamp),
                    level: level,
                    component,
                    displayComponent: cleaned.displayComponent,
                    message: trimmedMessage,
                    displayMessage: cleaned.displayMessage,
                    payload: "",
                    type: "LOG",
                    isSip: false,
                    sipMethod: null,
                    fileName: file.name,
                    fileColor: fileColor,
                    _messageLower: trimmedMessage.toLowerCase(),
                    _componentLower: component.toLowerCase()
                };
            } else {
                // Continuation line
                if (currentLog) {
                    payloadLines.push(line);
                    currentLog._payloadLower = undefined;
                }
            }
        }

        // Yield control periodically
        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    });

    // Process remaining buffer as final line
    if (buffer.trim() && currentLog) {
        payloadLines.push(buffer);
    }

    // Push last log
    const finalLog = currentLog as LogEntry | null;
    if (finalLog) {
        if (payloadLines.length > 0) {
            finalLog.payload = payloadLines.join("\n");
            payloadLines = [];
        }
        processLogPayload(finalLog);
        parsedLogs.push(finalLog);
    }

    if (onProgress) onProgress(0.95);

    // Sort by timestamp
    parsedLogs.sort((a, b) => a.timestamp - b.timestamp);

    if (onProgress) onProgress(1.0);

    return parsedLogs;
};

/**
 * Read file in chunks to prevent memory exhaustion on large files
 * Processes file incrementally and yields control to prevent tab freezing
 * @deprecated Use parseLogFileStreaming for large files instead
 */
const readFileInChunks = async (file: ImportFileSource): Promise<string> => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    let fullText = '';
    let chunkCount = 0;
    const YIELD_INTERVAL = 10; // Yield every 10 chunks to keep UI responsive

    await processImportFileChunks(file, CHUNK_SIZE, async ({ text }) => {
        fullText += text;
        chunkCount++;

        // Yield control to browser periodically to prevent tab freezing
        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    });

    return fullText;
};

/**
 * Streaming parser that writes directly to IndexedDB instead of accumulating in memory
 * This is the preferred method for large files as it prevents memory exhaustion
 */
const parseLogFileStreamingToIndexedDB = async (
    file: ImportFileSource,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void,
    timezone?: string,
): Promise<{ totalParsed: number; minTimestamp: number; maxTimestamp: number }> => {
    const ocSniff = await readImportFileSliceText(file, 0, Math.min(OPERATOR_CLIENT_SNIFF_BYTES, file.size));
    if (isOperatorClientLogText(ocSniff)) {
        return parseOperatorClientLogStreamingToIndexedDB(file, fileColor, startId, onProgress, timezone);
    }

    // Initialize IndexedDB
    await dbManager.init();
    
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
    const BATCH_SIZE = 500; // Write to IndexedDB in batches of 500
    const fileSize = file.size;
    let idCounter = startId;
    let buffer = '';
    let chunkCount = 0;
    const YIELD_INTERVAL = 5;
    
    // Regex patterns - case insensitive, supports alternative level names
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/i;
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/i;
    
    let currentLog: LogEntry | null = null;
    let payloadLines: string[] = [];
    let batch: LogEntry[] = [];
    let totalParsed = 0;
    let minTimestamp = Infinity;
    let maxTimestamp = -Infinity;
    let lineCount = 0;
    const YIELD_EVERY_N_LINES = 5000;

    // Helper function to write batch to IndexedDB
    const writeBatch = async () => {
        if (batch.length > 0) {
            await dbManager.addLogsBatch(batch);
            totalParsed += batch.length;
            batch = [];
        }
    };

    await processImportFileChunks(file, CHUNK_SIZE, async ({ text, nextOffset }) => {
        chunkCount++;

        const textToProcess = buffer + text;
        const lines = textToProcess.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            lineCount++;

            if (lineCount % YIELD_EVERY_N_LINES === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (onProgress) {
                    const progress = 0.1 + (nextOffset / fileSize) * 0.8;
                    onProgress(Math.min(progress, 0.95));
                }
            }

            if (!line.trim()) continue;

            let match = line.match(logRegex1);
            let dateFormat = 'original';

            if (!match) {
                match = line.match(logRegex2);
                dateFormat = 'iso';
            }

            if (match) {
                // Write previous log if exists
                if (currentLog) {
                    if (payloadLines.length > 0) {
                        currentLog.payload = payloadLines.join("\n");
                        payloadLines = [];
                    }
                    processLogPayload(currentLog);
                    batch.push(currentLog);

                    // Update timestamp range
                    if (currentLog.timestamp < minTimestamp) minTimestamp = currentLog.timestamp;
                    if (currentLog.timestamp > maxTimestamp) maxTimestamp = currentLog.timestamp;
                    
                    // Write batch if it's full
                    if (batch.length >= BATCH_SIZE) {
                        await writeBatch();
                    }
                }

                const [, levelRaw, date, time, component, message] = match;
                const level = normalizeLogLevel(levelRaw); // Normalize level (case-insensitive, aliases)
                let timestampStr: string;
                let timestamp: number;

                // Parse timestamp (same logic as streaming parser)
                const messageTimestampMatch = message.match(/(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4})/);
                
                if (messageTimestampMatch) {
                    try {
                        const messageTimestamp = new Date(messageTimestampMatch[1]).getTime();
                        if (!isNaN(messageTimestamp)) {
                            timestamp = messageTimestamp;
                            timestampStr = messageTimestampMatch[1];
                        } else {
                            throw new Error('Invalid timestamp');
                        }
                    } catch {
                        if (dateFormat === 'iso') {
                            timestampStr = `${date} ${time}`;
                            const isoString = `${date}T${time.replace(',', '.')}`;
                            timestamp = new Date(isoString).getTime();
                        } else {
                            timestampStr = `${date} ${time}`;
                            timestamp = new Date(timestampStr).getTime();
                        }
                    }
                } else {
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
                        
                        if (!isNaN(baseTimestamp)) {
                            timestamp = baseTimestamp + milliseconds;
                        } else {
                            timestamp = NaN;
                        }
                    }
                }

                const cleaned = cleanupLogEntry(component, message.trim());
                if (message.includes('[std-logger]')) {
                    cleaned.displayComponent = 'std-logger';
                }

                let specialTag = "";
                if (message.includes('MEDIA_TIMEOUT') || line.includes('MEDIA_TIMEOUT')) {
                    specialTag += "⚠️ [MEDIA_TIMEOUT] ";
                }
                if (line.includes('X-Recovery: true') || message.includes('X-Recovery: true')) {
                    specialTag += "🔄 [RECOVERED] ";
                }
                if (specialTag) {
                    cleaned.displayMessage = specialTag + cleaned.displayMessage;
                }

                const trimmedMessage = message.trim();
                const resolvedTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
                currentLog = {
                    id: idCounter++,
                    timestamp: resolvedTimestamp,
                    rawTimestamp: timestampStr,
                    displayTimestamp: formatLogTimestamp(resolvedTimestamp),
                    level: level,
                    component,
                    displayComponent: cleaned.displayComponent,
                    message: trimmedMessage,
                    displayMessage: cleaned.displayMessage,
                    payload: "",
                    type: "LOG",
                    isSip: false,
                    sipMethod: null,
                    fileName: file.name,
                    fileColor: fileColor,
                    _messageLower: trimmedMessage.toLowerCase(),
                    _componentLower: component.toLowerCase()
                };
            } else {
                // Continuation line
                if (currentLog) {
                    payloadLines.push(line);
                    currentLog._payloadLower = undefined;
                }
            }
        }

        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    });

    // Process remaining buffer
    if (buffer.trim() && currentLog) {
        payloadLines.push(buffer);
    }

    // Write last log
    const finalLog = currentLog as LogEntry | null;
    if (finalLog) {
        if (payloadLines.length > 0) {
            finalLog.payload = payloadLines.join("\n");
            payloadLines = [];
        }
        processLogPayload(finalLog);
        batch.push(finalLog);
        if (finalLog.timestamp < minTimestamp) minTimestamp = finalLog.timestamp;
        if (finalLog.timestamp > maxTimestamp) maxTimestamp = finalLog.timestamp;
    }

    // Write remaining batch
    await writeBatch();

    if (onProgress) onProgress(0.95);

    // Update metadata
    const existingMetadata = await dbManager.getMetadata();
    const existingFileNames = existingMetadata?.fileNames || [];
    if (!existingFileNames.includes(file.name)) {
        existingFileNames.push(file.name);
    }
    
    await dbManager.updateMetadata({
        totalLogs: (existingMetadata?.totalLogs || 0) + totalParsed,
        fileNames: existingFileNames,
        dateRange: {
            min: Math.min(existingMetadata?.dateRange.min || Infinity, minTimestamp === Infinity ? 0 : minTimestamp),
            max: Math.max(existingMetadata?.dateRange.max || -Infinity, maxTimestamp === -Infinity ? 0 : maxTimestamp)
        }
    });

    if (onProgress) onProgress(1.0);

    return { totalParsed, minTimestamp, maxTimestamp };
};

/**
 * Streaming CSV parser that writes directly to IndexedDB via Papa Parse.
 * Handles both Datadog CSV exports and Carbyne Call Log CSVs without loading
 * the entire file into memory, preventing OOM on large (100MB+) CSV files.
 */
const parseCSVStreamingToIndexedDB = async (
    file: ImportFileSource,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void
): Promise<{ totalParsed: number; minTimestamp: number; maxTimestamp: number }> => {
    await dbManager.init();
    const csvFile = await toBrowserImportFile(file);

    const BATCH_SIZE = 500;
    let idCounter = startId;
    let batch: LogEntry[] = [];
    let totalParsed = 0;
    let minTimestamp = Infinity;
    let maxTimestamp = -Infinity;
    let csvType: 'calllog' | 'datadog' | null = null;

    const writeBatch = async (): Promise<void> => {
        if (batch.length > 0) {
            await dbManager.addLogsBatch(batch);
            totalParsed += batch.length;
            batch = [];
        }
    };

    if (onProgress) onProgress(0.05);

    return new Promise<{ totalParsed: number; minTimestamp: number; maxTimestamp: number }>((resolve, reject) => {
        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            step: (results: Papa.ParseStepResult<Record<string, string>>) => {
                const row = results.data;
                // Detect CSV type from the first row's column names
                if (csvType === null) {
                    const columns = Object.keys(row).map(k => k.toLowerCase());
                    if (columns.some(c => c === 'id') && columns.some(c => c === 'created') && (columns.some(c => c === 'phone') || columns.some(c => c === 'termination reason'))) {
                        csvType = 'calllog';
                    } else {
                        csvType = 'datadog';
                    }
                }

                let entry: LogEntry | null = null;

                if (csvType === 'calllog') {
                    entry = parseCallLogRow(row, fileColor, idCounter);
                } else {
                    entry = parseDatadogRow(row, fileColor, idCounter);
                }

                if (entry) {
                    idCounter++;
                    batch.push(entry);
                    if (entry.timestamp < minTimestamp) minTimestamp = entry.timestamp;
                    if (entry.timestamp > maxTimestamp) maxTimestamp = entry.timestamp;

                    if (batch.length >= BATCH_SIZE) {
                        // Papa Parse step callback is synchronous; fire-and-forget the IDB write.
                        // writeBatch() resets the batch array so rows won't pile up in memory.
                        void writeBatch().then(() => {
                            if (onProgress) {
                                const progress = 0.1 + (results.meta.cursor / csvFile.size) * 0.8;
                                onProgress(Math.min(progress, 0.95));
                            }
                        });
                    }
                }
            },
            complete: async () => {
                try {
                    // Flush remaining batch
                    await writeBatch();

                    if (onProgress) onProgress(0.95);

                    // Update metadata
                    const existingMetadata = await dbManager.getMetadata();
                    const existingFileNames = existingMetadata?.fileNames || [];
                    if (!existingFileNames.includes(csvFile.name)) {
                        existingFileNames.push(csvFile.name);
                    }

                    await dbManager.updateMetadata({
                        totalLogs: (existingMetadata?.totalLogs || 0) + totalParsed,
                        fileNames: existingFileNames,
                        dateRange: {
                            min: Math.min(existingMetadata?.dateRange.min || Infinity, minTimestamp === Infinity ? 0 : minTimestamp),
                            max: Math.max(existingMetadata?.dateRange.max || -Infinity, maxTimestamp === -Infinity ? 0 : maxTimestamp)
                        }
                    });

                    if (onProgress) onProgress(1.0);
                    resolve({ totalParsed, minTimestamp, maxTimestamp });
                } catch (err) {
                    reject(err);
                }
            },
            error: (err: Error) => {
                reject(err);
            }
        });
    });
};

/**
 * Map a single call log CSV row (Papa Parse object) to a LogEntry.
 * Returns null if the row is missing required fields.
 */
function parseCallLogRow(row: Record<string, string>, fileColor: string, id: number): LogEntry | null {
    const callId = (row['ID'] || '').trim();
    const created = (row['Created'] || '').trim();
    if (!callId || !created) return null;

    const timestamp = new Date(created.replace(/-/g, ' ')).getTime();
    if (isNaN(timestamp)) return null;

    const phone = (row['Phone'] || '').trim();
    const duration = (row['Duration'] || '').trim();
    const termReason = (row['Termination Reason'] || '').trim();
    const station = (row['Station'] || '').trim();
    const callType = (row['Type'] || '').trim();
    const queue = (row['Queue Name'] || '').trim();
    const agent = (row['Agent Name'] || '').trim();
    const agentId = (row['Agent ID'] || '').trim();
    const waiting = (row['Waiting Time'] || '').trim();
    const address = (row['Last Estimated Address'] || '').trim();

    let level: LogLevel = 'INFO';
    const termLower = termReason.toLowerCase();
    if (termLower.includes('abandon') || termLower.includes('missed') || termLower.includes('fail')) {
        level = 'WARN';
    }
    if (duration === '0:00:00' && termLower !== 'agent ended call') {
        level = 'WARN';
    }

    const message = `Call #${callId} | ${callType} | ${phone} → ${queue} | Agent: ${agent || 'N/A'} | Station: ${station} | Duration: ${duration} | ${termReason}`;

    const payloadParts: string[] = [
        `Call ID: ${callId}`,
        `Created: ${created}`,
        `Phone: ${phone}`,
        `Type: ${callType}`,
        `Queue: ${queue}`,
        `Agent: ${agent} (ID: ${agentId})`,
        `Station: ${station}`,
        `Duration: ${duration}`,
        `Waiting Time: ${waiting}`,
        `Termination: ${termReason}`,
    ];
    if (address) payloadParts.push(`Address: ${address}`);

    const payload = payloadParts.join('\n');
    const entry: LogEntry = {
        id,
        timestamp,
        rawTimestamp: created,
        displayTimestamp: formatLogTimestamp(timestamp),
        level,
        component: 'Call Log',
        displayComponent: 'Call Log',
        message,
        displayMessage: message,
        payload,
        type: 'LOG',
        isSip: false,
        stationId: station || undefined,
        fileName: 'call-log.csv',
        fileColor,
        sourceType: 'apex',
        _messageLower: message.toLowerCase(),
        _componentLower: 'call log',
        _payloadLower: payload.toLowerCase(),
    };

    return entry;
}

/**
 * Map a single Datadog CSV row (Papa Parse object) to a LogEntry.
 * Papa Parse with header:true gives us named fields: Date, Host, Service, Content.
 * Returns null if the row cannot be parsed.
 */
function parseDatadogRow(row: Record<string, string>, fileColor: string, id: number): LogEntry | null {
    try {
        const isoDate = (row['Date'] || '').trim();
        const host = (row['Host'] || '').trim();
        const service = (row['Service'] || '').trim();
        const contentJson = (row['Content'] || '').trim();

        if (!isoDate || !contentJson) return null;

        // Papa Parse already handles CSV quoting/unescaping, but Datadog exports
        // use double-double-quote escaping inside the Content field's JSON.
        const unescapedJson = contentJson.replace(/""/g, '"');
        const content = JSON.parse(unescapedJson);

        if (!content.log) return null;

        const log = content.log;

        const timestamp = new Date(isoDate).getTime();
        const level: LogLevel = normalizeLogLevel(log.logLevel || 'INFO');
        const component = log.logSource || service || 'Unknown';
        const message = log.message || '';
        const rawTimestamp = log.timestamp || isoDate;

        let payload = '';
        if (log.machineData) {
            payload += `Machine: ${log.machineData.name || ''}\n`;
            payload += `Stack: ${log.machineData.stack || ''}\n`;
            payload += `Call Center: ${log.machineData.callCenterName || ''}\n`;
        }
        if (log.threadName) {
            payload += `Thread: ${log.threadName}\n`;
        }
        if (log.optionCause) {
            payload += `\nException:\n${log.optionCause}`;
        }

        const cleanupResult = cleanupLogEntry(component, message);

        const entry: LogEntry = {
            id,
            timestamp,
            rawTimestamp,
            displayTimestamp: formatLogTimestamp(timestamp),
            level,
            component,
            displayComponent: cleanupResult.displayComponent,
            message,
            displayMessage: cleanupResult.displayMessage,
            payload: payload.trim(),
            type: 'LOG',
            isSip: false,
            fileName: `${host}-${service}`,
            fileColor,
            sourceType: 'datadog',
            sourceLabel: `DD:${component}`,
        };

        if (log.machineData) {
            if (log.machineData.callCenterName) {
                entry.cncID = String(log.machineData.callCenterName);
            }
            if (log.machineData.name) {
                entry.stationId = String(log.machineData.name);
            }
        }

        const callIdMatch = message.match(/callId[=:]\s*([^\s;,()[\]]+)/i) || message.match(/Call-ID:\s*([^\s]+)/i);
        if (callIdMatch) {
            const extractedCallId = callIdMatch[1].trim();
            entry.callId = extractedCallId;
            entry._callIdLower = extractedCallId.toLowerCase();
        }

        const extensionMatch = message.match(/extensionID:\s*Optional\[(\d+)\]/);
        if (extensionMatch) {
            entry.extensionId = extensionMatch[1];
        }

        entry._messageLower = message.toLowerCase();
        entry._componentLower = component.toLowerCase();
        if (payload) {
            entry._payloadLower = payload.toLowerCase();
        }

        return entry;
    } catch {
        return null;
    }
}

/**
 * Parse a log file in a Web Worker to avoid blocking the main thread.
 * Used for non-CSV, non-Homer files in the 10-50 MB range in the browser (non-Electron) path.
 * Falls back to main-thread streaming if Worker is unavailable.
 *
 * @param file - The File object to parse
 * @param fileColor - Hex color for file identification in the UI
 * @param startId - Starting ID for parsed LogEntry objects
 * @param onProgress - Optional progress callback (0-1)
 * @returns Parsed LogEntry array
 */
function parseLogFileViaWorker(
    file: File,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void,
    timezone?: string,
): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('../workers/parseWorker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent) => {
            const { type } = e.data;
            if (type === 'progress' && onProgress) {
                onProgress(e.data.progress);
            } else if (type === 'done') {
                resolve(e.data.logs);
                worker.terminate();
            } else if (type === 'error') {
                reject(new Error(e.data.error));
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            reject(new Error(`Parse worker error: ${err.message}`));
            worker.terminate();
        };

        worker.postMessage({ file, fileColor, startId, timezone });
    });
}

/** Returns true when running in a browser tab (not Electron, not already inside a worker). */
function canUseWebWorker(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof Worker !== 'undefined' &&
        !(window as unknown as Record<string, unknown>).electronAPI
    );
}

export const parseLogFile = async (
    file: ImportFileSource,
    fileColor: string = '#3b82f6',
    startId: number = 1,
    onProgress?: (progress: number) => void,
    useIndexedDB: boolean = true,
    timezone?: string,
): Promise<LogEntry[] | { totalParsed: number; minTimestamp: number; maxTimestamp: number }> => {
    // Check if this is a CSV file (CSV files use different parser, typically smaller)
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    // For files larger than 50MB, use IndexedDB streaming parser to prevent OOM
    // This writes directly to IndexedDB instead of accumulating in memory
    const INDEXEDDB_THRESHOLD = 50 * 1024 * 1024; // 50MB
    const shouldUseIndexedDB = useIndexedDB && file.size > INDEXEDDB_THRESHOLD;

    if (shouldUseIndexedDB) {
        // Route CSV files to the Papa Parse streaming parser, others to the line-based one
        if (isCSV) {
            return parseCSVStreamingToIndexedDB(file, fileColor, startId, onProgress);
        }
        return parseLogFileStreamingToIndexedDB(file, fileColor, startId, onProgress, timezone);
    }
    
    // For smaller files or CSV files, use traditional parsing (faster for small files)
    const STREAMING_THRESHOLD = 50 * 1024 * 1024; // 50MB
    const useStreaming = !isCSV && file.size > STREAMING_THRESHOLD;
    
    if (useStreaming) {
        // Use streaming parser for large standard log files (still returns array for backward compatibility)
        return parseLogFileStreaming(file, fileColor, startId, onProgress, timezone);
    }
    
    // For non-CSV files > 10 MB in the browser, offload parsing to a Web Worker
    // so the main thread stays responsive. Electron uses its own IPC worker path.
    const WORKER_THRESHOLD = 10 * 1024 * 1024; // 10MB
    if (!isCSV && file.size > WORKER_THRESHOLD && canUseWebWorker() && isBrowserImportFile(file)) {
        return parseLogFileViaWorker(file, fileColor, startId, onProgress, timezone);
    }

    // For smaller files or CSV files, use traditional parsing (faster for small files)
    const useChunkedReading = file.size > 10 * 1024 * 1024;

    let text: string;
    if (useChunkedReading) {
        if (onProgress) onProgress(0.1);
        text = await readFileInChunks(file);
    } else {
        text = await readImportFileText(file);
    }

    if (isCSV) {
        if (onProgress) onProgress(0.5);
        // Detect CSV sub-type: Call Log vs Datadog extract
        const firstLine = text.split(/\r?\n/)[0] ?? '';
        const result = isCallLogCSV(firstLine)
            ? parseCallLogCSV(text, fileColor, startId)
            : parseDatadogCSV(text, fileColor, startId);
        if (onProgress) onProgress(1.0);
        return result;
    }

    // Check if this is a Homer SIP export (detect by proto: header line pattern)
    const isHomer = text.match(/^proto:\S+\s+\S+\s+\S+\s*(--->|&lt;---)\s+\S+/im);
    if (isHomer) {
        if (onProgress) onProgress(0.5);
        const result = parseHomerText(text, fileColor, startId, file.name);
        if (onProgress) onProgress(1.0);
        // Sort by timestamp for Homer exports
        result.sort((a, b) => a.timestamp - b.timestamp);
        return result;
    }

    const lines = text.split(/\r?\n/);
    const firstNonEmpty = lines.find((line) => line.trim().length > 0) ?? '';
    if (OPERATOR_CLIENT_HEADER_REGEX.test(firstNonEmpty)) {
        if (onProgress) onProgress(0.5);
        const result = parseOperatorClientLog(text, fileColor, startId, file.name, timezone);
        if (onProgress) onProgress(1.0);
        return result;
    }

    const parsedLogs: LogEntry[] = [];
    
    // Report progress after splitting lines
    if (onProgress) onProgress(0.2);

    // Original format: [INFO] [12/17/2024, 09:18:05] [component]: message
    // Case insensitive, supports alternative level names (CRITICAL, FATAL, SEVERE, ERR, etc.)
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/i;

    // ISO format: [INFO] [2025-12-17 09:18:05,686] [component] message
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN|CRITICAL|FATAL|SEVERE|ERR|WARNING|TRACE|VERBOSE|NOTICE|FAILURE|FAIL)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/i;

    let currentLog: LogEntry | null = null;
    let payloadLines: string[] = [];
    let idCounter = startId;
    const YIELD_EVERY_N_LINES = 1000; // Yield control every 1000 lines to prevent tab freezing

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Yield control periodically to prevent tab freezing during parsing of large files
        if (i > 0 && i % YIELD_EVERY_N_LINES === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
            // Update progress during parsing (20% to 90%)
            if (onProgress) {
                const parsingProgress = 0.2 + (i / lines.length) * 0.7;
                onProgress(parsingProgress);
            }
        }
        
        if (!line.trim()) continue; // Skip empty lines

        let match = line.match(logRegex1);
        let dateFormat = 'original';

        // Try ISO format if original doesn't match
        if (!match) {
            match = line.match(logRegex2);
            dateFormat = 'iso';
        }

        if (match) {
            // If we have a current log being built, push it before starting new one
            if (currentLog) {
                if (payloadLines.length > 0) {
                    currentLog.payload = payloadLines.join("\n");
                    payloadLines = [];
                }
                processLogPayload(currentLog);
                parsedLogs.push(currentLog);
            }

            const [, levelRaw, date, time, component, message] = match;
            const level = normalizeLogLevel(levelRaw); // Normalize level (case-insensitive, aliases)

            let timestampStr: string;
            let timestamp: number;

            // Try to extract timestamp from message if it contains timezone info (more accurate)
            // Pattern: "Wed Jan 14 2026 15:15:21 GMT-0600" or similar ISO-like strings with timezone
            const messageTimestampMatch = message.match(/(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4})/);
            
            if (messageTimestampMatch) {
                // Use timestamp from message if it has timezone info
                try {
                    const messageTimestamp = new Date(messageTimestampMatch[1]).getTime();
                    if (!isNaN(messageTimestamp)) {
                        timestamp = messageTimestamp;
                        timestampStr = messageTimestampMatch[1];
                    } else {
                        throw new Error('Invalid timestamp from message');
                    }
                } catch {
                    // Fall back to header timestamp parsing
                    if (dateFormat === 'iso') {
                        timestampStr = `${date} ${time}`;
                        const isoString = `${date}T${time.replace(',', '.')}`;
                        timestamp = new Date(isoString).getTime();
                    } else {
                        timestampStr = `${date} ${time}`;
                        timestamp = new Date(timestampStr).getTime();
                    }
                }
            } else {
                // Parse from header timestamp
                if (dateFormat === 'iso') {
                    // ISO format: 2025-12-17 09:18:05,686 -> convert to ISO string format
                    timestampStr = `${date} ${time}`;
                    // Replace comma with dot and add 'Z' for UTC, or parse as-is
                    const isoString = `${date}T${time.replace(',', '.')}`;
                    timestamp = new Date(isoString).getTime();
                } else {
                    // Original format: MM/DD/YYYY time
                    // Note: JavaScript Date interprets this as local time, which may cause timezone issues
                    // If logs are from a different timezone, consider parsing with explicit timezone handling
                    // Handle milliseconds format: "5:04:57 AM,388" -> extract milliseconds and parse separately
                    let timeWithoutMs = time;
                    let milliseconds = 0;
                    
                    // Check if time contains milliseconds in format ",388" or ",123"
                    const msMatch = time.match(/(.+?),\s*(\d+)$/);
                    if (msMatch) {
                        timeWithoutMs = msMatch[1].trim(); // "5:04:57 AM"
                        milliseconds = parseInt(msMatch[2], 10); // 388
                    }
                    
                    timestampStr = `${date} ${time}`;
                    const baseTimestamp = new Date(`${date} ${timeWithoutMs}`).getTime();
                    
                    // If parsing succeeded, add milliseconds
                    if (!isNaN(baseTimestamp)) {
                        timestamp = baseTimestamp + milliseconds;
                    } else {
                        timestamp = NaN; // Will fall back to Date.now() on line 424
                    }
                }
            }

            const cleaned = cleanupLogEntry(component, message.trim());

            // 1. std-logger Filter: promote to component if tagged
            if (message.includes('[std-logger]')) {
                cleaned.displayComponent = 'std-logger';
            }

            // 2. SIP Analysis: Check for specific issues requested by user
            let specialTag = "";
            if (message.includes('MEDIA_TIMEOUT') || line.includes('MEDIA_TIMEOUT')) {
                specialTag += "⚠️ [MEDIA_TIMEOUT] ";
            }
            if (line.includes('X-Recovery: true') || message.includes('X-Recovery: true')) {
                specialTag += "🔄 [RECOVERED] ";
            }
            if (specialTag) {
                cleaned.displayMessage = specialTag + cleaned.displayMessage;
            }

            const trimmedMessage = message.trim();
            const resolvedTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
            currentLog = {
                id: idCounter++,
                timestamp: resolvedTimestamp,
                rawTimestamp: timestampStr,
                displayTimestamp: formatLogTimestamp(resolvedTimestamp),
                level: level, // Already normalized via normalizeLogLevel()
                component,
                displayComponent: cleaned.displayComponent,
                message: trimmedMessage,
                displayMessage: cleaned.displayMessage,
                payload: "",
                type: "LOG", // Default
                isSip: false,
                sipMethod: null,
                fileName: file.name,
                fileColor: fileColor,
                // Phase 2 Optimization: Pre-compute lowercase strings during parsing for faster filtering
                _messageLower: trimmedMessage.toLowerCase(),
                _componentLower: component.toLowerCase()
            };
        } else {
            // Line does not match start of log.
            // check if it's a continuation or a SIP block
            if (currentLog) {
                payloadLines.push(line);
                currentLog._payloadLower = undefined;
            }
        }
    }

    // Push last log
    if (currentLog) {
        if (payloadLines.length > 0) {
            currentLog.payload = payloadLines.join("\n");
            payloadLines = [];
        }
        processLogPayload(currentLog);
        parsedLogs.push(currentLog);
    }

    // Report progress before sorting
    if (onProgress) onProgress(0.95);

    // Sort logs by timestamp to ensure chronological order
    parsedLogs.sort((a, b) => a.timestamp - b.timestamp);

    // Report completion
    if (onProgress) onProgress(1.0);

    return parsedLogs;
};

/** Payload size cap (500KB) – larger payloads are truncated in memory; full payload could be lazy-loaded later. */
const PAYLOAD_CAP_BYTES = 500 * 1024;

/**
 * Build a short summary for CNC/FDX JSON log entries so the table row is useful without opening the payload.
 */
function buildJsonSummary(log: LogEntry, j: Record<string, unknown>): string | null {
    const messageType = j.messageType != null ? String(j.messageType) : null;
    const isHttpLogger = log.component?.includes('HTTP-Logger') ?? false;
    if (isHttpLogger) return null; // HTTP-Logger messages (e.g. "✅ Response: POST ...") stay as displayMessage

    const parts: string[] = [];

    // CNC-specific: e.g. CNC_OPERATORS_STATUSES_UPDATE_MESSAGE (N operators)
    if (messageType && (messageType.includes('OPERATORS_STATUSES') || messageType.includes('OPERATOR'))) {
        const operatorsStatuses = j.operatorsStatuses;
        const n = Array.isArray(operatorsStatuses) ? operatorsStatuses.length : 0;
        parts.push(n > 0 ? `${messageType} (${n} operators)` : messageType);
    }
    // FDX: reportNLPConversation -> reportID and optionally first transcript line
    else if (j.reportNLPConversation && typeof j.reportNLPConversation === 'object') {
        const rnc = j.reportNLPConversation as Record<string, unknown>;
        const reportID = rnc.reportID != null ? String(rnc.reportID) : null;
        const transcript = rnc.transcript;
        let firstLine: string | null = null;
        if (Array.isArray(transcript) && transcript.length > 0 && typeof transcript[0] === 'string') {
            firstLine = transcript[0].slice(0, 60);
            if ((transcript[0] as string).length > 60) firstLine += '…';
        }
        if (reportID) parts.push(`report ${reportID}`);
        if (firstLine) parts.push(firstLine);
    }
    // FDX: fdxReportUpdateMessageData -> reportUpdateTypes or report state
    else if (j.fdxReportUpdateMessageData && typeof j.fdxReportUpdateMessageData === 'object') {
        const data = j.fdxReportUpdateMessageData as Record<string, unknown>;
        const reportUpdateTypes = data.reportUpdateTypes;
        const reportId = data.reportID != null ? String(data.reportID) : null;
        if (reportId) parts.push(`report ${reportId}`);
        if (Array.isArray(reportUpdateTypes) && reportUpdateTypes.length > 0) {
            parts.push(reportUpdateTypes.map((t: unknown) => String(t)).join(', '));
        } else if (reportUpdateTypes != null) {
            parts.push(String(reportUpdateTypes));
        }
    }
    // Generic: messageType only
    else if (messageType) {
        parts.push(messageType);
    }

    if (parts.length === 0) return null;
    return parts.join(' · ');
}

function processLogPayload(log: LogEntry) {
    // Phase 2 Optimization: Pre-compute lowercase payload once
    const trimmedPayload = log.payload.trim();

    // 1. Check for JSON (parse from full payload first so summary is accurate; truncate for storage afterward if needed)
    if (trimmedPayload.startsWith('{') && trimmedPayload.endsWith('}')) {
        try {
            log.json = JSON.parse(trimmedPayload);
            log.type = "JSON";

            // Extract IDs from JSON
            if (log.json.reportNLPConversation?.reportID) log.reportId = String(log.json.reportNLPConversation.reportID);
            if (log.json.recipientsClientIDs && Array.isArray(log.json.recipientsClientIDs) && log.json.recipientsClientIDs.length > 0) {
                log.operatorId = log.json.recipientsClientIDs[0];
            }
            if (log.json.operatorID) log.operatorId = log.json.operatorID;
            if (log.json.extensionID) {
                log.extensionId = String(log.json.extensionID);
                if (log.extensionId.length > 2) log.stationId = log.extensionId.substring(2);
            }
            // New UI: correlation fields (cncID, messageID for session/message correlation)
            if (log.json.messageType != null) log.messageType = String(log.json.messageType);
            if (log.json.cncID != null) log.cncID = String(log.json.cncID);
            if (log.json.messageID != null) log.messageID = String(log.json.messageID);

            // Summary for table row (CNC/FDX message summary per APEX_NEW_UI_LOG_ANALYSIS)
            const summary = buildJsonSummary(log, log.json as Record<string, unknown>);
            if (summary) {
                log.summaryMessage = summary;
                log.displayMessage = summary;
            }
            
            // JSON-based level extraction: check if JSON has level/severity/logLevel fields
            // Only upgrade level if current level is INFO (don't downgrade ERROR to WARN, etc.)
            if (log.level === 'INFO') {
                const jsonLevel = log.json.level || log.json.severity || log.json.logLevel || 
                                  log.json.Level || log.json.Severity || log.json.LogLevel ||
                                  log.json.log_level || log.json.loglevel;
                if (jsonLevel) {
                    const normalizedJsonLevel = normalizeLogLevel(String(jsonLevel));
                    // Only upgrade, never downgrade
                    if (normalizedJsonLevel === 'ERROR' || normalizedJsonLevel === 'WARN') {
                        log.level = normalizedJsonLevel;
                    }
                }
                
                // Also check for error indicators in JSON
                const hasError = log.json.error || log.json.Error || log.json.ERROR ||
                                 log.json.exception || log.json.Exception ||
                                 log.json.stackTrace || log.json.stack_trace ||
                                 log.json.errorMessage || log.json.error_message;
                if (hasError && log.level === 'INFO') {
                    log.level = 'ERROR';
                }
            }
        } catch {
            // Not valid JSON, ignore
        }
    }

    // Optional: cap very large payloads in memory (full payload already parsed for summary above)
    if (trimmedPayload.length > PAYLOAD_CAP_BYTES) {
        log.payload = trimmedPayload.slice(0, PAYLOAD_CAP_BYTES) + '\n... [payload truncated for display]';
    }
    log._payloadLower = log.payload.toLowerCase();

    // 2. Extract IDs from Message/Payload via Regex (Fallback or Primary if not JSON)

    // Report ID: "report id: 8622628"
    const reportIdMatch = (log.message + " " + log.payload).match(/report id:\s*(\d+)/i);
    if (reportIdMatch && !log.reportId) {
        log.reportId = reportIdMatch[1];
    }

    // Extension ID: "extensionID: Optional[1017]"
    const extIdMatch = (log.message + " " + log.payload).match(/extensionID: Optional\[(\d+)\]/i);
    if (extIdMatch && !log.extensionId) {
        log.extensionId = extIdMatch[1];
        if (log.extensionId.length > 2) log.stationId = log.extensionId.substring(2);
    }

    // 3. Check for SIP
    // Phase 2 Optimization: Use pre-computed lowercase
    if (log.payload.includes("SIP/2.0") || (log._messageLower && log._messageLower.includes("sip"))) {
        log.isSip = true;

        // Detect Method or Response
        const firstLine = log.payload.split('\n')[0] || "";
        const responseMatch = firstLine.match(/^SIP\/2\.0\s+(\d{3})\s+(.*)/i);
        if (responseMatch) {
            log.sipMethod = `${responseMatch[1]} ${responseMatch[2]}`;
        } else {
            const requestMatch = firstLine.match(/^([A-Z]+)\s+sip:.*SIP\/2\.0/i);
            if (requestMatch) {
                log.sipMethod = requestMatch[1];
            } else {
                // Fallback for fragmented or non-standard logs
                const knownMethods = ["INVITE", "ACK", "BYE", "CANCEL", "OPTIONS", "REGISTER", "PRACK", "UPDATE", "SUBSCRIBE", "NOTIFY", "REFER", "INFO", "MESSAGE", "PUBLISH"];
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
        if (callIdMatch) {
            log.callId = callIdMatch[1].trim();
            // Phase 2 Optimization: Pre-compute lowercase callId
            log._callIdLower = log.callId.toLowerCase();
        }

        // Extract From
        const fromMatch = log.payload.match(/From:\s*(.+)/i);
        if (fromMatch) log.sipFrom = fromMatch[1].trim();

        // Extract To
        const toMatch = log.payload.match(/To:\s*(.+)/i);
        if (toMatch) log.sipTo = toMatch[1].trim();

        // Extract Agent/Operator ID from Contact or From header
        // "Contact: <sip:...;agentid=414b837f-aa1e-42f4-b149-e78f55989c8f;...>"
        const agentIdMatch = log.payload.match(/agentid=([a-f0-9-]+)/i);
        if (agentIdMatch && !log.operatorId) {
            log.operatorId = agentIdMatch[1];
        }
        
        // SIP level detection: 4xx=WARN, 5xx/6xx=ERROR
        // Only upgrade level if current level is INFO (don't downgrade ERROR entries)
        if (log.level === 'INFO') {
            const sipLevel = getSipResponseLevel(log.sipMethod);
            if (sipLevel) {
                log.level = sipLevel;
            }
        }
    }
    
    // Phase 2 Optimization: Pre-compute lowercase for callId if not already set (from message extraction)
    if (log.callId && !log._callIdLower) {
        log._callIdLower = log.callId.toLowerCase();
    }

    // Auto-derive sourceLabel if not already set by a specialized parser (Datadog, Call Log, Homer)
    if (!log.sourceLabel) {
        const comp = (log.displayComponent || log.component || '').toLowerCase();
        if (log.isSip || comp === 'homer sip') {
            log.sourceLabel = 'Homer SIP';
        } else if (comp.includes('fdx') || comp.includes('fdxmessage')) {
            log.sourceLabel = 'FDX';
        } else if (comp.includes('ccs') || comp.includes('pbx')) {
            log.sourceLabel = 'CCS/PBX';
        } else {
            log.sourceLabel = 'APEX Local';
        }
    }
}
