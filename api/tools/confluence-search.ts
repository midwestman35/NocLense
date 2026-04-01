/**
 * GET /api/tools/confluence-search?q=DTMF+Language+Line
 * Search Confluence knowledge base for Unleash agent tool.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function validateSecret(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.TOOL_SECRET;
  if (!secret) { res.status(500).json({ error: 'TOOL_SECRET not configured' }); return false; }
  if (req.headers['x-tool-secret'] !== secret) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!validateSecret(req, res)) return;

  const subdomain = process.env.VITE_JIRA_SUBDOMAIN;
  const email = process.env.VITE_JIRA_EMAIL;
  const token = process.env.VITE_JIRA_TOKEN;
  if (!subdomain || !email || !token) { res.status(500).json({ error: 'Confluence/Jira credentials not configured' }); return; }

  const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
  const headers = { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` };

  const q = String(req.query.q ?? '').trim();
  if (!q) { res.status(400).json({ error: 'Missing required parameter: q' }); return; }

  try {
    const parentPageId = process.env.VITE_CONFLUENCE_PARENT_PAGE_ID;
    const spaceId = process.env.VITE_CONFLUENCE_SPACE_ID;

    // Build CQL query terms
    const terms = q.split(/\s+/).filter(t => t.length > 2).map(t => `"${t}"`).join(' OR ');
    let cql = `type = page AND (text ~ ${terms})`;
    if (parentPageId) cql = `ancestor = ${parentPageId} AND ${cql}`;
    else if (spaceId) cql = `space.id = ${spaceId} AND ${cql}`;
    cql += ' ORDER BY lastmodified DESC';

    const url = `https://${subdomain}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=10`;

    const confRes = await fetch(url, { headers });

    if (!confRes.ok) {
      const text = await confRes.text().catch(() => confRes.statusText);
      res.status(confRes.status).json({ error: `Confluence error: ${confRes.status}`, details: text.slice(0, 300) });
      return;
    }

    const data = await confRes.json();
    const results = (data.results ?? []).map((r: Record<string, unknown>) => {
      const links = r._links as Record<string, string> | undefined;
      return {
        pageId: String(r.id),
        title: (r.title as string) ?? '',
        excerpt: ((r.excerpt as string) ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
        url: links?.base ? `${links.base}${links.webui}` : '',
        lastModified: ((r.history as Record<string, unknown> | undefined)?.lastUpdated as string) ?? '',
      };
    });

    res.status(200).json({
      query: q,
      count: results.length,
      results,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to search Confluence', details: String(err) });
  }
}
