/**
 * NocLense Server API Client
 *
 * Connects to the noclense-server backend (Vercel deployment) for
 * server-side log parsing, querying, and correlation.
 *
 * @dependencies None (uses native fetch)
 */

import type { LogEntry, LogLevel } from '../types';

// --- Configuration ---

const STORAGE_KEY = 'noclense-server-config';

export interface ServerConfig {
  enabled: boolean;
  baseUrl: string;
  sessionId?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  enabled: false,
  baseUrl: 'https://noclense-server.vercel.app',
};

export function loadServerConfig(): ServerConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export function saveServerConfig(config: ServerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// --- API Client ---

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const config = loadServerConfig();
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText);
    throw new Error(`Server API error ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

// --- Health ---

interface HealthResponse {
  status: string;
  database: { connected: boolean; logCount: number };
  blob: { connected: boolean };
  timestamp: string;
}

export async function checkServerHealth(): Promise<HealthResponse> {
  return apiFetch('/api/health');
}

// --- Sessions ---

interface Session {
  id: string;
  name?: string;
  ticketId?: string;
  fileNames: string[];
  totalLogs: number;
  dateRange?: { start: number; end: number };
  createdAt: string;
}

export async function createSession(name?: string, ticketId?: string): Promise<{ sessionId: string }> {
  return apiFetch('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ sessionName: name, ticketId }),
  });
}

export async function listSessions(): Promise<{ sessions: Session[]; total: number }> {
  return apiFetch('/api/sessions');
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/sessions?id=${sessionId}`, { method: 'DELETE' });
}

// --- File Upload (Vercel Blob client upload) ---

/**
 * Upload a file to Vercel Blob via the server's token endpoint,
 * then trigger server-side parsing.
 *
 * @param file - The File object to upload
 * @param sessionId - Session to associate the parsed logs with
 * @param fileColor - Color hex for the file in the UI
 * @param onProgress - Progress callback (0-1)
 * @returns Parse result with count and sourceType
 */
export async function uploadAndParse(
  file: File,
  sessionId: string,
  fileColor: string = '#3b82f6',
  onProgress?: (progress: number) => void
): Promise<{ count: number; sourceType: string; elapsed: string }> {
  if (onProgress) onProgress(0.05);

  // Step 1: Upload file to Vercel Blob using client upload
  const { upload } = await import('@vercel/blob/client');
  const config = loadServerConfig();

  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: `${config.baseUrl}/api/blob-upload-token`,
  });

  if (onProgress) onProgress(0.4);

  // Step 2: Trigger server-side parsing
  const result = await apiFetch<{
    success: boolean;
    count: number;
    sourceType: string;
    elapsed: string;
  }>('/api/parse', {
    method: 'POST',
    body: JSON.stringify({
      blobUrl: blob.url,
      sessionId,
      fileName: file.name,
      fileColor,
    }),
  });

  if (onProgress) onProgress(1.0);
  return result;
}

// --- Log Queries ---

export interface ServerLogQuery {
  sessionId?: string;
  offset?: number;
  limit?: number;
  level?: LogLevel;
  component?: string;
  callId?: string;
  reportId?: string;
  operatorId?: string;
  extensionId?: string;
  stationId?: string;
  cncId?: string;
  messageId?: string;
  fileName?: string;
  isSip?: boolean;
  search?: string;
  startTime?: number;
  endTime?: number;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  offset: number;
  limit: number;
}

export async function queryLogs(params: ServerLogQuery): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  return apiFetch(`/api/logs?${searchParams.toString()}`);
}

// --- Correlation Counts ---

export type CountType = 'file' | 'callId' | 'report' | 'operator' | 'extension' | 'station' | 'cnc' | 'messageId' | 'messageType';

interface CountsResponse {
  counts: Array<{ value: string; count: number }>;
}

export async function getCounts(type: CountType, sessionId?: string): Promise<CountsResponse> {
  const params = new URLSearchParams({ type });
  if (sessionId) params.set('sessionId', sessionId);
  return apiFetch(`/api/counts?${params.toString()}`);
}

// --- Timeline ---

interface TimelineBucket {
  timestamp: number;
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  sip: number;
}

export async function getTimeline(
  startTime: number,
  endTime: number,
  sessionId?: string,
  bucketSize?: number
): Promise<{ buckets: TimelineBucket[] }> {
  const params = new URLSearchParams({
    startTime: String(startTime),
    endTime: String(endTime),
  });
  if (sessionId) params.set('sessionId', sessionId);
  if (bucketSize) params.set('bucketSize', String(bucketSize));
  return apiFetch(`/api/timeline?${params.toString()}`);
}

// --- Clear ---

export async function clearSession(sessionId: string): Promise<void> {
  await apiFetch('/api/clear', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}
