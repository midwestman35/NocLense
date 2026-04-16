import type { AiSettings } from '../store/aiSettings';
import type { ZendeskAttachment, ZendeskTicket, ZendeskTicketDraft } from '../types/services';
import {
  resolveApiUrl,
  basicAuthHeaderEmailToken,
  jsonHeaders,
  extractErrorDetail,
  validateSettingsFields,
  parseJson,
} from './apiUtils';

// Re-export types for backward compatibility
export type { ZendeskAttachment, ZendeskTicket, ZendeskTicketDraft };

function resolveZendeskUrl(settings: AiSettings, path: string): string {
  return resolveApiUrl(`/zendesk-proxy${path}`, `https://${settings.zendeskSubdomain}.zendesk.com${path}`);
}

function zendeskHeaders(settings: AiSettings): HeadersInit {
  return jsonHeaders(basicAuthHeaderEmailToken(settings.zendeskEmail, settings.zendeskToken));
}

export interface ZendeskFetchProgress {
  step: number;
  total: number;
  label: string;
}

export async function fetchZendeskTicket(
  settings: AiSettings,
  ticketId: string,
  onProgress?: (p: ZendeskFetchProgress) => void,
): Promise<ZendeskTicket> {
  validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'], 'Zendesk');

  const id = ticketId.trim().replace(/\D/g, '');
  if (!id) throw new Error('Enter a valid ticket number.');

  const headers = zendeskHeaders(settings);

  // Step 1: Fetch ticket
  onProgress?.({ step: 1, total: 4, label: 'Fetching ticket…' });
  const ticketRes = await fetch(resolveZendeskUrl(settings, `/api/v2/tickets/${id}.json`), { headers });

  if (!ticketRes.ok) {
    const detail = await extractErrorDetail(ticketRes);
    if (ticketRes.status === 401) throw new Error('Zendesk authentication failed. Check your email and API token in settings.');
    if (ticketRes.status === 404) throw new Error(`Ticket #${id} not found. Confirm it exists and your account has access.`);
    throw new Error(`Zendesk error (${ticketRes.status}): ${detail || ticketRes.statusText}`);
  }

  const ticketData = await parseJson<any>(ticketRes);
  const ticket = ticketData.ticket;

  let requesterName = 'Unknown';
  let requesterEmail = '';
  let requesterTimezone: string | null = null;
  let orgName: string | null = null;
  let orgTimezone: string | null = null;

  // Step 2: User + org in parallel (org uses ticket.organization_id; fallback handled below)
  onProgress?.({ step: 2, total: 4, label: 'Fetching user & org…' });
  await Promise.all([
    fetch(resolveZendeskUrl(settings, `/api/v2/users/${ticket.requester_id}.json`), { headers })
      .then(async (r) => {
        if (r.ok) {
          const d = await parseJson<any>(r);
          requesterName = d.user?.name ?? 'Unknown';
          requesterEmail = d.user?.email ?? '';
          requesterTimezone = d.user?.time_zone ?? null;
          if (!orgId) orgId = d.user?.organization_id ?? null;
        }
      })
      .catch(() => {}),
    orgId
      ? fetch(resolveZendeskUrl(settings, `/api/v2/organizations/${orgId}.json`), { headers })
          .then(async (r) => {
            if (r.ok) {
              const d = await parseJson<any>(r);
              orgName = d.organization?.name ?? null;
              orgTimezone = d.organization?.time_zone ?? null;
            }
          })
          .catch(() => {})
      : Promise.resolve(),
  ]);

  // Fallback: user resolved a new orgId that ticket didn't have — fetch org now
  if (orgId && !orgName) {
    try {
      const orgRes = await fetch(resolveZendeskUrl(settings, `/api/v2/organizations/${orgId}.json`), { headers });
      if (orgRes.ok) {
        const orgData = await parseJson<any>(orgRes);
        orgName = orgData.organization?.name ?? null;
        orgTimezone = orgData.organization?.time_zone ?? null;
      }
    } catch { /* non-fatal */ }
  }

  // Step 3: Fetch comments
  onProgress?.({ step: 3, total: 4, label: 'Fetching comments…' });
  const commentsRes = await fetch(resolveZendeskUrl(settings, `/api/v2/tickets/${id}/comments.json`), { headers });

  // Step 4: Process attachments from comment payloads
  onProgress?.({ step: 4, total: 4, label: 'Processing attachments…' });
  const comments: string[] = [];
  const attachments: ZendeskAttachment[] = [];
  if (commentsRes.ok) {
    const commentsData = await parseJson<any>(commentsRes);
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
  validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'], 'Zendesk');

  const cleaned = keywords
    .map(k => k.trim().replace(/['"]/g, ''))
    .filter(k => k.length > 2);
  if (cleaned.length === 0) return [];

  // Fire parallel searches per keyword phrase for better recall (OR semantics)
  // Then deduplicate by ticket ID and cap at limit
  const searches = cleaned.slice(0, 5).map(async (keyword) => {
    const query = `type:ticket status:closed "${keyword}"`;
    const url = resolveZendeskUrl(
      settings,
      `/api/v2/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc&per_page=${Math.min(limit, 5)}`
    );

    const res = await fetch(url, { headers: zendeskHeaders(settings) });
    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`[Zendesk Search] Rate limited for keyword: "${keyword}"`);
      }
      return [];
    }
    const data = await parseJson<any>(res);
    return (data.results ?? []) as Array<Record<string, unknown>>;
  });

  const allResults = (await Promise.all(searches)).flat();

  // Deduplicate by ticket ID, preserve order (first occurrence wins)
  const seen = new Set<number>();
  const unique: Array<Record<string, unknown>> = [];
  for (const t of allResults) {
    const id = t.id as number;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(t);
    }
  }

  return unique.slice(0, limit).map((t) => ({
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
  validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'], 'Zendesk');

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
    const detail = await extractErrorDetail(res);
    if (res.status === 401) throw new Error('Zendesk authentication failed. Check your credentials in settings.');
    throw new Error(`Zendesk error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await parseJson<any>(res);
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
  validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'], 'Zendesk');

  // In DEV: rewrite the CDN/subdomain URL through the local proxy
  let url: string;
  if (import.meta.env.DEV) {
    url = attachment.contentUrl.replace(
      new RegExp(`https://${settings.zendeskSubdomain}\\.zendesk\\.com`, 'i'),
      '/zendesk-proxy'
    );
    if (url === attachment.contentUrl) {
      url = attachment.contentUrl;
    }
  } else if (!((window as any).electronAPI)) {
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
  validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'], 'Zendesk');

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
    const detail = await extractErrorDetail(res);
    throw new Error(`Zendesk upload error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await parseJson<{ upload: { token: string } }>(res);
  return data.upload.token;
}

export async function postZendeskComment(
  settings: AiSettings,
  ticketId: number | string,
  body: string,
  uploadToken?: string
): Promise<void> {
  validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'], 'Zendesk');

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
    const detail = await extractErrorDetail(res);
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
