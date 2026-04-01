# Unleash Agent Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Noc toolAgent" Unleash agent independently useful for ticket triage and KB lookup by adding domain-specific instructions, workflow templates, and autonomous data-fetching Custom Tool endpoints.

**Architecture:** Two-phase approach. Phase 1 (Approach A) is pure Unleash admin config — paste system instructions, add prompt templates, toggle display prefs. Phase 2 (Approach B) adds four read-only Vercel serverless endpoints under `api/tools/` that authenticate server-side and return structured JSON summaries. Each endpoint is registered as a Custom Tool in the Unleash agent so it can autonomously fetch Zendesk tickets, search tickets, query Datadog errors, and search Confluence.

**Tech Stack:** TypeScript, Vercel Serverless Functions (`@vercel/node`), Zendesk REST API v2, Datadog Logs API v2, Confluence REST API v1, Unleash Admin Panel.

---

## File Structure

New files (all in `NocLense/api/tools/`):

| File | Responsibility |
|------|---------------|
| `api/tools/_auth.ts` | Shared secret validation + rate limiting helper |
| `api/tools/zendesk-ticket.ts` | GET — fetch single ticket by ID with structured summary |
| `api/tools/zendesk-search.ts` | GET — search tickets by keyword |
| `api/tools/datadog-errors.ts` | POST — query Datadog errors for a time window |
| `api/tools/confluence-search.ts` | GET — search Confluence KB by keyword |

No existing files are modified.

---

## Task 1: Approach A — Unleash Admin Configuration

**Files:** None (admin panel only)

> **ACTION REQUIRED BY USER:** This task is entirely manual configuration in the Unleash admin panel.

- [ ] **Step 1: Open Unleash admin panel**

Navigate to Unleash Admin Center > Assistants > "Noc toolAgent".

- [ ] **Step 2: Paste system instructions**

Copy the full instruction block from the spec document `docs/superpowers/specs/2026-04-01-unleash-agent-optimization-design.md`, section A1 (everything between the triple-backtick fences). Paste it into the agent's "Instructions" field.

- [ ] **Step 3: Replace prompt templates**

Delete the existing generic template (`Ask about [topic] or [project name]`).

Add these four templates (click "+ Add" for each):

```
Triage Zendesk ticket #[ticket number]: assess severity, root cause category, attribution (Carbyne vs customer vs infra), and recommended next steps
```

```
Interpret these log entries and identify the error pattern, affected components, and what to cross-reference: [paste logs]
```

```
Generate a closure note for ticket #[ticket number] with issue summary, troubleshooting steps taken, and root cause determination
```

```
Search for known issues or past investigations related to: [symptom or error message]
```

- [ ] **Step 4: Toggle display preferences**

Set "Pin to Chat Sidebar" to ON.
Set "Display on Quick Search" to ON.

- [ ] **Step 5: Smoke test**

Open the agent chat (direct, not through NocLense). Select the "Triage Ticket" template, enter a real ticket number, and verify:
- Response includes Severity, Root cause hypothesis, Attribution, Next steps, and Escalate recommendation
- Response references Carbyne-specific terminology (CCS-SDK, APEX, PBX, etc.)

---

## Task 2: Shared Auth + Rate Limit Helper

**Files:**
- Create: `api/tools/_auth.ts`

- [ ] **Step 1: Create the shared helper**

```typescript
// api/tools/_auth.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Validate X-Tool-Secret header against TOOL_SECRET env var.
 * Returns true if authorized, false if rejected (and sends 401).
 */
export function validateSecret(req: VercelRequest, res: VercelResponse): boolean {
  const secret = process.env.TOOL_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'TOOL_SECRET not configured on server' });
    return false;
  }
  const provided = req.headers['x-tool-secret'];
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * Build Zendesk Basic auth header from env vars.
 * Returns null if not configured (and sends 500).
 */
export function zendeskAuth(res: VercelResponse): { subdomain: string; headers: Record<string, string> } | null {
  const subdomain = process.env.VITE_ZENDESK_SUBDOMAIN;
  const email = process.env.VITE_ZENDESK_EMAIL;
  const token = process.env.VITE_ZENDESK_TOKEN;
  if (!subdomain || !email || !token) {
    res.status(500).json({ error: 'Zendesk credentials not configured' });
    return null;
  }
  const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
  return {
    subdomain,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
  };
}

/**
 * Build Datadog auth headers from env vars.
 * Returns null if not configured (and sends 500).
 */
export function datadogAuth(res: VercelResponse): { site: string; headers: Record<string, string> } | null {
  const apiKey = process.env.VITE_DATADOG_API_KEY;
  const appKey = process.env.VITE_DATADOG_APP_KEY;
  const site = process.env.VITE_DATADOG_SITE || 'datadoghq.com';
  if (!apiKey || !appKey) {
    res.status(500).json({ error: 'Datadog credentials not configured' });
    return null;
  }
  return {
    site,
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey,
    },
  };
}

/**
 * Build Confluence/Jira Basic auth headers from env vars.
 * Returns null if not configured (and sends 500).
 */
export function confluenceAuth(res: VercelResponse): { subdomain: string; headers: Record<string, string> } | null {
  const subdomain = process.env.VITE_JIRA_SUBDOMAIN;
  const email = process.env.VITE_JIRA_EMAIL;
  const token = process.env.VITE_JIRA_TOKEN;
  if (!subdomain || !email || !token) {
    res.status(500).json({ error: 'Confluence/Jira credentials not configured' });
    return null;
  }
  const credentials = Buffer.from(`${email}/token:${token}`).toString('base64');
  return {
    subdomain,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add api/tools/_auth.ts
git commit -m "feat(tools): add shared auth + credential helpers for Unleash custom tool endpoints"
```

---

## Task 3: Zendesk Ticket Fetch Endpoint

**Files:**
- Create: `api/tools/zendesk-ticket.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// api/tools/zendesk-ticket.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSecret, zendeskAuth } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!validateSecret(req, res)) return;

  const auth = zendeskAuth(res);
  if (!auth) return;

  const id = String(req.query.id ?? '').replace(/\D/g, '');
  if (!id) { res.status(400).json({ error: 'Missing required parameter: id' }); return; }

  try {
    const base = `https://${auth.subdomain}.zendesk.com`;

    const [ticketRes, commentsRes] = await Promise.all([
      fetch(`${base}/api/v2/tickets/${id}.json`, { headers: auth.headers }),
      fetch(`${base}/api/v2/tickets/${id}/comments.json`, { headers: auth.headers }),
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
      const userRes = await fetch(`${base}/api/v2/users/${ticket.requester_id}.json`, { headers: auth.headers });
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
        const orgRes = await fetch(`${base}/api/v2/organizations/${ticket.organization_id}.json`, { headers: auth.headers });
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
```

- [ ] **Step 2: Commit**

```bash
git add api/tools/zendesk-ticket.ts
git commit -m "feat(tools): add zendesk-ticket endpoint for Unleash agent tool"
```

---

## Task 4: Zendesk Search Endpoint

**Files:**
- Create: `api/tools/zendesk-search.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// api/tools/zendesk-search.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add api/tools/zendesk-search.ts
git commit -m "feat(tools): add zendesk-search endpoint for Unleash agent tool"
```

---

## Task 5: Datadog Errors Endpoint

**Files:**
- Create: `api/tools/datadog-errors.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// api/tools/datadog-errors.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add api/tools/datadog-errors.ts
git commit -m "feat(tools): add datadog-errors endpoint for Unleash agent tool"
```

---

## Task 6: Confluence Search Endpoint

**Files:**
- Create: `api/tools/confluence-search.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// api/tools/confluence-search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSecret, confluenceAuth } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!validateSecret(req, res)) return;

  const auth = confluenceAuth(res);
  if (!auth) return;

  const q = String(req.query.q ?? '').trim();
  if (!q) { res.status(400).json({ error: 'Missing required parameter: q' }); return; }

  try {
    // Build CQL — search all pages for the query text
    const parentPageId = process.env.VITE_CONFLUENCE_PARENT_PAGE_ID;
    const spaceId = process.env.VITE_CONFLUENCE_SPACE_ID;

    // Build query terms — wrap each word in quotes for phrase matching
    const terms = q.split(/\s+/).filter(t => t.length > 2).map(t => `"${t}"`).join(' OR ');
    let cql = `type = page AND (text ~ ${terms})`;
    if (parentPageId) cql = `ancestor = ${parentPageId} AND ${cql}`;
    else if (spaceId) cql = `space.id = ${spaceId} AND ${cql}`;
    cql += ' ORDER BY lastmodified DESC';

    const url = `https://${auth.subdomain}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=10`;

    const confRes = await fetch(url, { headers: auth.headers });

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
```

- [ ] **Step 2: Commit**

```bash
git add api/tools/confluence-search.ts
git commit -m "feat(tools): add confluence-search endpoint for Unleash agent tool"
```

---

## Task 7: Add TOOL_SECRET Environment Variable

> **ACTION REQUIRED BY USER:** This step requires Vercel dashboard access.

- [ ] **Step 1: Generate a secret**

Run locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (a 64-char hex string).

- [ ] **Step 2: Add to Vercel**

Go to Vercel Dashboard > noc-lense-clone > Settings > Environment Variables.

Add:
- **Name:** `TOOL_SECRET`
- **Value:** (the hex string from step 1)
- **Environments:** Production, Preview

- [ ] **Step 3: Verify existing env vars**

Confirm these are already set (they should be from prior deployment):
- `VITE_ZENDESK_SUBDOMAIN`
- `VITE_ZENDESK_EMAIL`
- `VITE_ZENDESK_TOKEN`
- `VITE_DATADOG_API_KEY`
- `VITE_DATADOG_APP_KEY`
- `VITE_DATADOG_SITE`
- `VITE_JIRA_SUBDOMAIN`
- `VITE_JIRA_EMAIL`
- `VITE_JIRA_TOKEN`
- `VITE_CONFLUENCE_SPACE_ID`
- `VITE_CONFLUENCE_PARENT_PAGE_ID`

---

## Task 8: Deploy and Test Endpoints

- [ ] **Step 1: Push to trigger deployment**

```bash
git push origin main
```

Wait for the Vercel deployment to complete (check Vercel dashboard — should auto-deploy).

- [ ] **Step 2: Test zendesk-ticket endpoint**

```bash
curl -s -H "X-Tool-Secret: YOUR_SECRET_HERE" \
  "https://noc-lense-clone.vercel.app/api/tools/zendesk-ticket?id=39325" | jq .
```

Expected: JSON with `ticketId`, `subject`, `status`, `requester`, `latestComments`.

- [ ] **Step 3: Test zendesk-search endpoint**

```bash
curl -s -H "X-Tool-Secret: YOUR_SECRET_HERE" \
  "https://noc-lense-clone.vercel.app/api/tools/zendesk-search?q=audio%20POS" | jq .
```

Expected: JSON with `count` and `tickets` array.

- [ ] **Step 4: Test datadog-errors endpoint**

```bash
curl -s -X POST -H "X-Tool-Secret: YOUR_SECRET_HERE" \
  -H "Content-Type: application/json" \
  -d '{"from":"2026-03-31T00:00:00Z","to":"2026-04-01T00:00:00Z","query":"service:apex-ng status:error","limit":5}' \
  "https://noc-lense-clone.vercel.app/api/tools/datadog-errors" | jq .
```

Expected: JSON with `logs` array and `summary` object.

- [ ] **Step 5: Test confluence-search endpoint**

```bash
curl -s -H "X-Tool-Secret: YOUR_SECRET_HERE" \
  "https://noc-lense-clone.vercel.app/api/tools/confluence-search?q=DTMF%20Language%20Line" | jq .
```

Expected: JSON with `results` array.

- [ ] **Step 6: Test auth rejection**

```bash
curl -s -H "X-Tool-Secret: wrong-secret" \
  "https://noc-lense-clone.vercel.app/api/tools/zendesk-ticket?id=39325"
```

Expected: `{"error":"Unauthorized"}` with status 401.

---

## Task 9: Register Custom Tools in Unleash

> **ACTION REQUIRED BY USER:** This task is entirely manual configuration in the Unleash admin panel.

- [ ] **Step 1: Open Custom Tool config**

In the Noc toolAgent settings, click "+ Add" in the Tools section, then select "Custom Tool".

- [ ] **Step 2: Register fetch_zendesk_ticket**

- **Name:** `fetch_zendesk_ticket`
- **Description:** `Fetch a Zendesk support ticket by its number, including subject, status, priority, requester, description, and recent comments. Use when an agent mentions a ticket number.`
- **URL:** `https://noc-lense-clone.vercel.app/api/tools/zendesk-ticket`
- **Method:** GET
- **Headers:** `X-Tool-Secret: YOUR_SECRET_HERE`
- **Parameters:**
  - `id` (string, required) — "The Zendesk ticket number, e.g. 39325"

- [ ] **Step 3: Register search_zendesk_tickets**

- **Name:** `search_zendesk_tickets`
- **Description:** `Search Zendesk tickets by keyword to find related or similar past issues. Use when an agent describes symptoms and you want to find matching tickets.`
- **URL:** `https://noc-lense-clone.vercel.app/api/tools/zendesk-search`
- **Method:** GET
- **Headers:** `X-Tool-Secret: YOUR_SECRET_HERE`
- **Parameters:**
  - `q` (string, required) — "Search query, e.g. 'audio POS 4' or 'DTMF Language Line'"

- [ ] **Step 4: Register fetch_datadog_errors**

- **Name:** `fetch_datadog_errors`
- **Description:** `Fetch recent error logs from Datadog for a time window and optional station filter. Returns log entries and a summary breakdown by service, level, and host. Use when investigating an incident that needs production log evidence.`
- **URL:** `https://noc-lense-clone.vercel.app/api/tools/datadog-errors`
- **Method:** POST
- **Headers:** `X-Tool-Secret: YOUR_SECRET_HERE`
- **Parameters:**
  - `from` (string, required) — "ISO-8601 start time, e.g. 2026-03-21T21:00:00Z"
  - `to` (string, required) — "ISO-8601 end time, e.g. 2026-03-22T04:00:00Z"
  - `query` (string, optional, default: "service:apex-ng status:error") — "Datadog query filter"
  - `hosts` (array of strings, optional) — "Station/host names to filter, e.g. ['station1', 'pos-O1']"
  - `indexes` (array of strings, optional, default: ["main", "ops"]) — "Datadog indexes to search"
  - `limit` (number, optional, default: 50) — "Max log entries to return (max 200)"

- [ ] **Step 5: Register search_confluence_kb**

- **Name:** `search_confluence_kb`
- **Description:** `Search the Carbyne Confluence knowledge base for known issues, past investigations, runbooks, and standard procedures. Use when an agent asks about known issues or needs procedural guidance.`
- **URL:** `https://noc-lense-clone.vercel.app/api/tools/confluence-search`
- **Method:** GET
- **Headers:** `X-Tool-Secret: YOUR_SECRET_HERE`
- **Parameters:**
  - `q` (string, required) — "Search query, e.g. 'stuck call abandoned queue' or 'Datadog agent reset'"

- [ ] **Step 6: End-to-end test**

In the Unleash agent chat, type: "Look up Zendesk ticket 39325 and tell me what the issue was."

Verify:
- Agent calls the `fetch_zendesk_ticket` tool automatically
- Response includes structured ticket data
- Agent applies the attribution framework from the system instructions to assess the ticket
