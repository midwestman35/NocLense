import { Hono } from 'hono';
import { queryOne } from '../db/query.js';

const jobs = new Hono();

jobs.get('/:id', (c) => {
  const id = c.req.param('id');

  const job = queryOne(
    `SELECT id, file_name as fileName, file_size as fileSize, status, total_parsed as totalParsed, progress, error, created_at as createdAt, completed_at as completedAt FROM jobs WHERE id = ?`,
    [id]
  );

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json(job);
});

export default jobs;
