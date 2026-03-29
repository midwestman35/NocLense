/**
 * Typed fetch wrapper for NocLense server API.
 * No additional dependencies — uses native fetch + FormData.
 */

import type { LogEntry } from '../types';
import { getServerUrl } from './serverConfig';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface JobStatus {
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

export interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  logs: LogEntry[];
}

export interface StatsResponse {
  total: number;
  levelCounts: Record<string, number>;
  timeRange: { min: number; max: number };
  componentCounts: { component: string; count: number }[];
  correlations: Record<string, { value: string; count: number }[]>;
  sipMethods: { method: string; count: number }[];
}

export interface LogsQueryParams {
  limit?: number;
  offset?: number;
  level?: string;
  component?: string;
  callId?: string;
  search?: string;
  isSip?: boolean;
  sort?: 'asc' | 'desc';
}

// ─── API Client ──────────────────────────────────────────────────────────────

function apiUrl(path: string): string {
  return `${getServerUrl()}${path}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Server error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Check if the server is reachable.
 * Returns true if healthy, false on any error (network, timeout, etc.).
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(apiUrl('/api/health'), { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a file to the server for parsing.
 * Returns the job ID (HTTP 202).
 */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const result = await fetchJson<{ jobId: string }>(apiUrl('/api/upload'), {
    method: 'POST',
    body: formData,
  });

  return result.jobId;
}

/**
 * Get job status and progress.
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return fetchJson<JobStatus>(apiUrl(`/api/jobs/${jobId}`));
}

/**
 * Fetch logs for a job with optional filters and pagination.
 */
export async function getJobLogs(jobId: string, params: LogsQueryParams = {}): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params.level) searchParams.set('level', params.level);
  if (params.component) searchParams.set('component', params.component);
  if (params.callId) searchParams.set('callId', params.callId);
  if (params.search) searchParams.set('search', params.search);
  if (params.isSip !== undefined) searchParams.set('isSip', String(params.isSip));
  if (params.sort) searchParams.set('sort', params.sort);

  const qs = searchParams.toString();
  return fetchJson<LogsResponse>(apiUrl(`/api/jobs/${jobId}/logs${qs ? `?${qs}` : ''}`));
}

/**
 * Fetch aggregated stats (level counts, correlations, time range, etc.).
 */
export async function getJobStats(jobId: string): Promise<StatsResponse> {
  return fetchJson<StatsResponse>(apiUrl(`/api/jobs/${jobId}/stats`));
}

/**
 * Delete a job and all its logs.
 */
export async function deleteJob(jobId: string): Promise<void> {
  await fetchJson<{ ok: boolean }>(apiUrl(`/api/jobs/${jobId}`), { method: 'DELETE' });
}
