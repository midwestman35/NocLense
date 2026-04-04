/**
 * schema.ts — TypeScript types mirroring the SQLite tables.
 *
 * Tables are created via inline SQL in migrate.ts (using sql.js directly).
 * This file provides the TypeScript shape for type-safe query results and
 * insert objects — no ORM dependency required.
 */

// ─── jobs table ──────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'parsing' | 'complete' | 'error';

export interface JobRow {
  id: string;
  file_name: string;
  file_size: number;
  status: JobStatus;
  total_parsed: number;
  progress: number;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

// ─── logs table ──────────────────────────────────────────────────────────────

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
