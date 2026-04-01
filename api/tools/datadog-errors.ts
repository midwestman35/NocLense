/**
 * POST /api/tools/datadog-errors
 * Query Datadog Logs API for errors in a time window for Unleash agent tool.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSecret, datadogAuth } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!validateSecret(req, res)) return;

  const auth = datadogAuth(res);
  if (!auth) return;

  const body = req.body ?? {};
  const from = body.from;
  const to = body.to;
  if (!from || !to) { res.status(400).json({ error: 'Missing required fields: from, to (ISO-8601)' }); return; }

  const queryFilter = body.query ?? 'service:apex-ng status:error';
  const hosts: string[] = body.hosts ?? [];
  const indexes: string[] = body.indexes ?? ['main', 'ops'];
  const limit = Math.min(body.limit ?? 50, 200);

  // Build Datadog query with optional host filter
  let query = queryFilter;
  if (hosts.length > 0) {
    const hostClause = hosts.map((h: string) => `host:${h.trim()}`).join(' OR ');
    query = `(${query}) AND (${hostClause})`;
  }

  try {
    const apiHost = auth.site.startsWith('api.') ? auth.site : `api.${auth.site}`;
    const url = `https://${apiHost}/api/v2/logs/events/search`;

    const ddBody = {
      filter: { query, from, to, indexes },
      sort: 'timestamp',
      page: { limit: Math.min(limit, 1000) },
    };

    const ddRes = await fetch(url, {
      method: 'POST',
      headers: auth.headers,
      body: JSON.stringify(ddBody),
    });

    if (!ddRes.ok) {
      const text = await ddRes.text().catch(() => ddRes.statusText);
      res.status(ddRes.status).json({ error: `Datadog error: ${ddRes.status}`, details: text.slice(0, 300) });
      return;
    }

    const data = await ddRes.json() as {
      data?: Array<{
        id: string;
        attributes: {
          timestamp: string;
          message: string;
          service?: string;
          host?: string;
          status?: string;
          attributes: Record<string, unknown>;
        };
      }>;
    };

    const logs = (data.data ?? []).slice(0, limit).map(item => {
      const a = item.attributes;
      return {
        timestamp: a.timestamp,
        service: a.service ?? '',
        host: a.host ?? '',
        level: (a.status ?? 'INFO').toUpperCase(),
        message: (a.message ?? '').slice(0, 500),
      };
    });

    // Build summary breakdown
    const byService: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    const byHost: Record<string, number> = {};
    for (const log of logs) {
      byService[log.service] = (byService[log.service] ?? 0) + 1;
      byLevel[log.level] = (byLevel[log.level] ?? 0) + 1;
      if (log.host) byHost[log.host] = (byHost[log.host] ?? 0) + 1;
    }

    res.status(200).json({
      totalReturned: logs.length,
      timeRange: { from, to },
      query,
      logs,
      summary: { byService, byLevel, byHost },
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to query Datadog', details: String(err) });
  }
}
