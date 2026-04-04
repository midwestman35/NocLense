import initSqlJs, { type Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;
let dbPath: string = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Lazy init: creates or opens the SQLite DB on first call.
 * Uses sql.js (pure WASM, no native compilation required).
 */
export async function initDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'noclense.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing DB or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // WAL mode not available in sql.js, but we set pragmas for performance
  db.run('PRAGMA journal_mode = DELETE');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

/** Synchronous getter — call initDb() first during startup */
export function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

/** Persist DB to disk. Debounced — call frequently, writes only once per 2s. */
export function saveDb(): void {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!db) return;
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    saveTimer = null;
  }, 2000);
}

/** Force immediate save (for shutdown) */
export function saveDbSync(): void {
  if (!db) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function closeDb(): void {
  if (db) {
    saveDbSync();
    db.close();
    db = null;
  }
}
