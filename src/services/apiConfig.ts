const HTTPS_PROTOCOL_RE = /^https?:\/\//i;

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeHost(value: string): string {
  return stripTrailingSlashes(value.trim().replace(HTTPS_PROTOCOL_RE, ''));
}

export const UNLEASH_DEFAULT_BASE = 'https://e-api.unleash.so';

export function getUnleashBase(endpoint: string = UNLEASH_DEFAULT_BASE): string {
  const trimmed = endpoint.trim();
  return stripTrailingSlashes(trimmed || UNLEASH_DEFAULT_BASE);
}

export function getUnleashChatsUrl(endpoint?: string): string {
  return `${getUnleashBase(endpoint)}/chats`;
}

export function getZendeskSiteBase(subdomain: string): string {
  const host = normalizeHost(subdomain);
  const zendeskHost = host.endsWith('.zendesk.com') ? host : `${host}.zendesk.com`;
  return `https://${zendeskHost}`;
}

export function getZendeskApiBase(subdomain: string): string {
  return `${getZendeskSiteBase(subdomain)}/api/v2`;
}

export function getDatadogBase(site: string = 'datadoghq.com'): string {
  const host = normalizeHost(site || 'datadoghq.com');
  const apiHost = host.startsWith('api.') ? host : `api.${host}`;
  return `https://${apiHost}`;
}

export function getAtlassianBase(host: string): string {
  return `https://${normalizeHost(host)}`;
}

export function getJiraApiBase(host: string): string {
  return `${getAtlassianBase(host)}/rest/api/3`;
}

export function getConfluenceApiBase(host: string): string {
  return `${getAtlassianBase(host)}/wiki/api/v2`;
}

export function getConfluenceRestContentBase(host: string): string {
  return `${getAtlassianBase(host)}/wiki/rest/api/content`;
}
