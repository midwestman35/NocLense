/**
 * NocLense server API client for the standalone backend.
 *
 * This module preserves the older "session" facade used by hidden server-mode
 * UI while routing the actual work through the current `/api/upload` +
 * `/api/jobs/*` contract exposed by the repo's backend.
 */

import { getServerUrl } from '../api/serverConfig';
import type { LogEntry, LogLevel } from '../types';

const STORAGE_KEY = 'noclense-server-config';
const SESSION_JOBS_KEY = 'noclense-server-session-jobs';

export interface ServerConfig {
  enabled: boolean;
  baseUrl: string;
  sessionId?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  enabled: false,
  baseUrl: getServerUrl(),
};

interface SessionJobMap {
  [sessionId: string]: string[];
}

interface HealthResponse {
  status: string;
  database?: { connected: boolean; logCount: number };
  blob?: { connected: boolean };
  timestamp: string | number;
}

interface Session {
  id: string;
  name?: string;
  ticketId?: string;
  fileNames: string[];
  totalLogs: number;
  dateRange?: { start: number; end: number };
  createdAt: string;
}

interface JobStatusResponse {
  id: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'parsing' | 'complete' | 'error';
  totalParsed: number;
  progress: number;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

interface JobStatsResponse {
  total: number;
  correlations: Record<string, Array<{ value: string; count: number }>>;
}

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

export type CountType = 'file' | 'callId' | 'report' | 'operator' | 'extension' | 'station' | 'cnc' | 'messageId' | 'messageType';

interface CountsResponse {
  counts: Array<{ value: string; count: number }>;
}

interface TimelineBucket {
  timestamp: number;
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  sip: number;
}

export function loadServerConfig(): ServerConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {
    // Ignore malformed persisted config and fall back to defaults.
  }
  return { ...DEFAULT_CONFIG };
}

export function saveServerConfig(config: ServerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadSessionJobs(): SessionJobMap {
  try {
    const stored = localStorage.getItem(SESSION_JOBS_KEY);
    return stored ? JSON.parse(stored) as SessionJobMap : {};
  } catch {
    return {};
  }
}

function saveSessionJobs(sessionJobs: SessionJobMap): void {
  localStorage.setItem(SESSION_JOBS_KEY, JSON.stringify(sessionJobs));
}

function ensureSession(sessionId: string): void {
  const sessionJobs = loadSessionJobs();
  if (!sessionJobs[sessionId]) {
    sessionJobs[sessionId] = [];
    saveSessionJobs(sessionJobs);
  }
}

function rememberSessionJob(sessionId: string, jobId: string): void {
  const sessionJobs = loadSessionJobs();
  const jobIds = sessionJobs[sessionId] ?? [];
  if (!jobIds.includes(jobId)) {
    sessionJobs[sessionId] = [...jobIds, jobId];
    saveSessionJobs(sessionJobs);
  }
}

function getSessionJobIds(sessionId?: string): string[] {
  if (!sessionId) return [];
  return loadSessionJobs()[sessionId] ?? [];
}

function clearSessionJobIds(sessionId: string): string[] {
  const sessionJobs = loadSessionJobs();
  const jobIds = sessionJobs[sessionId] ?? [];
  delete sessionJobs[sessionId];
  saveSessionJobs(sessionJobs);
  return jobIds;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const config = loadServerConfig();
  const url = `${config.baseUrl}${path}`;
  const headers = new Headers(options?.headers);

  if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText);
    throw new Error(`Server API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

async function waitForJob(jobId: string, onProgress?: (progress: number) => void): Promise<JobStatusResponse> {
  let status = await apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`);

  while (status.status === 'pending' || status.status === 'parsing') {
    onProgress?.(status.progress);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    status = await apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`);
  }

  if (status.status === 'error') {
    throw new Error(status.error ?? `Server parsing failed for ${status.fileName}`);
  }

  onProgress?.(1);
  return status;
}

async function fetchJobLogs(jobId: string, params: ServerLogQuery): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.level) searchParams.set('level', params.level);
  if (params.component) searchParams.set('component', params.component);
  if (params.callId) searchParams.set('callId', params.callId);
  if (params.search) searchParams.set('search', params.search);
  if (params.isSip !== undefined) searchParams.set('isSip', String(params.isSip));
  const suffix = searchParams.toString();
  return apiFetch<LogsResponse>(`/api/jobs/${jobId}/logs${suffix ? `?${suffix}` : ''}`);
}

export async function checkServerHealth(): Promise<HealthResponse> {
  const response = await apiFetch<Partial<HealthResponse>>('/api/health');
  return {
    status: typeof response.status === 'string' ? response.status : 'ok',
    database: response.database,
    blob: response.blob,
    timestamp: response.timestamp ?? Date.now(),
  };
}

export async function createSession(name?: string, ticketId?: string): Promise<{ sessionId: string }> {
  void name;
  void ticketId;
  const sessionId = generateSessionId();
  ensureSession(sessionId);
  return { sessionId };
}

export async function listSessions(): Promise<{ sessions: Session[]; total: number }> {
  const sessionJobs = loadSessionJobs();
  const sessions = await Promise.all(
    Object.entries(sessionJobs).map(async ([sessionId, jobIds]) => {
      const statuses = await Promise.all(
        jobIds.map(async (jobId) => {
          try {
            return await apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`);
          } catch {
            return null;
          }
        })
      );

      const activeStatuses = statuses.filter((status): status is JobStatusResponse => status !== null);
      const fileNames = activeStatuses.map((status) => status.fileName);
      const totalLogs = activeStatuses.reduce((sum, status) => sum + status.totalParsed, 0);
      const timestamps = activeStatuses.map((status) => status.createdAt);
      const createdAt = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();

      return {
        id: sessionId,
        fileNames,
        totalLogs,
        createdAt: new Date(createdAt).toISOString(),
      };
    })
  );

  return { sessions, total: sessions.length };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await clearSession(sessionId);
}

export async function uploadAndParse(
  file: File,
  sessionId: string,
  fileColor: string = '#3b82f6',
  onProgress?: (progress: number) => void
): Promise<{ count: number; sourceType: string; elapsed: string }> {
  void fileColor;
  const startedAt = Date.now();
  onProgress?.(0);

  const formData = new FormData();
  formData.append('file', file);

  const { jobId } = await apiFetch<{ jobId: string }>('/api/upload', {
    method: 'POST',
    body: formData,
  });

  rememberSessionJob(sessionId, jobId);
  await waitForJob(jobId, onProgress);
  const stats = await apiFetch<JobStatsResponse>(`/api/jobs/${jobId}/stats`);

  return {
    count: stats.total,
    sourceType: 'server',
    elapsed: `${Date.now() - startedAt}ms`,
  };
}

export async function queryLogs(params: ServerLogQuery): Promise<LogsResponse> {
  const jobIds = getSessionJobIds(params.sessionId);
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 5000;

  if (jobIds.length === 0) {
    return { logs: [], total: 0, offset, limit };
  }

  if (jobIds.length === 1) {
    return fetchJobLogs(jobIds[0], params);
  }

  const perJobResults = await Promise.all(
    jobIds.map((jobId) => fetchJobLogs(jobId, { ...params, offset: 0, limit: 10000 }))
  );

  const combinedLogs = perJobResults
    .flatMap((result) => result.logs)
    .sort((left, right) => left.timestamp - right.timestamp);
  const pagedLogs = combinedLogs.slice(offset, offset + limit);

  return {
    logs: pagedLogs,
    total: combinedLogs.length,
    offset,
    limit,
  };
}

export async function getCounts(type: CountType, sessionId?: string): Promise<CountsResponse> {
  const jobIds = getSessionJobIds(sessionId);
  if (jobIds.length === 0) return { counts: [] };

  const statsList = await Promise.all(
    jobIds.map((jobId) => apiFetch<JobStatsResponse>(`/api/jobs/${jobId}/stats`))
  );

  const correlationKey = {
    file: 'fileName',
    callId: 'callId',
    report: 'reportId',
    operator: 'operatorId',
    extension: 'extensionId',
    station: 'stationId',
    cnc: 'cncID',
    messageId: 'messageID',
    messageType: 'messageType',
  }[type];

  if (correlationKey !== 'messageType') {
    const aggregated = new Map<string, number>();
    for (const stats of statsList) {
      for (const entry of stats.correlations[correlationKey] ?? []) {
        aggregated.set(entry.value, (aggregated.get(entry.value) ?? 0) + entry.count);
      }
    }

    return {
      counts: Array.from(aggregated.entries()).map(([value, count]) => ({ value, count })),
    };
  }

  const logs = await queryLogs({ sessionId, limit: 10000, offset: 0 });
  const aggregated = new Map<string, number>();
  for (const log of logs.logs) {
    if (!log.messageType) continue;
    aggregated.set(log.messageType, (aggregated.get(log.messageType) ?? 0) + 1);
  }

  return {
    counts: Array.from(aggregated.entries()).map(([value, count]) => ({ value, count })),
  };
}

export async function getTimeline(
  startTime: number,
  endTime: number,
  sessionId?: string,
  bucketSize: number = 60_000
): Promise<{ buckets: TimelineBucket[] }> {
  const { logs } = await queryLogs({
    sessionId,
    startTime,
    endTime,
    offset: 0,
    limit: 10000,
  });

  const buckets = new Map<number, TimelineBucket>();
  for (const log of logs) {
    if (log.timestamp < startTime || log.timestamp > endTime) continue;
    const bucketTimestamp = startTime + Math.floor((log.timestamp - startTime) / bucketSize) * bucketSize;
    const bucket = buckets.get(bucketTimestamp) ?? {
      timestamp: bucketTimestamp,
      total: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      sip: 0,
    };

    bucket.total += 1;
    if (log.level === 'ERROR') bucket.error += 1;
    if (log.level === 'WARN') bucket.warn += 1;
    if (log.level === 'INFO') bucket.info += 1;
    if (log.level === 'DEBUG') bucket.debug += 1;
    if (log.isSip) bucket.sip += 1;

    buckets.set(bucketTimestamp, bucket);
  }

  return {
    buckets: Array.from(buckets.values()).sort((left, right) => left.timestamp - right.timestamp),
  };
}

export async function clearSession(sessionId: string): Promise<void> {
  const jobIds = clearSessionJobIds(sessionId);
  await Promise.all(
    jobIds.map(async (jobId) => {
      try {
        await apiFetch<{ ok: boolean }>(`/api/jobs/${jobId}`, { method: 'DELETE' });
      } catch {
        // Ignore cleanup failures so a stale backend entry does not block local state reset.
      }
    })
  );
}
