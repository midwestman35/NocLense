import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from '../db/connection.js';
import { parseFile } from '../parser/worker.js';

const upload = new Hono();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'tmp');

upload.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // Ensure upload dir exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const jobId = uuidv4();
  const tempPath = path.join(UPLOAD_DIR, `${jobId}-${file.name}`);

  // Write uploaded file to disk
  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));

  // Create job record
  const db = getDb();
  db.run(
    `INSERT INTO jobs (id, file_name, file_size, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
    [jobId, file.name, file.size, Date.now()]
  );
  saveDb();

  // Start parsing in background (non-blocking)
  parseFile({
    jobId,
    filePath: tempPath,
    fileName: file.name,
  }).catch((err) => {
    console.error(`Parse error for job ${jobId}:`, err);
  });

  return c.json({ jobId }, 202);
});

export default upload;
