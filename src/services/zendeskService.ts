import type { AiSettings } from '../store/aiSettings';

export interface ZendeskAttachment {
  id: number;
  fileName: string;
  contentUrl: string;
  contentType: string;
  size: number;
  /** True when the file is an inline image embed rather than a standalone attachment */
  inline: boolean;
  /** Whether the comment it came from was public-facing or an internal note */
  commentType: 'public' | 'internal';
}

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
  requesterTimezone: string | null;
  orgId: number | null;
  orgName: string | null;
  orgTimezone: string | null;
  attachments: ZendeskAttachment[];
}

export interface ZendeskTicketDraft {
  subject: string;
  description: string;
  requesterEmail?: string;
}

function resolveZendeskUrl(settings: AiSettings, path: string): string {
  if (import.meta.env.DEV) {
    return `/zendesk-proxy${path}`;
  }
  // Production Vercel: use serverless proxy to bypass CORS
  // Electron: direct URL (no CORS in desktop app)
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return `https://${settings.zendeskSubdomain}.zendesk.com${path}`;
  }
  return `/api/zendesk-proxy${path}`;
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

  const [ticketRes, commentsRes] = await Promise.all([
    fetch(resolveZendeskUrl(settings, `/api/v2/tickets/${id}.json`), { headers }),
    fetch(resolveZendeskUrl(settings, `/api/v2/tickets/${id}/comments.json`), { headers }),
  ]);

  if (!ticketRes.ok) {
    const detail = await ticketRes.text().catch(() => '');
    if (ticketRes.status === 401) throw new Error('Zendesk authentication failed. Check your email and API token in settings.');
    if (ticketRes.status === 404) throw new Error(`Ticket #${id} not found. Confirm it exists and your account has access.`);
    throw new Error(`Zendesk error (${ticketRes.status}): ${detail || ticketRes.statusText}`);
  }

  const ticketData = await ticketRes.json();
  const ticket = ticketData.ticket;

  let requesterName = 'Unknown';
  let requesterEmail = '';
  let requesterTimezone: string | null = null;
  let orgId: number | null = ticket.organization_id ?? null;

  try {
    const userRes = await fetch(
      resolveZendeskUrl(settings, `/api/v2/users/${ticket.requester_id}.json`),
      { headers }
    );
    if (userRes.ok) {
      const userData = await userRes.json();
      requesterName = userData.user?.name ?? 'Unknown';
      requesterEmail = userData.user?.email ?? '';
      requesterTimezone = userData.user?.time_zone ?? null;
      if (!orgId) orgId = userData.user?.organization_id ?? null;
    }
  } catch { /* non-fatal */ }

  let orgName: string | null = null;
  let orgTimezone: string | null = null;
  if (orgId) {
    try {
      const orgRes = await fetch(
        resolveZendeskUrl(settings, `/api/v2/organizations/${orgId}.json`),
        { headers }
      );
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        orgName = orgData.organization?.name ?? null;
        orgTimezone = orgData.organization?.time_zone ?? null;
      }
    } catch { /* non-fatal */ }
  }

  const comments: string[] = [];
  const attachments: ZendeskAttachment[] = [];
  if (commentsRes.ok) {
    const commentsData = await commentsRes.json();
    for (const c of (commentsData.comments ?? []).slice(0, 10)) {
      if (c.body) comments.push(c.body.slice(0, 500));
      // Collect non-inline attachments from every comment (public + internal notes)
      for (const att of (c.attachments ?? [])) {
        if (!att.inline && att.content_url) {
          attachments.push({
            id: att.id,
            fileName: att.file_name ?? 'attachment',
            contentUrl: att.content_url,
            contentType: att.content_type ?? 'application/octet-stream',
            size: att.size ?? 0,
            inline: false,
            commentType: c.public ? 'public' : 'internal',
          });
        }
      }
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
    requesterTimezone,
    orgId,
    orgName,
    orgTimezone,
    attachments,
  };
}

/**
 * Search Zendesk for closed tickets matching keywords.
 * Uses the Zendesk Search API with OR-joined keywords.
 * Rate limit: 10 requests/minute for search endpoints.
 */
export async function searchZendeskTickets(
  settings: AiSettings,
  keywords: string[],
  limit: number = 5
): Promise<Array<{ id: number; subject: string; status: string; createdAt: string; tags: string[]; description: string }>> {
  if (!settings.zendeskSubdomain || !settings.zendeskEmail || !settings.zendeskToken) {
    throw new Error('Zendesk is not configured.');
  }

  const cleaned = keywords
    .map(k => k.trim().replace(/['"]/g, ''))
    .filter(k => k.length > 2);
  if (cleaned.length === 0) return [];

  const searchTerms = cleaned.map(k => `"${k}"`).join(' ');
  const query = `type:ticket status:closed ${searchTerms}`;
  const url = resolveZendeskUrl(
    settings,
    `/api/v2/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc&per_page=${limit}`
  );

  const res = await fetch(url, { headers: zendeskHeaders(settings) });
  if (!res.ok) {
    if (res.status === 429) {
      console.warn('[Zendesk Search] Rate limited — try again in a moment.');
      return [];
    }
    throw new Error(`Zendesk search failed (${res.status})`);
  }

  const data = await res.json();
  return (data.results ?? []).slice(0, limit).map((t: Record<string, unknown>) => ({
    id: t.id as number,
    subject: (t.subject as string) ?? '',
    status: (t.status as string) ?? 'closed',
    createdAt: (t.created_at as string) ?? '',
    tags: (t.tags as string[]) ?? [],
    description: ((t.description as string) ?? '').slice(0, 300),
  }));
}

export async function createZendeskTicket(
  settings: AiSettings,
  draft: ZendeskTicketDraft
): Promise<ZendeskTicket> {
  if (!settings.zendeskSubdomain || !settings.zendeskEmail || !settings.zendeskToken) {
    throw new Error('Zendesk is not configured. Add your subdomain, email, and API token in AI Settings.');
  }

  const headers = zendeskHeaders(settings);
  const url = resolveZendeskUrl(settings, '/api/v2/tickets.json');

  const body: Record<string, unknown> = {
    ticket: {
      subject: draft.subject,
      comment: { body: draft.description },
      ...(draft.requesterEmail ? { requester: { email: draft.requesterEmail } } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e: unknown) {
    throw new Error(`Network error creating Zendesk ticket. (${e instanceof Error ? e.message : String(e)})`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Zendesk authentication failed. Check your credentials in settings.');
    throw new Error(`Zendesk error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await res.json();
  const ticket = data.ticket;

  return {
    id: ticket.id,
    subject: ticket.subject ?? draft.subject,
    description: draft.description,
    status: ticket.status ?? 'new',
    priority: ticket.priority ?? null,
    requesterName: draft.requesterEmail ?? settings.zendeskEmail,
    requesterEmail: draft.requesterEmail ?? '',
    createdAt: ticket.created_at ?? new Date().toISOString(),
    tags: ticket.tags ?? [],
    comments: [draft.description],
    requesterTimezone: null,
    orgId: ticket.organization_id ?? null,
    orgName: null,
    orgTimezone: null,
    attachments: [],
  };
}

/**
 * Download a Zendesk ticket attachment as a Blob.
 * In DEV the request is routed through the Vite proxy to avoid CORS.
 */
export async function downloadZendeskAttachment(
  settings: AiSettings,
  attachment: ZendeskAttachment
): Promise<Blob> {
  if (!settings.zendeskSubdomain || !settings.zendeskEmail || !settings.zendeskToken) {
    throw new Error('Zendesk is not configured.');
  }

  // In DEV: rewrite the CDN/subdomain URL through the local proxy
  let url: string;
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  if (import.meta.env.DEV) {
    url = attachment.contentUrl.replace(
      new RegExp(`https://${settings.zendeskSubdomain}\\.zendesk\\.com`, 'i'),
      '/zendesk-proxy'
    );
    // If rewrite didn't match (different subdomain or CDN URL), fall through to direct
    if (url === attachment.contentUrl) {
      url = attachment.contentUrl;
    }
  } else if (!isElectron) {
    // Production Vercel: proxy through serverless function
    url = attachment.contentUrl.replace(
      new RegExp(`https://${settings.zendeskSubdomain}\\.zendesk\\.com`, 'i'),
      '/api/zendesk-proxy'
    );
    if (url === attachment.contentUrl) {
      url = attachment.contentUrl;
    }
  } else {
    url = attachment.contentUrl;
  }

  const credentials = btoa(`${settings.zendeskEmail}/token:${settings.zendeskToken}`);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
  } catch (e: unknown) {
    throw new Error(`Network error downloading "${attachment.fileName}". (${e instanceof Error ? e.message : String(e)})`);
  }

  if (!res.ok) {
    throw new Error(`Failed to download "${attachment.fileName}" (${res.status}): ${res.statusText}`);
  }

  return res.blob();
}

export async function uploadZendeskAttachment(
  settings: AiSettings,
  blob: Blob,
  filename: string
): Promise<string> {
  if (!settings.zendeskSubdomain || !settings.zendeskEmail || !settings.zendeskToken) {
    throw new Error('Zendesk is not configured.');
  }

  const credentials = btoa(`${settings.zendeskEmail}/token:${settings.zendeskToken}`);
  const url = resolveZendeskUrl(settings, `/api/v2/uploads.json?filename=${encodeURIComponent(filename)}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Authorization: `Basic ${credentials}`,
      },
      body: blob,
    });
  } catch (e: unknown) {
    throw new Error(`Network error uploading attachment. (${e instanceof Error ? e.message : String(e)})`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Zendesk upload error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await res.json() as { upload: { token: string } };
  return data.upload.token;
}

export async function postZendeskComment(
  settings: AiSettings,
  ticketId: number | string,
  body: string,
  uploadToken?: string
): Promise<void> {
  if (!settings.zendeskSubdomain || !settings.zendeskEmail || !settings.zendeskToken) {
    throw new Error('Zendesk is not configured. Add your subdomain, email, and API token in AI Settings.');
  }

  const headers = zendeskHeaders(settings);
  const url = resolveZendeskUrl(settings, `/api/v2/tickets/${ticketId}.json`);

  const comment: Record<string, unknown> = { body, public: false };
  if (uploadToken) comment.uploads = [uploadToken];

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ticket: { comment } }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Zendesk authentication failed. Check your email and API token in settings.');
    if (res.status === 404) throw new Error(`Ticket #${ticketId} not found in Zendesk.`);
    throw new Error(`Zendesk error (${res.status}): ${detail || res.statusText}`);
  }
}

export function formatTicketForAi(ticket: ZendeskTicket): string {
  const tz = ticket.requesterTimezone ?? ticket.orgTimezone ?? 'unknown timezone';
  const lines: string[] = [
    `Ticket #${ticket.id}: ${ticket.subject}`,
    `Status: ${ticket.status}${ticket.priority ? ` | Priority: ${ticket.priority}` : ''}`,
    `Submitted by: ${ticket.requesterName}${ticket.requesterEmail ? ` <${ticket.requesterEmail}>` : ''}`,
    `Customer timezone: ${tz}`,
    ...(ticket.orgName ? [`Organization: ${ticket.orgName}`] : []),
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
