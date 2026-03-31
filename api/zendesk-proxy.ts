/**
 * Vercel serverless proxy for Zendesk API calls.
 * Forwards requests to the Zendesk API, bypassing CORS restrictions.
 * Mirrors the Vite dev proxy behavior in production.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const subdomain = process.env.VITE_ZENDESK_SUBDOMAIN;
  if (!subdomain) {
    res.status(500).json({ error: 'VITE_ZENDESK_SUBDOMAIN not configured' });
    return;
  }

  // Strip the /api/zendesk-proxy prefix to get the real Zendesk path
  const path = (req.url || '').replace(/^\/api\/zendesk-proxy/, '') || '/';
  const targetUrl = `https://${subdomain}.zendesk.com${path}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'] as string;

    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status);
    // Forward content-type
    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: 'Proxy failed', details: String(err) });
  }
}
