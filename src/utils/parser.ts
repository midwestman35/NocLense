import type { LogEntry, LogLevel } from '../types';
import { cleanupLogEntry } from './messageCleanup';

/**
 * Log Parser for LogScrub
 * 
 * Supports two log formats:
 * 1. Original: [LEVEL] [MM/DD/YYYY, time] [component]: message
 * 2. ISO Date: [LEVEL] [YYYY-MM-DD HH:MM:SS,mmm] [component] message
 */

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
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            // Parse CSV line - handle quoted fields
            const csvMatch = line.match(/^"([^"]+)","([^"]+)","([^"]+)","(.+)"$/);
            if (!csvMatch) continue;

            const [_, isoDate, host, service, contentJson] = csvMatch;
            
            // Parse the JSON content (need to unescape double quotes)
            const unescapedJson = contentJson.replace(/""/g, '"');
            const content = JSON.parse(unescapedJson);
            
            if (!content.log) continue;

            const log = content.log;
            
            // Extract log data from the nested structure
            const timestamp = new Date(isoDate).getTime();
            const level: LogLevel = (log.logLevel || 'INFO').toUpperCase() as LogLevel;
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
                level,
                component,
                displayComponent: cleanupResult.displayComponent,
                message,
                displayMessage: cleanupResult.displayMessage,
                payload: payload.trim(),
                type: 'LOG',
                isSip: false,
                fileName: `${host}-${service}`,
                fileColor
            };

            // Extract correlation IDs from message
            const callIdMatch = message.match(/callId[=:]([a-zA-Z0-9\-]+)/);
            if (callIdMatch) {
                entry.callId = callIdMatch[1];
            }

            const extensionMatch = message.match(/extensionID:\s*Optional\[(\d+)\]/);
            if (extensionMatch) {
                entry.extensionId = extensionMatch[1];
            }

            parsedLogs.push(entry);

        } catch (error) {
            console.warn(`Failed to parse CSV line ${i}:`, error);
            continue;
        }
    }

    return parsedLogs;
};

export const parseLogFile = async (file: File, fileColor: string = '#3b82f6', startId: number = 1): Promise<LogEntry[]> => {
    const text = await file.text();
    
    // Check if this is a CSV file
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    if (isCSV) {
        return parseDatadogCSV(text, fileColor, startId);
    }

    const lines = text.split(/\r?\n/);
    const parsedLogs: LogEntry[] = [];

    // Original format: [INFO] [12/17/2024, 09:18:05] [component]: message
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/;

    // ISO format: [INFO] [2025-12-17 09:18:05,686] [component] message
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/;

    let currentLog: LogEntry | null = null;
    let idCounter = startId;

    for (let line of lines) {
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
                processLogPayload(currentLog);
                parsedLogs.push(currentLog);
            }

            const [_, level, date, time, component, message] = match;

            let timestampStr: string;
            let timestamp: number;

            if (dateFormat === 'iso') {
                // ISO format: 2025-12-17 09:18:05,686 -> convert to ISO string format
                timestampStr = `${date} ${time}`;
                // Replace comma with dot and add 'Z' for UTC, or parse as-is
                const isoString = `${date}T${time.replace(',', '.')}`;
                timestamp = new Date(isoString).getTime();
            } else {
                // Original format: MM/DD/YYYY time
                timestampStr = `${date} ${time}`;
                timestamp = new Date(timestampStr).getTime();
            }

            const cleaned = cleanupLogEntry(component, message.trim());

            currentLog = {
                id: idCounter++,
                timestamp: isNaN(timestamp) ? Date.now() : timestamp,
                rawTimestamp: timestampStr,
                level: level as LogLevel,
                component,
                displayComponent: cleaned.displayComponent,
                message: message.trim(),
                displayMessage: cleaned.displayMessage,
                payload: "",
                type: "LOG", // Default
                isSip: false,
                sipMethod: null,
                fileName: file.name,
                fileColor: fileColor
            };
        } else {
            // Line does not match start of log. 
            // check if it's a continuation or a SIP block
            if (currentLog) {
                // Append to payload
                currentLog.payload += (currentLog.payload ? "\n" : "") + line;
            }
        }
    }

    // Push last log
    if (currentLog) {
        processLogPayload(currentLog);
        parsedLogs.push(currentLog);
    }

    // Sort logs by timestamp to ensure chronological order
    parsedLogs.sort((a, b) => a.timestamp - b.timestamp);

    return parsedLogs;
};

function processLogPayload(log: LogEntry) {
    // 1. Check for JSON
    const trimmedPayload = log.payload.trim();
    if (trimmedPayload.startsWith('{') && trimmedPayload.endsWith('}')) {
        try {
            log.json = JSON.parse(trimmedPayload);
            log.type = "JSON";

            // Extract IDs from JSON
            if (log.json.reportNLPConversation?.reportID) log.reportId = String(log.json.reportNLPConversation.reportID);
            if (log.json.recipientsClientIDs && Array.isArray(log.json.recipientsClientIDs) && log.json.recipientsClientIDs.length > 0) {
                log.operatorId = log.json.recipientsClientIDs[0];
            }
            if (log.json.operatorID) log.operatorId = log.json.operatorID; // Some logs might have it here
            if (log.json.extensionID) {
                log.extensionId = String(log.json.extensionID);
                // Derive Station ID (e.g. 1017 -> 17)
                if (log.extensionId.length > 2) log.stationId = log.extensionId.substring(2);
            }

        } catch (e) {
            // Not valid JSON, ignore
        }
    }

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
    if (log.payload.includes("SIP/2.0") || log.message.toLowerCase().includes("sip")) {
        log.isSip = true;

        // Detect Method
        const firstLine = log.payload.split('\n')[0] || "";

        if (firstLine.includes("INVITE")) log.sipMethod = "INVITE";
        else if (firstLine.includes("BYE")) log.sipMethod = "BYE";
        else if (firstLine.includes("CANCEL")) log.sipMethod = "CANCEL";
        else if (firstLine.includes("OPTIONS")) log.sipMethod = "OPTIONS";
        else if (firstLine.includes("REGISTER")) log.sipMethod = "REGISTER";
        else if (firstLine.includes("ACK")) log.sipMethod = "ACK";
        else if (firstLine.includes(" 200 OK")) log.sipMethod = "200 OK";

        // Extract Call-ID
        const callIdMatch = log.payload.match(/Call-ID:\s*(.+)/i);
        if (callIdMatch) log.callId = callIdMatch[1].trim();

        // Extract From
        const fromMatch = log.payload.match(/From:\s*(.+)/i);
        if (fromMatch) log.sipFrom = fromMatch[1].trim();

        // Extract To
        const toMatch = log.payload.match(/To:\s*(.+)/i);
        if (toMatch) log.sipTo = toMatch[1].trim();

        // Extract Agent/Operator ID from Contact or From header
        // "Contact: <sip:...;agentid=414b837f-aa1e-42f4-b149-e78f55989c8f;...>"
        const agentIdMatch = log.payload.match(/agentid=([a-f0-9\-]+)/i);
        if (agentIdMatch && !log.operatorId) {
            log.operatorId = agentIdMatch[1];
        }
    }
}
