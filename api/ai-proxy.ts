/**
 * Vercel serverless proxy for Unleash AI API calls.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.url || '').replace(/^\/api\/ai-proxy/, '') || '/';
  const targetUrl = `https://e-api.unleash.so${path}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'] as string;
    if (req.headers['unleash-account']) headers['unleash-account'] = req.headers['unleash-account'] as string;

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
