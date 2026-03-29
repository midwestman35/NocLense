import { Hono } from 'hono';
import { getDb, saveDb } from '../db/connection.js';
import { queryOne } from '../db/query.js';

const clear = new Hono();

clear.delete('/:id', (c) => {
  const jobId = c.req.param('id');

  const job = queryOne('SELECT id FROM jobs WHERE id = ?', [jobId]);
  if (!job) return c.json({ error: 'Job not found' }, 404);

  const db = getDb();
  // Delete logs first (foreign key), then job
  db.run('DELETE FROM logs WHERE job_id = ?', [jobId]);
  db.run('DELETE FROM jobs WHERE id = ?', [jobId]);
  saveDb();

  return c.json({ ok: true });
});

export default clear;
