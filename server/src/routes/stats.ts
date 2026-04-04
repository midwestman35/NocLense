import { Hono } from 'hono';
import { queryAll, queryOne } from '../db/query.js';

const stats = new Hono();

stats.get('/:id/stats', (c) => {
  const jobId = c.req.param('id');

  const job = queryOne('SELECT id, status FROM jobs WHERE id = ?', [jobId]);
  if (!job) return c.json({ error: 'Job not found' }, 404);

  // Level counts
  const levelRows = queryAll(
    `SELECT level, COUNT(*) as count FROM logs WHERE job_id = ? GROUP BY level`,
    [jobId]
  );

  // Time range
  const timeRange = queryOne(
    `SELECT MIN(timestamp) as minTime, MAX(timestamp) as maxTime FROM logs WHERE job_id = ?`,
    [jobId]
  );

  // Component counts (top 50)
  const componentCounts = queryAll(
    `SELECT display_component as component, COUNT(*) as count FROM logs WHERE job_id = ? GROUP BY display_component ORDER BY count DESC LIMIT 50`,
    [jobId]
  );

  // Correlation counts
  const correlationFields = [
    { field: 'call_id', name: 'callId' },
    { field: 'report_id', name: 'reportId' },
    { field: 'operator_id', name: 'operatorId' },
    { field: 'extension_id', name: 'extensionId' },
    { field: 'station_id', name: 'stationId' },
    { field: 'file_name', name: 'fileName' },
    { field: 'cnc_id', name: 'cncID' },
    { field: 'message_id', name: 'messageID' },
  ];

  const correlations: Record<string, { value: string; count: number }[]> = {};
  for (const { field, name } of correlationFields) {
    correlations[name] = queryAll(
      `SELECT ${field} as value, COUNT(*) as count FROM logs WHERE job_id = ? AND ${field} IS NOT NULL AND ${field} != '' GROUP BY ${field} ORDER BY count DESC LIMIT 200`,
      [jobId]
    ) as { value: string; count: number }[];
  }

  // SIP method counts
  const sipMethods = queryAll(
    `SELECT sip_method as method, COUNT(*) as count FROM logs WHERE job_id = ? AND sip_method IS NOT NULL GROUP BY sip_method ORDER BY count DESC`,
    [jobId]
  );

  // Total
  const totalRow = queryOne('SELECT COUNT(*) as total FROM logs WHERE job_id = ?', [jobId]);

  return c.json({
    total: (totalRow?.total as number) ?? 0,
    levelCounts: Object.fromEntries(levelRows.map(r => [r.level, r.count])),
    timeRange: {
      min: (timeRange?.minTime as number) ?? 0,
      max: (timeRange?.maxTime as number) ?? 0,
    },
    componentCounts,
    correlations,
    sipMethods,
  });
});

export default stats;
