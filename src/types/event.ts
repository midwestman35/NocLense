export interface NormalizedEvent {
  id: string; timestamp: number; message: string; payload?: Record<string, any>; extractedFields?: Record<string, any>;
  source?: string; level?: 'debug' | 'info' | 'warn' | 'error'; service?: string;
  requestId?: string; traceId?: string; callId?: string; sipMethod?: string; sipStatus?: string;
  [key: string]: any;
}
