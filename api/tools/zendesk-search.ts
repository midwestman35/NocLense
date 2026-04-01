/**
 * GET /api/tools/zendesk-search?q=audio+POS+4
 * Search Zendesk tickets by keyword for Unleash agent tool.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSecret, zendeskAuth } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!validateSecret(req, res)) return;

  const auth = zendeskAuth(res);
  if (!auth) return;

  const q = String(req.query.q ?? '').trim();
  if (!q) { res.status(400).json({ error: 'Missing required parameter: q' }); return; }

  try {
    const query = `type:ticket ${q}`;
    const url = `https://${auth.subdomain}.zendesk.com/api/v2/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc&per_page=10`;

    const searchRes = await fetch(url, { headers: auth.headers });

    if (!searchRes.ok) {
      if (searchRes.status === 429) { res.status(429).json({ error: 'Zendesk rate limited — try again shortly' }); return; }
      res.status(searchRes.status).json({ error: `Zendesk search error: ${searchRes.status}` }); return;
    }

    const data = await searchRes.json();
    const tickets = (data.results ?? []).slice(0, 10).map((t: Record<string, unknown>) => ({
      id: t.id,
      subject: t.subject ?? '',
      status: t.status ?? '',
      priority: t.priority ?? null,
      createdAt: t.created_at ?? '',
      tags: t.tags ?? [],
      description: ((t.description as string) ?? '').slice(0, 300),
    }));

    res.status(200).json({
      query: q,
      count: data.count ?? tickets.length,
      tickets,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to search tickets', details: String(err) });
  }
}
