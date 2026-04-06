#!/usr/bin/env node

/**
 * Generate Large Test Log File
 * 
 * Creates a large log file (50k+ entries) for testing Phase 1 crash fixes,
 * specifically Test 2: Spread Operator Fix
 * 
 * Usage:
 *   node scripts/generate-large-log.js [entries] [output-file]
 * 
 * Examples:
 *   node scripts/generate-large-log.js 50000 test-large.log
 *   node scripts/generate-large-log.js 100000 test-very-large.log
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const entries = parseInt(process.argv[2]) || 50000;
const outputFile = process.argv[3] || 'test-large-dataset.log';

// Log formats supported by the parser
const LEVELS = ['INFO', 'DEBUG', 'ERROR', 'WARN'];
const COMPONENTS = [
    'com.example.service.UserService',
    'com.example.controller.AuthController',
    'com.example.repository.UserRepository',
    'com.example.middleware.LoggingMiddleware',
    'com.example.database.DatabaseConnection',
    'com.example.api.PaymentAPI',
    'com.example.service.NotificationService',
    'com.example.cache.RedisCache',
    'com.example.queue.MessageQueue',
    'com.example.worker.BackgroundWorker'
];

const MESSAGES = [
    'Processing user request',
    'Database query executed',
    'Cache hit for key',
    'Sending notification to user',
    'Background job started',
    'Request validated successfully',
    'Payment processed',
    'Session created',
    'Log entry written',
    'Configuration loaded',
    'Connection established',
    'Transaction committed',
    'File uploaded successfully',
    'API call completed',
    'Error occurred during processing'
];

/**
 * Generate a random log entry in the format expected by the parser
 * Format: [LEVEL] [MM/DD/YYYY, HH:MM:SS] [component]: message
 */
function generateLogEntry(id) {
    const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    const component = COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)];
    const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    
    // Generate timestamp (dates spread over the last year)
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 365);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const secondsAgo = Math.floor(Math.random() * 60);
    const millis = Math.floor(Math.random() * 1000);
    
    const logDate = new Date(now);
    logDate.setDate(logDate.getDate() - daysAgo);
    logDate.setHours(logDate.getHours() - hoursAgo);
    logDate.setMinutes(logDate.getMinutes() - minutesAgo);
    logDate.setSeconds(logDate.getSeconds() - secondsAgo);
    
    // Format: MM/DD/YYYY, HH:MM:SS
    const month = String(logDate.getMonth() + 1).padStart(2, '0');
    const day = String(logDate.getDate()).padStart(2, '0');
    const year = logDate.getFullYear();
    const hours = String(logDate.getHours()).padStart(2, '0');
    const minutes = String(logDate.getMinutes()).padStart(2, '0');
    const seconds = String(logDate.getSeconds()).padStart(2, '0');
    
    const timestamp = `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
    
    // Add some variety - sometimes include IDs, sometimes add details
    let fullMessage = message;
    if (Math.random() > 0.5) {
        fullMessage += ` (id: ${id})`;
    }
    if (Math.random() > 0.7) {
        fullMessage += ` - callId: ${generateCallId()}`;
    }
    if (Math.random() > 0.8) {
        fullMessage += ` - extensionID: Optional[${Math.floor(1000 + Math.random() * 9000)}]`;
    }
    
    return `[${level}] [${timestamp}] [${component}]: ${fullMessage}`;
}

/**
 * Generate a random Call-ID (SIP format)
 */
function generateCallId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-';
    let callId = '';
    for (let i = 0; i < 32; i++) {
        callId += chars[Math.floor(Math.random() * chars.length)];
    }
    return callId;
}

/**
 * Main function to generate the log file
 */
function generateLogFile(numEntries, outputPath) {
    console.log(`Generating log file with ${numEntries.toLocaleString()} entries...`);
    console.log(`Output file: ${outputPath}`);
    console.log('');
    
    const startTime = Date.now();
    const stream = fs.createWriteStream(outputPath, { flags: 'w' });
    
    let written = 0;
    const progressInterval = setInterval(() => {
        const percent = ((written / numEntries) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${percent}% (${written.toLocaleString()}/${numEntries.toLocaleString()} entries)`);
    }, 100);
    
    // Write entries in batches to be more efficient
    const batchSize = 1000;
    let currentBatch = [];
    let id = 1;
    
    function writeBatch() {
        if (currentBatch.length > 0) {
            stream.write(currentBatch.join('\n') + '\n');
            written += currentBatch.length;
            currentBatch = [];
        }
        
        if (written < numEntries) {
            // Generate next batch
            for (let i = 0; i < batchSize && written + currentBatch.length < numEntries; i++) {
                currentBatch.push(generateLogEntry(id++));
            }
            setImmediate(writeBatch);
        } else {
            clearInterval(progressInterval);
            stream.end();
            
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            const stats = fs.statSync(outputPath);
            const fileSize = (stats.size / 1024 / 1024).toFixed(2);
            
            console.log('\n');
            console.log('✅ Log file generated successfully!');
            console.log(`   Entries: ${written.toLocaleString()}`);
            console.log(`   File size: ${fileSize} MB`);
            console.log(`   Duration: ${duration} seconds`);
            console.log(`   Location: ${path.resolve(outputPath)}`);
            console.log('');
            console.log('📝 To test: Upload this file to NocLense');
            console.log(`   Expected: Should parse without "Maximum call stack size exceeded" error`);
        }
    }
    
    stream.on('error', (err) => {
        clearInterval(progressInterval);
        console.error('\n❌ Error writing file:', err.message);
        process.exit(1);
    });
    
    // Start writing
    writeBatch();
}

// Validate entries
if (entries < 1) {
    console.error('❌ Error: Number of entries must be at least 1');
    process.exit(1);
}

if (entries > 1000000) {
    console.warn('⚠️  Warning: Generating more than 1 million entries may take a long time and create a very large file.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    setTimeout(() => {
        generateLogFile(entries, outputFile);
    }, 5000);
} else {
    generateLogFile(entries, outputFile);
}
