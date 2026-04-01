/**
 * datadogService.ts
 *
 * Datadog Logs API v2 integration.
 * Fetches logs matching an incident time window + filter to enrich AI diagnosis.
 *
 * Auth: DD-API-KEY + DD-APPLICATION-KEY headers.
 * Dev proxy: /datadog-proxy → https://{site}
 * Prod: direct to https://{site}/api/v2/logs/events/search
 */
import type { AiSettings } from '../store/aiSettings';

export interface DatadogEnrichmentOptions {
  enabled: boolean;
  fromMs: number;        // epoch milliseconds — start of window
  toMs: number;          // epoch milliseconds — end of window
  filter: string;        // Datadog query string, e.g. 'service:apex-ng'
  hosts: string[];       // multiple stations/hosts, empty = no host filter
  indexes: string[];     // empty = ['*'] (search all)
}

export interface DatadogLogEntry {
  id: string;
  timestamp: string;    // ISO-8601
  message: string;
  service?: string;
  host?: string;
  level?: string;       // mapped from status
  attributes: Record<string, unknown>;
}

function datadogBase(settings: AiSettings): string {
  if (import.meta.env.DEV) return '/datadog-proxy';
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const site = settings.datadogSite || 'datadoghq.com';
    const apiHost = site.startsWith('api.') ? site : `api.${site}`;
    return `https://${apiHost}`;
  }
  return '/api/datadog-proxy';
}

function datadogHeaders(settings: AiSettings): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'DD-API-KEY': settings.datadogApiKey,
    'DD-APPLICATION-KEY': settings.datadogAppKey,
  };
}

/**
 * Validate Datadog credentials by:
 *  1. Checking the API key via /api/v1/validate
 *  2. Testing Logs read access via a minimal /api/v2/logs/events/search call
 *
 * This catches both invalid keys AND missing scopes (e.g. logs_read_data).
 */
export async function validateDatadogCredentials(
  settings: AiSettings
): Promise<{ valid: boolean; message: string }> {
  if (!settings.datadogApiKey) return { valid: false, message: 'API Key is empty.' };
  if (!settings.datadogAppKey) return { valid: false, message: 'Application Key is empty.' };

  const base = datadogBase(settings);
  const headers = datadogHeaders(settings);

  try {
    // Step 1: Validate API key exists
    const valRes = await fetch(`${base}/api/v1/validate`, { method: 'GET', headers });
    if (!valRes.ok) {
      if (valRes.status === 401) {
        return { valid: false, message: 'API Key rejected. Copy the full key from Datadog → Organization Settings → API Keys.' };
      }
      return { valid: false, message: `API Key check failed (${valRes.status}).` };
    }

    // Step 2: Test actual Logs API access (catches missing scopes on the App Key)
    const now = new Date().toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const logsRes = await fetch(`${base}/api/v2/logs/events/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { query: '*', from: fiveMinAgo, to: now, indexes: ['main'] },
        page: { limit: 1 },
      }),
    });

    if (logsRes.ok) {
      return { valid: true, message: `Connected to Datadog (${settings.datadogSite}) — Logs API OK.` };
    }

    if (logsRes.status === 403) {
      return {
        valid: false,
        message: 'API Key OK, but Application Key lacks "logs_read_data" scope. Edit the key in Datadog → Organization Settings → Application Keys → Scopes.',
      };
    }
    if (logsRes.status === 401) {
      return {
        valid: false,
        message: 'API Key OK, but Application Key rejected. Verify it in Datadog → Organization Settings → Application Keys (copy the Key, not the ID).',
      };
    }

    const text = await logsRes.text().catch(() => '');
    return { valid: false, message: `API Key OK but Logs API returned ${logsRes.status}: ${text.slice(0, 150)}` };
  } catch (e: unknown) {
    return { valid: false, message: `Connection failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Search Datadog logs for a given time window + filter.
 * Returns up to `limit` entries (default 500).
 * Handles pagination automatically up to 3 pages.
 *
 * @throws Error with user-facing message on API failure
 */
export async function searchDatadogLogs(
  settings: AiSettings,
  opts: DatadogEnrichmentOptions,
  limit = 500
): Promise<DatadogLogEntry[]> {
  if (!settings.datadogApiKey || !settings.datadogAppKey) {
    throw new Error('Datadog API key and App key are required. Configure them in Settings (⚙).');
  }

  const base = datadogBase(settings);
  const url = `${base}/api/v2/logs/events/search`;

  // Build query — combine filter + hosts
  let query = opts.filter.trim();
  if (opts.hosts.length > 0) {
    const hostClause = opts.hosts.map(h => `host:${h.trim()}`).join(' OR ');
    query = query ? `(${query}) AND (${hostClause})` : hostClause;
  }

  const indexes = opts.indexes.length > 0 ? opts.indexes : ['*'];

  const body = {
    filter: {
      query,
      from: new Date(opts.fromMs).toISOString(),
      to: new Date(opts.toMs).toISOString(),
      indexes,
    },
    sort: 'timestamp',
    page: { limit: Math.min(limit, 1000) },
  };

  const results: DatadogLogEntry[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (pages < 3) {
    const pageBody = cursor ? { ...body, page: { ...body.page, cursor } } : body;

    const response = await fetch(url, {
      method: 'POST',
      headers: datadogHeaders(settings),
      body: JSON.stringify(pageBody),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      if (response.status === 401) {
        throw new Error(
          `Datadog 401 Unauthorized. Check that you're using an API Key + Application Key (not Application ID) from Organization Settings.`
        );
      }
      if (response.status === 403) throw new Error('Datadog 403 Forbidden — API key valid but lacks Logs permissions. Check key scopes.');
      if (response.status === 429) throw new Error('Datadog: Rate limited — try again in a few seconds.');
      throw new Error(`Datadog API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as {
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
      meta?: { page?: { after?: string } };
    };

    for (const item of data.data ?? []) {
      const a = item.attributes;
      results.push({
        id: item.id,
        timestamp: a.timestamp,
        message: a.message ?? String(a.attributes?.message ?? ''),
        service: a.service,
        host: a.host,
        level: a.status?.toUpperCase(),
        attributes: a.attributes ?? {},
      });
    }

    cursor = data.meta?.page?.after;
    pages++;
    if (!cursor || results.length >= limit) break;
  }

  return results.slice(0, limit);
}

/**
 * Format Datadog log entries as a compact text block for AI context.
 * Up to 200 entries are included; the rest are summarized.
 */
/** Result from station discovery */
export interface DatadogStation {
  /** The @log.machineData.name value (e.g. "us-il-glenview-south-apex-02") */
  name: string;
  /** Number of log entries from this station in the time window */
  count: number;
}

/**
 * Discover all station/operator names for a given CNC using Datadog Logs Aggregate API.
 * Groups logs by @log.machineData.name within a time window.
 *
 * @param cncName  Call center name (e.g. "us-ga-cobb-apex")
 * @param indexes  Datadog indexes to search (default: ["main"])
 * @param windowMs How far back to look in milliseconds (default: 2 hours)
 * @returns Array of discovered stations sorted by log count (descending)
 */
/** Session-level cache for station discovery (15-min TTL). */
const stationCache = new Map<string, { stations: DatadogStation[]; expiry: number }>();
const STATION_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/** Fetch with retry + exponential backoff for 429 rate limits. */
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }
    lastResponse = response;
    // Log rate limit headers
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    console.warn(`[DD] Rate limited (429). Remaining: ${remaining}, Reset: ${reset}s. Retry ${attempt + 1}/${maxRetries}…`);
    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
  }
  return lastResponse!;
}

export async function discoverStationsForCnc(
  settings: AiSettings,
  cncName: string,
  indexes: string[] = ['main'],
  windowMs = 24 * 60 * 60 * 1000,
): Promise<DatadogStation[]> {
  if (!settings.datadogApiKey || !settings.datadogAppKey) {
    throw new Error('Datadog credentials required.');
  }

  // Check session cache first
  const cacheKey = `${cncName}::${indexes.join(',')}`;
  const cached = stationCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    console.log(`[DD Station Discovery] Cache hit for "${cncName}" (${cached.stations.length} stations)`);
    return cached.stations;
  }

  const base = datadogBase(settings);
  const url = `${base}/api/v2/logs/analytics/aggregate`;
  const now = Date.now();
  const from = new Date(now - windowMs).toISOString();
  const to = new Date(now).toISOString();

  // Try multiple query strategies — the field path or index might differ
  const queries = [
    `@log.machineData.callCenterName:*${cncName}* service:prod`,
    `@log.machineData.callCenterName:*${cncName}*`,
    `*${cncName}*`,
  ];

  // Also try with all indexes if 'main' returns nothing
  const indexStrategies = [indexes, ['*']];

  for (const idxList of indexStrategies) {
    for (const query of queries) {
      const body = {
        filter: { query, from, to, indexes: idxList },
        group_by: [
          {
            facet: '@log.machineData.name',
            limit: 100,
            sort: { type: 'measure', aggregation: 'count', order: 'desc' },
          },
        ],
        compute: [{ type: 'total', aggregation: 'count' }],
      };

      console.log(`[DD Station Discovery] Trying: query="${query}" indexes=${JSON.stringify(idxList)}`);

      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: datadogHeaders(settings),
        body: JSON.stringify(body),
      });

      // Log rate limit headers on every response for debugging
      const rlRemaining = response.headers.get('x-ratelimit-remaining');
      const rlLimit = response.headers.get('x-ratelimit-limit');
      const rlReset = response.headers.get('x-ratelimit-reset');
      if (rlRemaining != null) {
        console.log(`[DD Rate Limit] ${rlRemaining}/${rlLimit} remaining, resets in ${rlReset}s`);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `Datadog ${response.status} — your Application Key needs the "logs_read_data" scope.\n` +
            `Go to Datadog → Organization Settings → Application Keys → Scopes → enable "logs_read_data".`
          );
        }
        if (response.status === 400) {
          console.warn(`[DD Station Discovery] 400 for query="${query}", trying next strategy…`);
          continue;
        }
        if (response.status === 429) {
          throw new Error(
            `Datadog rate limit reached — try again in ${rlReset ?? '~30'} seconds.\n` +
            `Tip: Station results are cached for 15 min after a successful discovery.`
          );
        }
        throw new Error(`Datadog aggregate error ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      console.log('[DD Station Discovery] Response:', JSON.stringify(data, null, 2));

      const typed = data as {
        data?: {
          buckets?: Array<{
            by?: Record<string, string>;
            computes?: Record<string, unknown>;
          }>;
        };
      };

      const buckets = typed?.data?.buckets ?? [];
      const stations = buckets
        .map(b => {
          const name = b.by?.['@log.machineData.name'] ?? '';
          const computes = b.computes ?? {};
          const count = typeof computes['c0'] === 'number'
            ? computes['c0']
            : Number(Object.values(computes)[0] ?? 0);
          return { name, count };
        })
        .filter(s => s.name);

      if (stations.length > 0) {
        console.log(`[DD Station Discovery] Found ${stations.length} stations with query="${query}" indexes=${JSON.stringify(idxList)}`);
        // Cache the results
        stationCache.set(cacheKey, { stations, expiry: Date.now() + STATION_CACHE_TTL });
        return stations;
      }
      console.log(`[DD Station Discovery] 0 results for query="${query}" indexes=${JSON.stringify(idxList)}, trying next…`);
    }
  }

  console.log('[DD Station Discovery] All strategies returned 0 results.');
  return [];
}

export function formatDatadogLogsForAi(entries: DatadogLogEntry[]): string {
  if (entries.length === 0) return 'No Datadog logs returned for this window.';

  const MAX_INLINE = 200;
  const shown = entries.slice(0, MAX_INLINE);
  const lines = shown.map((e, i) => {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    const host = e.host ? `[${e.host}]` : '';
    const svc = e.service ? `{${e.service}}` : '';
    const lvl = e.level ?? 'INFO';
    return `[DD-${i + 1}] ${ts} ${lvl} ${host}${svc} ${e.message}`.trim();
  });

  let text = lines.join('\n');
  if (entries.length > MAX_INLINE) {
    text += `\n... and ${entries.length - MAX_INLINE} more Datadog entries (summarized above)`;
  }
  return text;
}
