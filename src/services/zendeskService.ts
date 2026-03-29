import type { AiSettings } from '../store/aiSettings';

export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  tags: string[];
  comments: string[];
}

function resolveZendeskUrl(settings: AiSettings, path: string): string {
  if (import.meta.env.DEV) {
    return `/zendesk-proxy${path}`;
  }
  return `https://${settings.zendeskSubdomain}.zendesk.com${path}`;
}

function zendeskHeaders(settings: AiSettings): HeadersInit {
  const credentials = btoa(`${settings.zendeskEmail}/token:${settings.zendeskToken}`);
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${credentials}`,
  };
}

export async function fetchZendeskTicket(
  settings: AiSettings,
  ticketId: string
): Promise<ZendeskTicket> {
  if (!settings.zendeskSubdomain || !settings.zendeskEmail || !settings.zendeskToken) {
    throw new Error('Zendesk is not configured. Add your subdomain, email, and API token in AI Settings.');
  }

  const id = ticketId.trim().replace(/\D/g, '');
  if (!id) throw new Error('Enter a valid ticket number.');

  const headers = zendeskHeaders(settings);

  // Fetch ticket and comments in parallel
  const [ticketRes, commentsRes] = await Promise.all([
    fetch(resolveZendeskUrl(settings, `/api/v2/tickets/${id}.json`), { headers }),
    fetch(resolveZendeskUrl(settings, `/api/v2/tickets/${id}/comments.json`), { headers }),
  ]);

  if (!ticketRes.ok) {
    const detail = await ticketRes.text().catch(() => '');
    if (ticketRes.status === 401) throw new Error('Zendesk authentication failed. Check your email and API token in settings.');
    if (ticketRes.status === 404) throw new Error(`Ticket #${id} not found in Zendesk. (URL: carbyne.zendesk.com — confirm the ticket exists and your account has access)`);
    throw new Error(`Zendesk error (${ticketRes.status}): ${detail || ticketRes.statusText}`);
  }

  const ticketData = await ticketRes.json();
  const ticket = ticketData.ticket;

  // Get requester info
  let requesterName = 'Unknown';
  let requesterEmail = '';
  try {
    const userRes = await fetch(
      resolveZendeskUrl(settings, `/api/v2/users/${ticket.requester_id}.json`),
      { headers }
    );
    if (userRes.ok) {
      const userData = await userRes.json();
      requesterName = userData.user?.name ?? 'Unknown';
      requesterEmail = userData.user?.email ?? '';
    }
  } catch { /* non-fatal */ }

  // Parse comments
  const comments: string[] = [];
  if (commentsRes.ok) {
    const commentsData = await commentsRes.json();
    for (const c of (commentsData.comments ?? []).slice(0, 10)) {
      if (c.body) comments.push(c.body.slice(0, 500));
    }
  }

  return {
    id: ticket.id,
    subject: ticket.subject ?? '',
    description: ticket.description ?? '',
    status: ticket.status ?? '',
    priority: ticket.priority ?? null,
    requesterName,
    requesterEmail,
    createdAt: ticket.created_at ?? '',
    tags: ticket.tags ?? [],
    comments,
  };
}

export function formatTicketForAi(ticket: ZendeskTicket): string {
  const lines: string[] = [
    `Ticket #${ticket.id}: ${ticket.subject}`,
    `Status: ${ticket.status}${ticket.priority ? ` | Priority: ${ticket.priority}` : ''}`,
    `Submitted by: ${ticket.requesterName}${ticket.requesterEmail ? ` <${ticket.requesterEmail}>` : ''}`,
    `Created: ${new Date(ticket.createdAt).toLocaleString()}`,
  ];

  if (ticket.tags.length > 0) {
    lines.push(`Tags: ${ticket.tags.join(', ')}`);
  }

  lines.push('', '--- Description ---', ticket.description);

  if (ticket.comments.length > 1) {
    lines.push('', '--- Comments ---');
    ticket.comments.slice(1).forEach((c, i) => {
      lines.push(`[Comment ${i + 1}] ${c}`);
    });
  }

  return lines.join('\n');
}
