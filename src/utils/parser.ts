import type { LogEntry, LogLevel } from '../types';

/**
 * Log Parser for LogScrub
 * 
 * LOG PATTERN: ^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)
 * Groups: 1=Level, 2=Date, 3=Time, 4=Component, 5=Message (+ potential payload)
 */

export const parseLogFile = async (file: File): Promise<LogEntry[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const parsedLogs: LogEntry[] = [];

    const logRegex = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/;

    let currentLog: LogEntry | null = null;
    let idCounter = 1;

    for (let line of lines) {
        if (!line.trim()) continue; // Skip empty lines

        const match = line.match(logRegex);

        if (match) {
            // If we have a current log being built, push it before starting new one
            if (currentLog) {
                processLogPayload(currentLog);
                parsedLogs.push(currentLog);
            }

            const [_, level, date, time, component, message] = match;

            const timestampStr = `${date} ${time}`;
            const timestamp = new Date(timestampStr).getTime();

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
