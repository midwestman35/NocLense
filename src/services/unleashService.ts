import type { AiSettings } from '../store/aiSettings';
import type { LogEntry } from '../types';

export interface ChatMessage {
  role: 'User' | 'Assistant';
  text: string;
}

// Max characters of log text to send per request (~3KB)
const MAX_LOG_CHARS = 3000;

/**
 * Format log entries as readable text, capped by character count.
 * Prioritizes ERROR/WARN entries so they always make it into the sample.
 */
export function formatLogsForAi(logs: LogEntry[]): string {
  const priority = logs.filter(l => l.level === 'ERROR' || l.level === 'WARN');
  const rest = logs.filter(l => l.level !== 'ERROR' && l.level !== 'WARN');
  const ordered = [...priority, ...rest];

  const lines: string[] = [];
  let chars = 0;
  for (const l of ordered) {
    const line = `[${l.rawTimestamp}] [${l.level}] [${l.displayComponent}]: ${l.displayMessage}`;
    if (chars + line.length > MAX_LOG_CHARS) break;
    lines.push(line);
    chars += line.length + 1;
  }
  return lines.join('\n');
}

/** Use Vite dev proxy in development to avoid CORS; direct URL in production/Electron */
function resolveUrl(settings: AiSettings): string {
  if (import.meta.env.DEV) {
    return '/ai-proxy/chats';
  }
  return `${settings.endpoint}/chats`;
}

/** Extract text from ChatCompletionResponse message.parts */
function extractAnswer(data: any): string {
  // Try message.parts array (official schema)
  const parts = data?.message?.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts
      .filter((p: any) => p.type === 'Text' || p.text)
      .map((p: any) => p.text ?? p.content ?? '')
      .join('');
  }
  // Fallbacks
  return data?.message?.text ?? data?.answer ?? data?.text ?? JSON.stringify(data);
}

async function post(settings: AiSettings, messages: ChatMessage[]): Promise<string> {
  if (!settings.token) {
    throw new Error('No API token configured. Click the gear icon to add your Unleashed token.');
  }

  const url = resolveUrl(settings);

  const body: Record<string, unknown> = { messages };
  if (settings.assistantId) body.assistantId = settings.assistantId;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.token}`,
  };
  // unleash-account only needed if access mode is NOT "impersonate"
  // With impersonate mode the API key already carries the user identity
  if (settings.userEmail) {
    headers['unleash-account'] = settings.userEmail;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(`Network error — cannot reach Unleash API. (${e.message})`);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`Unleash API error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await res.json();
  return extractAnswer(data);
}

export async function summarizeLogs(settings: AiSettings, logs: LogEntry[]): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC (Network Operations Center) log analyst. Summarize the following log session in plain language. Identify what happened, the sequence of key events, any errors, and the overall outcome.\n\nLOGS:\n${logText}`,
  }]);
}

export async function detectAnomalies(settings: AiSettings, logs: LogEntry[]): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC log analyst. Analyze the following logs for anomalies, errors, and root causes. For each issue found: describe the problem, its likely cause, and any recommended action. Format as a numbered list.\n\nLOGS:\n${logText}`,
  }]);
}

export async function autoTagLogs(settings: AiSettings, logs: LogEntry[]): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC log classifier. Review these log entries and group them into categories (e.g. SIP, AUTHENTICATION, NETWORK, MEDIA, SYSTEM, DATABASE, TIMEOUT, ERROR). Return a summary of how many entries belong to each category and what they indicate.\n\nLOGS:\n${logText}`,
  }]);
}

export async function analyzeTicket(
  settings: AiSettings,
  ticketText: string,
  logs: LogEntry[]
): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC analyst. A technician has submitted the following support ticket:\n\n--- TICKET ---\n${ticketText}\n--- END TICKET ---\n\nUsing the log data below, identify any log entries or patterns that relate to the reported issue. Provide:\n1. Relevant log evidence (timestamps and messages)\n2. Likely root cause based on the logs\n3. Recommended next steps\n\nLOGS:\n${logText}`,
  }]);
}

export async function chatWithLogs(
  settings: AiSettings,
  userMessage: string,
  logs: LogEntry[],
  history: ChatMessage[]
): Promise<string> {
  const logText = formatLogsForAi(logs);

  // Build full conversation: system context + history + new user message
  const messages: ChatMessage[] = [
    {
      role: 'User',
      text: `You are a NOC log analyst assistant. The following is a sample of the current log session for context:\n\nLOGS:\n${logText}`,
    },
    { role: 'Assistant', text: 'Understood. I have reviewed the logs and am ready to answer your questions.' },
    ...history.slice(-6), // last 3 exchanges
    { role: 'User', text: userMessage },
  ];

  return post(settings, messages);
}
