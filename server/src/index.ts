import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { corsMiddleware } from './middleware/cors.js';
import { initDb, closeDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import upload from './routes/upload.js';
import jobs from './routes/jobs.js';
import logs from './routes/logs.js';
import stats from './routes/stats.js';
import clear from './routes/clear.js';

const app = new Hono();

// CORS
app.use('*', corsMiddleware);

// Health check (no DB needed)
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Routes
app.route('/api/upload', upload);
app.route('/api/jobs', jobs);
app.route('/api/jobs', logs);
app.route('/api/jobs', stats);
app.route('/api/jobs', clear);

async function main() {
  // Initialize DB (async for sql.js WASM load)
  await initDb();
  runMigrations();
  console.log('Database initialized and migrated.');

  const port = parseInt(process.env.PORT || '3001', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`NocLense server listening on http://localhost:${info.port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => { closeDb(); process.exit(0); });
  process.on('SIGTERM', () => { closeDb(); process.exit(0); });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
