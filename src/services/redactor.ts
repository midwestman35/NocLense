import type { NormalizedEvent } from '../types/event';
import type { RedactionPreset } from '../types/export';
export function redactEvent(event: NormalizedEvent, preset: RedactionPreset): NormalizedEvent {
  if (preset === 'raw') return { ...event };
  let redacted = { ...event };
  if (redacted.message) redacted.message = redactString(redacted.message, preset);
  if (redacted.payload) redacted.payload = redactObject(redacted.payload, preset);
  return redacted;
}
function redactString(str: string, preset: 'external' | 'internal'): string {
  let result = str;
  if (preset === 'external') {
    result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  }
  result = result.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, 'Bearer [TOKEN]');
  return result;
}
function redactObject(obj: Record<string, any>, preset: 'external' | 'internal'): Record<string, any> {
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (lk.includes('password') || lk.includes('secret') || lk.includes('token')) redacted[key] = '[REDACTED]';
    else if (typeof value === 'string') redacted[key] = redactString(value, preset);
    else if (typeof value === 'object' && value !== null) redacted[key] = redactObject(value, preset);
    else redacted[key] = value;
  }
  return redacted;
}
