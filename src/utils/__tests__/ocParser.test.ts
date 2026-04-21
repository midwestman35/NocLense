import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getOperatorClientValueAtPath, parseOperatorClientLog } from '../parser';

const FIXTURE_DIR = join(process.cwd(), 'src', 'tests', 'fixtures', 'oc');
const TEST_HEADER_REGEX = /^\[(ERROR|WARN|INFO|DEBUG)\] \[(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}:\d{2} (?:AM|PM)),(\d{1,3})\] \[([^\]]+)\]: (.*)$/;

function readFixture(name: string): string {
    return readFileSync(join(FIXTURE_DIR, name), 'utf8');
}

function extractExpectedBodies(text: string): string[] {
    const lines = text.split(/\r?\n/);
    const bodies: string[] = [];
    let currentBody: string[] | null = null;

    for (const [index, line] of lines.entries()) {
        if (index === lines.length - 1 && line === '') {
            continue;
        }

        if (TEST_HEADER_REGEX.test(line)) {
            if (currentBody !== null) {
                bodies.push(currentBody.join('\n'));
            }
            currentBody = [];
            continue;
        }

        if (currentBody !== null) {
            currentBody.push(line);
        }
    }

    if (currentBody !== null) {
        bodies.push(currentBody.join('\n'));
    }

    return bodies;
}

describe('parseOperatorClientLog', () => {
    it('parses canonical fixture with locators and file metadata', () => {
        const text = readFixture('canonical.log');
        const entries = parseOperatorClientLog(text, '#0ea5e9', 100, 'canonical.log', 'America/Chicago');

        expect(entries).toHaveLength(20);
        expect(entries.every((entry) => entry.fileName === 'canonical.log')).toBe(true);
        expect(entries[0]?.lineNumber).toBe(1);
        expect(entries[0]?.byteOffset).toBe(0);
    });

    it('extracts traceId for every canonical entry', () => {
        const entries = parseOperatorClientLog(readFixture('canonical.log'), '#0ea5e9', 1, 'canonical.log', 'America/Chicago');

        expect(entries.every((entry) => typeof entry.traceId === 'string' && entry.traceId.length > 0)).toBe(true);
    });

    it('extracts callId from canonical JSON bodies', () => {
        const entries = parseOperatorClientLog(readFixture('canonical.log'), '#0ea5e9', 1, 'canonical.log', 'America/Chicago');

        expect(entries.every((entry) => typeof entry.callId === 'string' && entry.callId.length > 0)).toBe(true);
    });

    it('preserves payload as the raw body text for canonical entries', () => {
        const text = readFixture('canonical.log');
        const entries = parseOperatorClientLog(text, '#0ea5e9', 1, 'canonical.log', 'America/Chicago');
        const expectedBodies = extractExpectedBodies(text);

        expect(entries.map((entry) => entry.payload)).toEqual(expectedBodies);
    });

    it('stores sourceTimezone on every canonical entry', () => {
        const entries = parseOperatorClientLog(readFixture('canonical.log'), '#0ea5e9', 1, 'canonical.log', 'America/Chicago');

        expect(entries.every((entry) => entry.sourceTimezone === 'America/Chicago')).toBe(true);
    });

    it('retains every malformed fixture entry', () => {
        const entries = parseOperatorClientLog(readFixture('malformed.log'), '#f97316', 1, 'malformed.log', 'America/Chicago');

        expect(entries).toHaveLength(10);
    });

    it('marks malformed JSON entries and preserves raw payload text', () => {
        const text = readFixture('malformed.log');
        const entries = parseOperatorClientLog(text, '#f97316', 1, 'malformed.log', 'America/Chicago');
        const expectedBodies = extractExpectedBodies(text);
        const malformedEntries = entries.filter((entry) => entry.jsonMalformed === true);

        expect(malformedEntries).toHaveLength(5);
        expect(malformedEntries.every((entry) => entry.json === undefined)).toBe(true);
        expect(malformedEntries.every((entry) => entry.payload === expectedBodies[entry.id - 1])).toBe(true);
    });

    it('marks valid JSON entries explicitly as not malformed', () => {
        const entries = parseOperatorClientLog(readFixture('malformed.log'), '#f97316', 1, 'malformed.log', 'America/Chicago');

        expect(entries.filter((entry) => entry.jsonMalformed === false)).toHaveLength(5);
    });

    it('does not split entries when bracket tags appear inside JSON string bodies', () => {
        const entries = parseOperatorClientLog(readFixture('embedded-brackets.log'), '#22c55e', 1, 'embedded-brackets.log', 'America/Chicago');

        expect(entries).toHaveLength(8);
        expect(entries[0]?.payload.includes('[INFO] transfer completed')).toBe(true);
        expect(entries[1]?.payload.includes('[ERROR] media timeout')).toBe(true);
        expect(entries[3]?.payload.includes('[INFO] and [ERROR] markers')).toBe(true);
    });

    it('leaves plain-text mixed-level bodies without jsonMalformed markers', () => {
        const entries = parseOperatorClientLog(readFixture('mixed-levels.log'), '#a855f7', 1, 'mixed-levels.log', 'America/Chicago');
        const plainTextEntries = entries.filter((entry) => !entry.payload.trim().startsWith('{') && !entry.payload.trim().startsWith('['));

        expect(plainTextEntries.length).toBeGreaterThan(0);
        expect(plainTextEntries.every((entry) => entry.json === undefined && entry.jsonMalformed === undefined)).toBe(true);
    });

    it('preserves mixed-level distribution', () => {
        const entries = parseOperatorClientLog(readFixture('mixed-levels.log'), '#a855f7', 1, 'mixed-levels.log', 'America/Chicago');
        const counts = entries.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.level] = (acc[entry.level] ?? 0) + 1;
            return acc;
        }, {});

        expect(counts.ERROR).toBe(4);
        expect(counts.WARN).toBe(4);
        expect(counts.INFO).toBe(4);
        expect(counts.DEBUG).toBe(4);
    });

    it('tracks byte offsets correctly for CRLF input', () => {
        const text = [
            '[INFO] [4/20/2026, 1:00:00 PM,100] [CallProcessor]: first entry',
            '{"traceId":"crlf-trace-1","callId":"crlf-call-1"}',
            '[WARN] [4/20/2026, 1:00:01 PM,110] [SipStack]: second entry',
            '{"traceId":"crlf-trace-2","callId":"crlf-call-2"}',
        ].join('\r\n');
        const entries = parseOperatorClientLog(text, '#0ea5e9', 1, 'crlf.log', 'America/Chicago');
        const expectedOffset = new TextEncoder().encode(
            '[INFO] [4/20/2026, 1:00:00 PM,100] [CallProcessor]: first entry\r\n{"traceId":"crlf-trace-1","callId":"crlf-call-1"}\r\n',
        ).length;

        expect(entries).toHaveLength(2);
        expect(entries[1]?.byteOffset).toBe(expectedOffset);
        expect(entries[1]?.lineNumber).toBe(3);
    });

    it('returns undefined for missing or non-object dot-path intermediates', () => {
        expect(getOperatorClientValueAtPath({ trace: null }, 'trace.id')).toBeUndefined();
        expect(getOperatorClientValueAtPath({ trace: 'flat-value' }, 'trace.id')).toBeUndefined();
        expect(getOperatorClientValueAtPath({ trace: { id: 42 } }, 'trace.id')).toBe('42');
    });

    it('falls back to timestamp zero and preserves the corrupt raw timestamp', () => {
        const text = [
            '[INFO] [13/40/2026, 99:61:61 AM,999] [CallProcessor]: corrupt timestamp entry',
            '{"traceId":"bad-ts","callId":"bad-call"}',
        ].join('\n');
        const [entry] = parseOperatorClientLog(text, '#ef4444', 1, 'bad-timestamp.log', 'America/Chicago');

        expect(entry?.timestamp).toBe(0);
        expect(entry?.rawTimestamp).toBe('13/40/2026, 99:61:61 AM,999');
    });
});
