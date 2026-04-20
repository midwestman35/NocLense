/**
 * Server and API Type Definitions
 *
 * Purpose:
 * Consolidates types for server-side configuration, API queries, and server-related types.
 * Represents the contract between frontend and backend services.
 *
 * @module types/server
 */

import type { LogLevel, LogSourceType } from './index';

// ─── Server Configuration ────────────────────────────────────────────────────

export interface ServerConfig {
  enabled: boolean;
  baseUrl: string;
  sessionId?: string;
}

// ─── Log Query Parameters ────────────────────────────────────────────────────

export interface ServerLogQuery {
  sessionId?: string;
  offset?: number;
  limit?: number;
  level?: LogLevel;
  component?: string;
  callId?: string;
  search?: string;
  isSip?: boolean;
  sort?: 'asc' | 'desc';
}

// ─── Count and Correlation Types ────────────────────────────────────────────

export type CountType = 'file' | 'callId' | 'report' | 'operator' | 'extension' | 'station' | 'cnc' | 'messageId' | 'messageType';

// ─── Job Status Types ────────────────────────────────────────────────────────

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

// ─── API Response Types ──────────────────────────────────────────────────────

export interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  logs: any[]; // LogEntry[] would cause circular dependency, keep flexible
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

// ─── Database Row Types ──────────────────────────────────────────────────────

export type JobRowStatus = 'pending' | 'parsing' | 'complete' | 'error';

export interface JobRow {
  id: string;
  file_name: string;
  file_size: number;
  status: JobRowStatus;
  total_parsed: number;
  progress: number;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

export interface LogRow {
  id: number;
  job_id: string;
  timestamp: number;
  raw_timestamp: string;
  level: string;
  component: string;
  display_component: string;
  message: string;
  display_message: string;
  payload: string;
  type: string;
  json_data: string | null;
  is_sip: number; // 0 | 1
  sip_method: string | null;
  call_id: string | null;
  report_id: string | null;
  operator_id: string | null;
  extension_id: string | null;
  station_id: string | null;
  sip_from: string | null;
  sip_to: string | null;
  message_type: string | null;
  cnc_id: string | null;
  message_id: string | null;
  summary_message: string | null;
  file_name: string | null;
  file_color: string | null;
  source_type: string | null;
  source_label: string | null;
  import_batch_id: string | null;
  imported_at: number | null;
}
