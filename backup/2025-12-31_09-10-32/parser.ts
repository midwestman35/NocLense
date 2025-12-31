import type { LogEntry, LogLevel } from '../types';

/**
 * Log Parser for LogScrub
 * 
 * Supports two log formats:
 * 1. Original: [LEVEL] [MM/DD/YYYY, time] [component]: message
 * 2. ISO Date: [LEVEL] [YYYY-MM-DD HH:MM:SS,mmm] [component] message
 */

export const parseLogFile = async (file: File): Promise<LogEntry[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const parsedLogs: LogEntry[] = [];

    // Original format: [INFO] [12/17/2024, 09:18:05] [component]: message
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/;
    
    // ISO format: [INFO] [2025-12-17 09:18:05,686] [component] message
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/;

    let currentLog: LogEntry | null = null;
    let idCounter = 1;

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

            currentLog = {
                id: idCounter++,
                timestamp: isNaN(timestamp) ? Date.now() : timestamp,
                rawTimestamp: timestampStr,
                level: level as LogLevel,
                component,
                message: message.trim(),
                payload: "",
                type: "LOG", // Default
                isSip: false,
                sipMethod: null,
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
        } catch (e) {
            // Not valid JSON, ignore
        }
    }

    // 2. Check for SIP
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
        if (callIdMatch) {
            log.callId = callIdMatch[1].trim();
        }
    }
}
