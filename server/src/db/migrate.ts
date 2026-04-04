import { getDb, saveDb } from './connection.js';

let migrated = false;

/**
 * Run migrations on first call. Creates tables if they don't exist.
 */
export function runMigrations(): void {
  if (migrated) return;

  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_parsed INTEGER NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      timestamp INTEGER NOT NULL,
      raw_timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      component TEXT NOT NULL,
      display_component TEXT NOT NULL,
      message TEXT NOT NULL,
      display_message TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'LOG',
      json_data TEXT,
      is_sip INTEGER NOT NULL DEFAULT 0,
      sip_method TEXT,
      call_id TEXT,
      report_id TEXT,
      operator_id TEXT,
      extension_id TEXT,
      station_id TEXT,
      sip_from TEXT,
      sip_to TEXT,
      message_type TEXT,
      cnc_id TEXT,
      message_id TEXT,
      summary_message TEXT,
      file_name TEXT,
      file_color TEXT,
      source_type TEXT,
      source_label TEXT,
      import_batch_id TEXT,
      imported_at INTEGER
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_job_id ON logs(job_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(job_id, timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(job_id, level)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_component ON logs(job_id, component)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_call_id ON logs(job_id, call_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_file_name ON logs(job_id, file_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_is_sip ON logs(job_id, is_sip)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_report_id ON logs(job_id, report_id)`);

  saveDb();
  migrated = true;
}
