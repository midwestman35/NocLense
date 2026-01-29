/**
 * Extract structured key-value fields from a LogEntry for CloudWatch-style "Fields" panel.
 * Flattens JSON (top-level + common nested keys), SIP headers, and correlation fields.
 */

import type { LogEntry } from '../types';

export interface FieldEntry {
  key: string;
  value: string | number | boolean | null;
  type: 'correlation' | 'json' | 'sip';
}

const CORRELATION_KEYS = [
  'messageType',
  'cncID',
  'messageID',
  'reportID',
  'reportId',
  'operatorID',
  'operatorId',
  'extensionID',
  'extensionId',
  'stationId',
  'callId',
  'Call-ID',
  'sipFrom',
  'sipTo',
] as const;

/** Flatten an object to top-level key-value pairs; expand arrays as "key[0]", "key.length", etc. */
function flattenForFields(obj: Record<string, unknown>, prefix = ''): Array<{ key: string; value: unknown }> {
  const out: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) {
      out.push({ key: fullKey, value: v });
      continue;
    }
    if (Array.isArray(v)) {
      out.push({ key: `${fullKey}.length`, value: v.length });
      const slice = v.slice(0, 5);
      slice.forEach((item, i) => {
        if (item !== null && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) {
          flattenForFields(item as Record<string, unknown>, `${fullKey}[${i}]`).forEach(x => out.push(x));
        } else {
          out.push({ key: `${fullKey}[${i}]`, value: String(item) });
        }
      });
      if (v.length > 5) out.push({ key: `${fullKey}.truncated`, value: `... +${v.length - 5} more` });
      continue;
    }
    if (typeof v === 'object' && !(v instanceof Date)) {
      const nested = flattenForFields(v as Record<string, unknown>, fullKey);
      if (nested.length <= 8) {
        out.push(...nested);
      } else {
        out.push({ key: fullKey, value: `[object, ${nested.length} keys]` });
      }
      continue;
    }
    out.push({ key: fullKey, value: v });
  }
  return out;
}

/** Normalize value for display (string, number, boolean, or "null"). */
function normalizeValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Extract SIP header key-value pairs from payload. */
function extractSipHeaders(payload: string): Array<{ key: string; value: string }> {
  const pairs: Array<{ key: string; value: string }> = [];
  const headerRe = /^([A-Za-z][A-Za-z0-9\-]*):\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(payload)) !== null) {
    const key = m[1].trim();
    const value = m[2].trim();
    if (key && value) pairs.push({ key, value });
  }
  return pairs;
}

/**
 * Build structured fields list for a log entry (details panel / copy-friendly).
 * Order: correlation-style first (messageType, cncID, messageID, reportID, …), then JSON, then SIP.
 */
export function getStructuredFields(log: LogEntry): FieldEntry[] {
  const seen = new Set<string>();
  const fields: FieldEntry[] = [];

  const add = (key: string, value: string | number | boolean | null, type: FieldEntry['type']) => {
    const k = key.replace(/\./g, '_');
    if (seen.has(k)) return;
    seen.add(k);
    fields.push({ key, value, type });
  };

  // 1. Correlation-style from LogEntry
  if (log.messageType != null) add('messageType', String(log.messageType), 'correlation');
  if (log.cncID != null) add('cncID', String(log.cncID), 'correlation');
  if (log.messageID != null) add('messageID', String(log.messageID), 'correlation');
  if (log.reportId != null) add('reportID', String(log.reportId), 'correlation');
  if (log.operatorId != null) add('operatorID', String(log.operatorId), 'correlation');
  if (log.extensionId != null) add('extensionID', String(log.extensionId), 'correlation');
  if (log.stationId != null) add('stationId', String(log.stationId), 'correlation');
  if (log.callId != null) add('Call-ID', String(log.callId), 'correlation');
  if (log.sipFrom != null) add('sipFrom', String(log.sipFrom), 'correlation');
  if (log.sipTo != null) add('sipTo', String(log.sipTo), 'correlation');

  // 2. From JSON (flatten, avoid duplicating correlation keys we already have)
  const skipKeys = new Set(CORRELATION_KEYS.map(x => x.toLowerCase()));
  if (log.type === 'JSON' && log.json && typeof log.json === 'object') {
    const flat = flattenForFields(log.json as Record<string, unknown>);
    for (const { key, value } of flat) {
      const base = key.split(/[.\[]/)[0]?.toLowerCase();
      if (base && skipKeys.has(base)) continue;
      add(key, normalizeValue(value) as string | number | boolean | null, 'json');
    }
  }

  // 3. SIP headers from payload (if any)
  if (log.payload && (log.payload.includes('SIP/2.0') || /^\w+:\s*.+$/m.test(log.payload))) {
    const sip = extractSipHeaders(log.payload);
    for (const { key, value } of sip) {
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push({ key, value, type: 'sip' });
    }
  }

  return fields;
}
