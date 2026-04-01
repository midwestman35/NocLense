/**
 * Shared auth + credential helpers for Unleash custom tool endpoints.
 * All tool endpoints validate X-Tool-Secret and use server-side credentials.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Validate X-Tool-Secret header against TOOL_SECRET env var.
 * Returns true if authorized, false if rejected (sends 401).
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
 * Returns null if not configured (sends 500).
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
 * Returns null if not configured (sends 500).
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
 * Returns null if not configured (sends 500).
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
