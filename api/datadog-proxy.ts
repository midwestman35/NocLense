/**
 * Vercel serverless proxy for Datadog API calls.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const site = process.env.VITE_DATADOG_SITE || 'datadoghq.com';

  const path = (req.url || '').replace(/^\/api\/datadog-proxy/, '') || '/';
  const targetUrl = `https://api.${site}${path}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['dd-api-key']) headers['DD-API-KEY'] = req.headers['dd-api-key'] as string;
    if (req.headers['dd-application-key']) headers['DD-APPLICATION-KEY'] = req.headers['dd-application-key'] as string;

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status);
    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: 'Proxy failed', details: String(err) });
  }
}
