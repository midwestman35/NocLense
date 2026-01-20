import type { LogEntry, LogLevel } from '../types';
import { cleanupLogEntry } from './messageCleanup';
import { dbManager } from './indexedDB';

/**
 * Log Parser for LogScrub
 * 
 * Supports multiple log formats:
 * 1. Original: [LEVEL] [MM/DD/YYYY, time] [component]: message
 * 2. ISO Date: [LEVEL] [YYYY-MM-DD HH:MM:SS,mmm] [component] message
 * 3. Homer SIP Export: Text format with session metadata and SIP messages
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
            // Fix: Use more permissive regex to match various Call-ID formats and trim whitespace
            // Matches: callId=value, callId:value, Call-ID:value (case insensitive)
            const callIdMatch = message.match(/callId[=:]\s*([^\s;,\[\]\(\)]+)/i) || message.match(/Call-ID:\s*([^\s]+)/i);
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
                    level: 'INFO' as LogLevel,
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
                    _messageLower: message.toLowerCase(),
                    _componentLower: 'homer sip'
                };

                // Process SIP payload to extract Call-ID, methods, etc.
                processLogPayload(entry);

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
            level: 'INFO' as LogLevel,
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
            _messageLower: message.toLowerCase(),
            _componentLower: 'homer sip'
        };

        processLogPayload(entry);
        parsedLogs.push(entry);
    }

    return parsedLogs;
};

/**
 * Streaming parser that processes file chunks line-by-line without accumulating full text
 * This prevents memory exhaustion on large files (e.g., 740MB+)
 */
const parseLogFileStreaming = async (
    file: File,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void
): Promise<LogEntry[]> => {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for better performance
    const fileSize = file.size;
    const parsedLogs: LogEntry[] = [];
    let idCounter = startId;
    let offset = 0;
    let buffer = ''; // Buffer for incomplete lines at chunk boundaries
    let chunkCount = 0;
    const YIELD_INTERVAL = 5; // Yield every 5 chunks
    
    // Regex patterns (same as main parser)
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/;
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/;
    
    let currentLog: LogEntry | null = null;
    let lineCount = 0;
    const YIELD_EVERY_N_LINES = 5000; // Yield every 5000 lines

    while (offset < fileSize) {
        const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
        const chunkText = await chunk.text();
        offset += CHUNK_SIZE;
        chunkCount++;

        // Combine buffer with new chunk
        const textToProcess = buffer + chunkText;
        
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
                    const progress = 0.1 + (offset / fileSize) * 0.8;
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
                    processLogPayload(currentLog);
                    parsedLogs.push(currentLog);
                }

                const [_, level, date, time, component, message] = match;
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
                    } catch (e) {
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

                let cleaned = cleanupLogEntry(component, message.trim());
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
                currentLog = {
                    id: idCounter++,
                    timestamp: isNaN(timestamp) ? Date.now() : timestamp,
                    rawTimestamp: timestampStr,
                    level: level as LogLevel,
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
                    currentLog.payload += (currentLog.payload ? "\n" : "") + line;
                    currentLog._payloadLower = undefined;
                }
            }
        }

        // Yield control periodically
        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Process remaining buffer as final line
    if (buffer.trim() && currentLog) {
        currentLog.payload += (currentLog.payload ? "\n" : "") + buffer;
    }

    // Push last log
    if (currentLog) {
        processLogPayload(currentLog);
        parsedLogs.push(currentLog);
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
const readFileInChunks = async (file: File): Promise<string> => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const fileSize = file.size;
    let offset = 0;
    let fullText = '';
    let chunkCount = 0;
    const YIELD_INTERVAL = 10; // Yield every 10 chunks to keep UI responsive

    while (offset < fileSize) {
        const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
        const chunkText = await chunk.text();
        fullText += chunkText;
        offset += CHUNK_SIZE;
        chunkCount++;

        // Yield control to browser periodically to prevent tab freezing
        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    return fullText;
};

/**
 * Streaming parser that writes directly to IndexedDB instead of accumulating in memory
 * This is the preferred method for large files as it prevents memory exhaustion
 */
const parseLogFileStreamingToIndexedDB = async (
    file: File,
    fileColor: string,
    startId: number,
    onProgress?: (progress: number) => void
): Promise<{ totalParsed: number; minTimestamp: number; maxTimestamp: number }> => {
    // Initialize IndexedDB
    await dbManager.init();
    
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
    const BATCH_SIZE = 1000; // Write to IndexedDB in batches of 1000
    const fileSize = file.size;
    let idCounter = startId;
    let offset = 0;
    let buffer = '';
    let chunkCount = 0;
    const YIELD_INTERVAL = 5;
    
    // Regex patterns
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/;
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/;
    
    let currentLog: LogEntry | null = null;
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

    while (offset < fileSize) {
        const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
        const chunkText = await chunk.text();
        offset += CHUNK_SIZE;
        chunkCount++;

        const textToProcess = buffer + chunkText;
        const lines = textToProcess.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            lineCount++;

            if (lineCount % YIELD_EVERY_N_LINES === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (onProgress) {
                    const progress = 0.1 + (offset / fileSize) * 0.8;
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

                const [_, level, date, time, component, message] = match;
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
                    } catch (e) {
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

                let cleaned = cleanupLogEntry(component, message.trim());
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
                currentLog = {
                    id: idCounter++,
                    timestamp: isNaN(timestamp) ? Date.now() : timestamp,
                    rawTimestamp: timestampStr,
                    level: level as LogLevel,
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
                    currentLog.payload += (currentLog.payload ? "\n" : "") + line;
                    currentLog._payloadLower = undefined;
                }
            }
        }

        if (chunkCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Process remaining buffer
    if (buffer.trim() && currentLog) {
        currentLog.payload += (currentLog.payload ? "\n" : "") + buffer;
    }

    // Write last log
    if (currentLog) {
        processLogPayload(currentLog);
        batch.push(currentLog);
        if (currentLog.timestamp < minTimestamp) minTimestamp = currentLog.timestamp;
        if (currentLog.timestamp > maxTimestamp) maxTimestamp = currentLog.timestamp;
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

export const parseLogFile = async (file: File, fileColor: string = '#3b82f6', startId: number = 1, onProgress?: (progress: number) => void, useIndexedDB: boolean = true): Promise<LogEntry[] | { totalParsed: number; minTimestamp: number; maxTimestamp: number }> => {
    // Check if this is a CSV file (CSV files use different parser, typically smaller)
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    
    // For files larger than 50MB, use IndexedDB streaming parser to prevent OOM
    // This writes directly to IndexedDB instead of accumulating in memory
    const INDEXEDDB_THRESHOLD = 50 * 1024 * 1024; // 50MB
    const shouldUseIndexedDB = useIndexedDB && !isCSV && file.size > INDEXEDDB_THRESHOLD;
    
    if (shouldUseIndexedDB) {
        // Use IndexedDB streaming parser for large files
        return parseLogFileStreamingToIndexedDB(file, fileColor, startId, onProgress);
    }
    
    // For smaller files or CSV files, use traditional parsing (faster for small files)
    const STREAMING_THRESHOLD = 50 * 1024 * 1024; // 50MB
    const useStreaming = !isCSV && file.size > STREAMING_THRESHOLD;
    
    if (useStreaming) {
        // Use streaming parser for large standard log files (still returns array for backward compatibility)
        return parseLogFileStreaming(file, fileColor, startId, onProgress);
    }
    
    // For smaller files or CSV files, use traditional parsing (faster for small files)
    const useChunkedReading = file.size > 10 * 1024 * 1024;
    
    let text: string;
    if (useChunkedReading) {
        if (onProgress) onProgress(0.1);
        text = await readFileInChunks(file);
    } else {
        text = await file.text();
    }

    if (isCSV) {
        if (onProgress) onProgress(0.5);
        const result = parseDatadogCSV(text, fileColor, startId);
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
    const parsedLogs: LogEntry[] = [];
    
    // Report progress after splitting lines
    if (onProgress) onProgress(0.2);

    // Original format: [INFO] [12/17/2024, 09:18:05] [component]: message
    const logRegex1 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{1,2}\/\d{1,2}\/\d{4}),\s(.*?)\]\s\[(.*?)\]:\s(.*)/;

    // ISO format: [INFO] [2025-12-17 09:18:05,686] [component] message
    const logRegex2 = /^\[(INFO|DEBUG|ERROR|WARN)\]\s\[(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2},\d+)\]\s\[(.*?)\]\s(.*)/;

    let currentLog: LogEntry | null = null;
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
                processLogPayload(currentLog);
                parsedLogs.push(currentLog);
            }

            const [_, level, date, time, component, message] = match;

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
                } catch (e) {
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

            let cleaned = cleanupLogEntry(component, message.trim());

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
            currentLog = {
                id: idCounter++,
                timestamp: isNaN(timestamp) ? Date.now() : timestamp,
                rawTimestamp: timestampStr,
                level: level as LogLevel,
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
                // Append to payload
                currentLog.payload += (currentLog.payload ? "\n" : "") + line;
                // Phase 2 Optimization: Defer lowercase computation for payload until processLogPayload
                // This avoids accumulating lowercase strings for very large payloads
                // The lowercase will be computed once in processLogPayload when the log is complete
                currentLog._payloadLower = undefined; // Will be recomputed in processLogPayload
            }
        }
    }

    // Push last log
    if (currentLog) {
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

function processLogPayload(log: LogEntry) {
    // Phase 2 Optimization: Pre-compute lowercase payload once
    const trimmedPayload = log.payload.trim();
    log._payloadLower = trimmedPayload.toLowerCase();

    // 1. Check for JSON
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
        const agentIdMatch = log.payload.match(/agentid=([a-f0-9\-]+)/i);
        if (agentIdMatch && !log.operatorId) {
            log.operatorId = agentIdMatch[1];
        }
    }
    
    // Phase 2 Optimization: Pre-compute lowercase for callId if not already set (from message extraction)
    if (log.callId && !log._callIdLower) {
        log._callIdLower = log.callId.toLowerCase();
    }
}
