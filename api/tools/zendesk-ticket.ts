/**
 * GET /api/tools/zendesk-ticket?id=12345
 * Fetch a single Zendesk ticket with structured summary for Unleash agent tool.
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

  const subdomain = process.env.VITE_ZENDESK_SUBDOMAIN;
  const email = process.env.VITE_ZENDESK_EMAIL;
  const token = process.env.VITE_ZENDESK_TOKEN;
  if (!subdomain || !email || !token) { res.status(500).json({ error: 'Zendesk credentials not configured' }); return; }

  const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
  const headers = { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` };

  const id = String(req.query.id ?? '').replace(/\D/g, '');
  if (!id) { res.status(400).json({ error: 'Missing required parameter: id' }); return; }

  try {
    const base = `https://${subdomain}.zendesk.com`;

    const [ticketRes, commentsRes] = await Promise.all([
      fetch(`${base}/api/v2/tickets/${id}.json`, { headers }),
      fetch(`${base}/api/v2/tickets/${id}/comments.json`, { headers }),
    ]);

    if (!ticketRes.ok) {
      if (ticketRes.status === 404) { res.status(404).json({ error: `Ticket #${id} not found` }); return; }
      res.status(ticketRes.status).json({ error: `Zendesk error: ${ticketRes.status}` }); return;
    }

    const ticketData = await ticketRes.json();
    const ticket = ticketData.ticket;

    // Fetch requester name
    let requester = 'Unknown';
    let requesterTimezone: string | null = null;
    try {
      const userRes = await fetch(`${base}/api/v2/users/${ticket.requester_id}.json`, { headers });
      if (userRes.ok) {
        const userData = await userRes.json();
        requester = userData.user?.name ?? 'Unknown';
        requesterTimezone = userData.user?.time_zone ?? null;
      }
    } catch { /* non-fatal */ }

    // Fetch org name
    let orgName: string | null = null;
    if (ticket.organization_id) {
      try {
        const orgRes = await fetch(`${base}/api/v2/organizations/${ticket.organization_id}.json`, { headers });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          orgName = orgData.organization?.name ?? null;
        }
      } catch { /* non-fatal */ }
    }

    // Parse comments
    const comments: Array<{ author: string; body: string; createdAt: string; isPublic: boolean }> = [];
    let attachmentCount = 0;
    if (commentsRes.ok) {
      const commentsData = await commentsRes.json();
      for (const c of (commentsData.comments ?? []).slice(-10)) {
        comments.push({
          author: String(c.author_id),
          body: (c.body ?? '').slice(0, 500),
          createdAt: c.created_at ?? '',
          isPublic: c.public ?? true,
        });
        attachmentCount += (c.attachments ?? []).filter((a: { inline?: boolean }) => !a.inline).length;
      }
    }

    res.status(200).json({
      ticketId: ticket.id,
      subject: ticket.subject ?? '',
      status: ticket.status ?? '',
      priority: ticket.priority ?? null,
      requester,
      requesterTimezone,
      organization: orgName,
      createdAt: ticket.created_at ?? '',
      tags: ticket.tags ?? [],
      description: (ticket.description ?? '').slice(0, 2000),
      commentCount: comments.length,
      latestComments: comments.slice(-5),
      attachmentCount,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch ticket', details: String(err) });
  }
}
