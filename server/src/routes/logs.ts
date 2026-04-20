import { Hono } from 'hono';
import { queryAll, queryOne } from '../db/query.js';

const logs = new Hono();

logs.get('/:id/logs', (c) => {
  const jobId = c.req.param('id');

  // Verify job exists
  const job = queryOne('SELECT id FROM jobs WHERE id = ?', [jobId]);
  if (!job) return c.json({ error: 'Job not found' }, 404);

  // Query params
  const limit = Math.min(parseInt(c.req.query('limit') || '5000', 10), 10000);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const level = c.req.query('level');
  const component = c.req.query('component');
  const callId = c.req.query('callId');
  const search = c.req.query('search');
  const isSip = c.req.query('isSip');
  const sortDir = c.req.query('sort') === 'desc' ? 'DESC' : 'ASC';

  // Build query dynamically
  const conditions: string[] = ['job_id = ?'];
  const params: unknown[] = [jobId];

  if (level) {
    conditions.push('level = ?');
    params.push(level);
  }
  if (component) {
    conditions.push('(component = ? OR display_component = ?)');
    params.push(component, component);
  }
  if (callId) {
    conditions.push('call_id = ?');
    params.push(callId);
  }
  if (isSip === 'true') {
    conditions.push('is_sip = 1');
  } else if (isSip === 'false') {
    conditions.push('is_sip = 0');
  }
  if (search) {
    conditions.push('(message LIKE ? OR payload LIKE ? OR display_message LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const where = conditions.join(' AND ');

  // Get total count
  const countRow = queryOne(`SELECT COUNT(*) as total FROM logs WHERE ${where}`, params);
  const total = (countRow?.total as number) ?? 0;

  // Fetch logs
  const rows = queryAll(
    `SELECT
      id, job_id as jobId, timestamp, raw_timestamp as rawTimestamp,
      level, component, display_component as displayComponent,
      message, display_message as displayMessage,
      payload, type, json_data as jsonData,
      is_sip as isSip, sip_method as sipMethod,
      call_id as callId, report_id as reportId,
      operator_id as operatorId, extension_id as extensionId,
      station_id as stationId, sip_from as sipFrom, sip_to as sipTo,
      message_type as messageType, cnc_id as cncID, message_id as messageID,
      summary_message as summaryMessage, file_name as fileName, file_color as fileColor,
      source_type as sourceType, source_label as sourceLabel,
      import_batch_id as importBatchId, imported_at as importedAt
    FROM logs WHERE ${where}
    ORDER BY timestamp ${sortDir}
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Convert isSip from 0/1 to boolean, parse jsonData
  const converted = rows.map((row) => ({
    ...row,
    isSip: row.isSip === 1,
    json: row.jsonData ? tryParseJson(row.jsonData as string) : undefined,
    jsonData: undefined,
  }));

  return c.json({ total, offset, limit, logs: converted });
});

/**
 * Parse JSON string safely, returning undefined if invalid.
 * This is called for jsonData which may be null or malformed.
 */
function tryParseJson(str: string): unknown {
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    // jsonData field is optional; malformed data is silently ignored
    return undefined;
  }
}

export default logs;
