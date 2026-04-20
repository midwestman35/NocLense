/**
 * apiUtils.ts
 *
 * Shared utilities for HTTP API calls across all services (Zendesk, Jira, Confluence, Datadog).
 * Consolidates duplicated patterns for:
 * - Environment-aware URL resolution (dev proxy vs Electron vs production)
 * - HTTP headers generation (Basic auth, Bearer tokens, custom headers)
 * - Error handling and response extraction
 * - Configuration validation
 *
 * @module services/apiUtils
 */


/**
 * Determines if code is running in an Electron context.
 * Used to skip proxy routing and make direct API calls.
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

/**
 * Is development mode (Vite dev server).
 */
export function isDev(): boolean {
  return import.meta.env.DEV;
}

/**
 * Resolve API URL with environment-aware routing:
 * - DEV: route through Vite proxy (e.g., /zendesk-proxy)
 * - ELECTRON: direct URL (no CORS in desktop app)
 * - PRODUCTION: route through serverless proxy (e.g., /api/zendesk-proxy)
 *
 * @param devProxyPath - Path relative to dev proxy root (e.g., "/tickets")
 * @param apiPath - Full API path for Electron/production (e.g., `https://subdomain.zendesk.com/api/v2/tickets`)
 * @returns Resolved URL for current environment
 * @example
 * const url = resolveApiUrl('/tickets', `https://subdomain.zendesk.com/api/v2/tickets`);
 * // DEV: '/zendesk-proxy/tickets'
 * // ELECTRON: 'https://subdomain.zendesk.com/api/v2/tickets'
 * // PROD: '/api/zendesk-proxy/tickets'
 */
export function resolveApiUrl(devProxyPath: string, apiPath: string): string {
  if (isDev()) {
    return devProxyPath;
  }
  if (isElectron()) {
    return apiPath;
  }
  return `/api${devProxyPath}`;
}

/**
 * Generate Basic Auth header for Atlassian products (Jira, Confluence).
 * Uses email/token format.
 *
 * @param email - User email
 * @param token - API token
 * @returns Authorization header value
 */
export function basicAuthHeader(email: string, token: string): string {
  const credentials = btoa(`${email}:${token}`);
  return `Basic ${credentials}`;
}

/**
 * Generate Basic Auth header for email/token format (Zendesk uses email/token:token).
 *
 * @param email - User email
 * @param token - API token
 * @returns Authorization header value (Basic {base64})
 */
export function basicAuthHeaderEmailToken(email: string, token: string): string {
  const credentials = btoa(`${email}/token:${token}`);
  return `Basic ${credentials}`;
}

/**
 * Generate Bearer token header.
 *
 * @param token - Bearer token
 * @returns Authorization header value
 */
export function bearerAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Standard JSON request headers with optional authorization.
 */
export function jsonHeaders(authHeader?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return headers;
}

/**
 * Extract error detail from HTTP response.
 * Safely reads response body and returns up to maxChars.
 *
 * @param res - Fetch Response
 * @param maxChars - Max characters to return (default 300)
 * @returns Promise resolving to error text or empty string
 */
export async function extractErrorDetail(res: Response, maxChars = 300): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, maxChars);
  } catch {
    return '';
  }
}

/**
 * Check HTTP status code and throw user-facing error.
 * Handles common auth/permission errors with specific messages.
 *
 * @param res - Fetch Response
 * @param defaultMessage - Default error message if status doesn't match known patterns
 * @param options - Custom status-code → message mapping
 * @throws Error with user-facing message
 * @example
 * checkHttpStatus(res, `API error (${res.status})`, {
 *   401: 'Authentication failed. Check your API key.',
 *   404: 'Resource not found.',
 * });
 */
export async function checkHttpStatus(
  res: Response,
  defaultMessage: string,
  options?: Record<number, string>
): Promise<void> {
  if (res.ok) return;

  // Check custom mappings first
  if (options && options[res.status]) {
    throw new Error(options[res.status]);
  }

  // Common patterns
  if (res.status === 401) {
    throw new Error('Authentication failed. Check your API credentials.');
  }
  if (res.status === 403) {
    throw new Error('Permission denied. Check your account permissions.');
  }
  if (res.status === 404) {
    throw new Error('Resource not found.');
  }

  const detail = await extractErrorDetail(res);
  throw new Error(detail ? `${defaultMessage}: ${detail}` : defaultMessage);
}

/**
 * Make an authenticated fetch request with error handling.
 *
 * @param url - Target URL
 * @param options - Fetch options (headers, body, etc.)
 * @returns Promise resolving to Response (caller must check res.ok)
 * @throws Error on network failure
 */
export async function fetchApi(
  url: string,
  options: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error: ${msg}`);
  }
}

/**
 * Validate that required settings fields are present.
 * Throws error with field name if missing.
 *
 * @param settings - Settings object
 * @param fields - Field names to check (e.g., 'zendeskSubdomain', 'zendeskEmail')
 * @param errorContext - Context for error message (e.g., 'Zendesk')
 * @throws Error if any field is missing
 * @example
 * validateSettingsFields(settings, ['zendeskSubdomain', 'zendeskEmail'], 'Zendesk');
 */
export function validateSettingsFields(
  settings: any,
  fields: string[],
  errorContext: string
): void {
  const missing = fields.filter((field) => !settings[field]);
  if (missing.length > 0) {
    throw new Error(`${errorContext} is not configured. Add ${missing.join(', ')} in AI Settings.`);
  }
}

/**
 * Parse JSON response safely.
 *
 * @param res - Fetch Response
 * @returns Promise resolving to parsed JSON
 * @throws Error if response body is not valid JSON
 */
export async function parseJson<T = unknown>(res: Response): Promise<T> {
  try {
    return await res.json();
  } catch (e: unknown) {
    throw new Error(`Failed to parse API response: ${e instanceof Error ? e.message : String(e)}`);
  }
}
