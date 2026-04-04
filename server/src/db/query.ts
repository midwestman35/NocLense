import { getDb } from './connection.js';

/**
 * Execute a query and return rows as objects (like better-sqlite3's .all()).
 * sql.js returns {columns, values} — this converts to [{col: val}, ...].
 */
export function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);

  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push(row as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

/**
 * Execute a query and return the first row as an object (like better-sqlite3's .get()).
 */
export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);

  let row: Record<string, unknown> | undefined;
  if (stmt.step()) {
    row = stmt.getAsObject() as Record<string, unknown>;
  }
  stmt.free();
  return row;
}
