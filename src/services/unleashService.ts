import type { AiSettings } from '../store/aiSettings';
import type { LogEntry } from '../types';
import type { DiagnosisResult, AiCorrelatedLog, LogSuggestion } from '../types/diagnosis';
import { estimateTokens, recordTokenUsage } from '../utils/tokenEstimator';
import { matchTemplate } from '../templates/nocTemplates';

export interface ChatMessage {
  role: 'User' | 'Assistant';
  text: string;
}

// Max characters of log text to send per non-diagnosis request (~30KB)
const MAX_LOG_CHARS = 30_000;

/**
 * Format log entries as readable text, capped by character count.
 * Prioritizes ERROR/WARN entries so they always make it into the sample.
 * Includes payload excerpts for richer context.
 */
export function formatLogsForAi(logs: LogEntry[]): string {
  const priority = logs.filter(l => l.level === 'ERROR' || l.level === 'WARN');
  const rest = logs.filter(l => l.level !== 'ERROR' && l.level !== 'WARN');
  const ordered = [...priority, ...rest];

  const lines: string[] = [];
  let chars = 0;
  for (const l of ordered) {
    let line = `[${l.rawTimestamp}] [${l.level}] [${l.displayComponent}]: ${l.displayMessage}`;
    // Include correlation IDs for cross-referencing
    const ids: string[] = [];
    if (l.callId) ids.push(`callId=${l.callId}`);
    if (l.reportId) ids.push(`reportId=${l.reportId}`);
    if (l.stationId) ids.push(`station=${l.stationId}`);
    if (ids.length > 0) line += ` {${ids.join(', ')}}`;
    // Include short payload for ERROR/WARN
    if ((l.level === 'ERROR' || l.level === 'WARN') && l.payload) {
      const excerpt = l.payload.slice(0, 150).replace(/\n/g, ' ');
      line += `\n  → ${excerpt}`;
    }
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

async function post(settings: AiSettings, messages: ChatMessage[], opts?: { skipAssistant?: boolean }): Promise<string> {
  if (!settings.token) {
    throw new Error('No API token configured. Click the gear icon to add your Unleashed token.');
  }

  const url = resolveUrl(settings);

  const body: Record<string, unknown> = { messages };
  // Only attach assistantId for calls that rely on the assistant's built-in knowledge.
  // Calls that supply their own full system prompt (e.g. diagnoseLogs) should skip it
  // to avoid "Assistant must be of type general" errors.
  if (settings.assistantId && !opts?.skipAssistant) body.assistantId = settings.assistantId;

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
  const answer = extractAnswer(data);

  // Track token usage (estimate since Unleash API doesn't return token counts)
  const inputText = messages.map(m => m.text).join('');
  recordTokenUsage(estimateTokens(inputText), estimateTokens(answer));

  return answer;
}

export async function summarizeLogs(settings: AiSettings, logs: LogEntry[]): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC (Network Operations Center) log analyst. Summarize the following log session in plain language. Identify what happened, the sequence of key events, any errors, and the overall outcome.\n\nLOGS:\n${logText}`,
  }], { skipAssistant: true });
}

export async function detectAnomalies(settings: AiSettings, logs: LogEntry[]): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC log analyst. Analyze the following logs for anomalies, errors, and root causes. For each issue found: describe the problem, its likely cause, and any recommended action. Format as a numbered list.\n\nLOGS:\n${logText}`,
  }], { skipAssistant: true });
}

export async function autoTagLogs(settings: AiSettings, logs: LogEntry[]): Promise<string> {
  const logText = formatLogsForAi(logs);
  return post(settings, [{
    role: 'User',
    text: `You are a NOC log classifier. Review these log entries and group them into categories (e.g. SIP, AUTHENTICATION, NETWORK, MEDIA, SYSTEM, DATABASE, TIMEOUT, ERROR). Return a summary of how many entries belong to each category and what they indicate.\n\nLOGS:\n${logText}`,
  }], { skipAssistant: true });
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
  }], { skipAssistant: true });
}

export async function chatWithLogs(
  settings: AiSettings,
  userMessage: string,
  logs: LogEntry[],
  history: ChatMessage[]
): Promise<string> {
  const logText = formatLogsForAi(logs);

  // Check if the user's message triggers a NOC template (e.g. closure note)
  const template = matchTemplate(userMessage);
  const effectiveMessage = template
    ? `${template.prompt}\n\nUser's original request: "${userMessage}"`
    : userMessage;

  // Build full conversation: system context + history + new user message
  const messages: ChatMessage[] = [
    {
      role: 'User',
      text: `You are a NOC log analyst assistant. The following is a sample of the current log session for context:\n\nLOGS:\n${logText}`,
    },
    { role: 'Assistant', text: 'Understood. I have reviewed the logs and am ready to answer your questions.' },
    ...history.slice(-6), // last 3 exchanges
    { role: 'User', text: effectiveMessage },
  ];

  return post(settings, messages, { skipAssistant: true });
}

/**
 * Max characters of log text to send to the diagnosis prompt.
 * Increased from 15KB to 100KB to give the AI enough context across
 * multiple log sources (Datadog CSV, FDX, SIP, call logs).
 * Unleashed AI models support 128k+ context windows.
 */
const MAX_DIAGNOSIS_LOG_CHARS = 100_000;

/**
 * Format a single log entry for diagnosis context.
 * Includes payload/JSON content that was previously stripped out,
 * which is critical for Datadog CSV (embedded JSON), FDX messages,
 * and SIP payloads.
 */
function formatLogEntryForDiagnosis(l: LogEntry, idx: number): string {
  const parts: string[] = [];

  // Core log line with index and source label
  const sourceTag = l.sourceLabel || (l.sourceType === 'datadog' ? 'Datadog' : l.component || 'unknown');
  parts.push(`[${idx}] ${l.rawTimestamp} ${l.level} [${sourceTag}] ${l.displayComponent}: ${l.displayMessage}`);

  // Include source file info so AI knows which log source this is from
  if (l.fileName) {
    parts[0] += ` [file:${l.fileName}]`;
  }

  // Include correlation IDs — critical for cross-system correlation
  const correlations: string[] = [];
  if (l.callId) correlations.push(`callId=${l.callId}`);
  if (l.reportId) correlations.push(`reportId=${l.reportId}`);
  if (l.operatorId) correlations.push(`operatorId=${l.operatorId}`);
  if (l.extensionId) correlations.push(`extId=${l.extensionId}`);
  if (l.stationId) correlations.push(`station=${l.stationId}`);
  if (l.cncID) correlations.push(`cncId=${l.cncID}`);
  if (l.messageType) correlations.push(`msgType=${l.messageType}`);
  if (correlations.length > 0) {
    parts.push(`  IDs: ${correlations.join(', ')}`);
  }

  // Include payload (truncated) for context — this is where the real diagnostic data lives
  const payload = l.payload?.trim();
  if (payload) {
    // For JSON payloads, include key fields only
    if (l.type === 'JSON' && l.json) {
      const jsonSummary = extractJsonKeyFields(l.json);
      if (jsonSummary) {
        parts.push(`  ${jsonSummary}`);
      }
    } else if (l.isSip) {
      // For SIP, include first line + key headers (compact)
      const sipLines = payload.split('\n').slice(0, 6);
      parts.push(`  SIP: ${sipLines.join(' | ')}`);
    } else if (payload.length <= 300) {
      // Short payloads — include fully
      parts.push(`  ${payload}`);
    } else {
      // Longer payloads — include first 250 chars
      parts.push(`  ${payload.slice(0, 250)}…`);
    }
  }

  return parts.join('\n');
}

/**
 * Extract key diagnostic fields from a JSON log payload.
 * Focuses on Carbyne-specific fields: machineData, error info, message type.
 */
function extractJsonKeyFields(json: Record<string, unknown>): string {
  const parts: string[] = [];

  // Machine data (Datadog/CCS)
  const md = json.machineData as Record<string, unknown> | undefined;
  if (md) {
    if (md.callCenterName) parts.push(`cnc=${md.callCenterName}`);
    if (md.name) parts.push(`machine=${md.name}`);
  }

  // FDX message type data
  if (json.messageType) parts.push(`msgType=${json.messageType}`);
  if (json.reportNLPConversation) {
    const rnc = json.reportNLPConversation as Record<string, unknown>;
    if (rnc.reportID) parts.push(`report=${rnc.reportID}`);
  }
  if (json.fdxReportUpdateMessageData) {
    const data = json.fdxReportUpdateMessageData as Record<string, unknown>;
    if (data.reportID) parts.push(`report=${data.reportID}`);
    if (data.reportUpdateTypes) parts.push(`update=${data.reportUpdateTypes}`);
  }

  // Error/exception info
  if (json.error) parts.push(`error=${String(json.error).slice(0, 100)}`);
  if (json.exception) parts.push(`exception=${String(json.exception).slice(0, 100)}`);
  if (json.optionCause) parts.push(`cause=${String(json.optionCause).slice(0, 100)}`);

  return parts.length > 0 ? `JSON: {${parts.join(', ')}}` : '';
}

/**
 * Format logs for the diagnosis prompt with 1-based indices.
 * Uses smart prioritization: ERROR > WARN > SIP failures > INFO.
 * Includes payloads, correlation IDs, and JSON key fields.
 * Returns both the formatted text and a map from 1-based index → LogEntry.id.
 */
export function formatLogsForDiagnosis(logs: LogEntry[]): { text: string; indexToId: Map<number, number> } {
  const indexToId = new Map<number, number>();

  if (logs.length === 0) {
    return { text: 'No logs loaded.', indexToId };
  }

  // Step 1: Prioritize and select logs (errors first, with temporal context)
  const errors = logs.filter(l => l.level === 'ERROR');
  const warns = logs.filter(l => l.level === 'WARN');
  const sipRelevant = logs.filter(l => l.isSip && l.level === 'INFO');
  const infos = logs.filter(l => l.level === 'INFO' && !l.isSip);

  // Build ordered log set: all errors, all warnings, SIP info, then remaining info
  const prioritized = [...errors, ...warns, ...sipRelevant];

  // Add 3 logs surrounding each error for temporal context
  const contextLogIds = new Set<number>();
  for (const err of errors) {
    const errIdx = logs.findIndex(l => l.id === err.id);
    if (errIdx === -1) continue;
    for (let i = Math.max(0, errIdx - 3); i <= Math.min(logs.length - 1, errIdx + 3); i++) {
      contextLogIds.add(logs[i].id);
    }
  }

  // Add context logs that aren't already in prioritized
  const prioritizedIds = new Set(prioritized.map(l => l.id));
  const contextLogs = logs.filter(l => contextLogIds.has(l.id) && !prioritizedIds.has(l.id));
  const selectedSet = [...prioritized, ...contextLogs];

  // Fill remaining space with INFO logs
  const selectedIds = new Set(selectedSet.map(l => l.id));
  const remainingInfos = infos.filter(l => !selectedIds.has(l.id));

  // Combine and sort chronologically
  const allSelected = [...selectedSet, ...remainingInfos].sort((a, b) => a.timestamp - b.timestamp);

  // Step 2: Build the text output with intelligent truncation
  const lines: string[] = [];
  let chars = 0;
  let idx = 1;

  // Add summary header with source breakdown
  const sourceCounts = new Map<string, number>();
  logs.forEach(l => {
    const src = l.sourceLabel || (l.sourceType === 'datadog' ? 'Datadog' : l.component || 'APEX Local');
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  });
  const sourceBreakdown = [...sourceCounts.entries()].map(([s, c]) => `${s}:${c}`).join(', ');
  const summaryLine = `LOG OVERVIEW: ${logs.length} total logs | ${errors.length} errors | ${warns.length} warnings | ${sipRelevant.length} SIP | Sources: [${sourceBreakdown}] | Files: ${[...new Set(logs.map(l => l.fileName).filter(Boolean))].join(', ')}`;
  lines.push(summaryLine);
  chars += summaryLine.length + 1;

  for (const l of allSelected) {
    const line = formatLogEntryForDiagnosis(l, idx);
    if (chars + line.length > MAX_DIAGNOSIS_LOG_CHARS) break;
    lines.push(line);
    indexToId.set(idx, l.id);
    chars += line.length + 1;
    idx++;
  }

  // Add note if logs were truncated
  if (idx - 1 < allSelected.length) {
    lines.push(`\n[... ${allSelected.length - (idx - 1)} additional logs omitted due to context limit. ${errors.length} errors and ${warns.length} warnings were prioritized above.]`);
  }

  return { text: lines.join('\n'), indexToId };
}

interface DiagnosisJsonBlock {
  correlated_indices?: number[];
  reasons?: Record<string, string>;
  summary?: string;
  root_cause?: string;
  log_suggestions?: Array<{ source: string; reason: string; query?: string }>;
  applied_troubleshooting?: string;
}

/**
 * Parse the AI response text to extract the structured JSON block and prose fields.
 */
export function parseDiagnosisResponse(
  responseText: string,
  indexToId: Map<number, number>,
  logs: LogEntry[]
): DiagnosisResult {
  const logById = new Map(logs.map(l => [l.id, l]));
  let parsed: DiagnosisJsonBlock = {};

  // Extract ```json ... ``` fence
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/i);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[1]) as DiagnosisJsonBlock;
    } catch { /* ignore parse errors */ }
  }

  // Build correlated log objects from indices
  const correlatedLogs: AiCorrelatedLog[] = [];
  for (const idx of (parsed.correlated_indices ?? [])) {
    const logId = indexToId.get(idx);
    if (logId == null) continue;
    const log = logById.get(logId);
    if (!log) continue;
    correlatedLogs.push({
      logId,
      index: idx,
      rawTimestamp: log.rawTimestamp,
      level: log.level,
      component: log.displayComponent,
      message: log.displayMessage,
      reason: parsed.reasons?.[String(idx)] ?? '',
    });
  }

  const logSuggestions: LogSuggestion[] = (parsed.log_suggestions ?? []).map(s => ({
    source: s.source,
    reason: s.reason,
    query: s.query,
  }));

  return {
    summary: parsed.summary ?? '',
    rootCause: parsed.root_cause ?? '',
    correlatedLogs,
    logSuggestions,
    appliedTroubleshooting: parsed.applied_troubleshooting ?? '',
    rawResponse: responseText,
  };
}

/**
 * Run a full NOC diagnosis: correlate Zendesk ticket with loaded logs using Unleashed AI.
 * The AI returns a structured JSON block with correlated log indices, reasons, suggestions, and more.
 *
 * The prompt is tuned for Carbyne APEX/CCS/FDX systems and understands:
 * - Datadog CSV logs (logSource, machineData, callCenterName, station name)
 * - FDX WebSocket messages (messageType, reportNLPConversation, IoT providers)
 * - CCS-SDK logs (PBX monitoring, call routing, extension registration)
 * - Homer SIP captures (INVITE/BYE/CANCEL, SDP, PIDF+XML geolocation)
 * - APEX event PDFs (station, agent, caller, transcript, queue)
 * - Call log CSVs (call records with duration, termination reason, agent info)
 */
export async function diagnoseLogs(
  settings: AiSettings,
  ticketText: string,
  logs: LogEntry[],
  customerTimezone?: string,
  datadogContext?: string
): Promise<DiagnosisResult> {
  const { text: logText, indexToId } = formatLogsForDiagnosis(logs);

  const prompt = `You are an expert NOC (Network Operations Center) diagnosis assistant for **Carbyne** (911/emergency communications platform). You have access to the organization's Confluence knowledge base, Zendesk ticket history, Slack conversations, and engineering runbooks.

## SYSTEM KNOWLEDGE — Carbyne Log Sources

You are analyzing logs from a PSAP (Public Safety Answering Point) system. Understand these log types:

1. **Datadog CSV (extract-*.csv)** — Server-side logs from Carbyne's production stack
   - Key fields: logLevel, logSource (service name), machineData.callCenterName (CNC), machineData.name (station/operator machine)
   - Services: PBXCallMonitoringService, FDXMessageHandlerService, CCS-SDK, LogEventData
   - Look for: ERROR entries, failed call monitoring, PBX registration failures, WebSocket disconnects

2. **FDX Logs (log *.txt)** — Client-side FDX (Field Data Exchange) WebSocket messages
   - Format: [LEVEL] [date, time,ms] [service]: message + JSON payload
   - Contains: IoT provider updates, report NLP conversations, operator status updates, call queue changes
   - Look for: WebSocket disconnects, message delivery failures, stale operator data

3. **CCS-SDK / PBX Logs** — Call Control System logs
   - Contains: Extension registration, call monitoring, PBX errors, call routing decisions
   - Key patterns: "Failed to monitor call", "extensionID", "registration failed"
   - Look for: Extension registration failures → calls not being delivered to stations

4. **Homer SIP Captures (export_*.txt)** — Raw SIP protocol messages
   - Format: proto:PROTOCOL TIMESTAMP SOURCE ---> DESTINATION, then full SIP headers + body
   - Contains: INVITE (new call), BYE (end call), CANCEL, SIP response codes (4xx/5xx/6xx = errors)
   - Contains PIDF+XML with geolocation data for emergency calls
   - Look for: SIP 4xx/5xx errors, failed INVITEs, missing BYE (orphaned calls), codec mismatches

5. **APEX Event PDFs** — Carbyne call event summaries
   - Contains: Station, Agent, Queue, Phone number, Duration, Termination Reason, Transcript
   - Use to: Identify the specific call, agent, and station involved in the incident

6. **Call Log CSVs** — Structured call records
   - Columns: ID, Created, Phone, Duration, Termination Reason, Station, Agent Name, Queue Name, Type, etc.
   - Use to: Identify patterns (multiple short calls = system issue, specific station = workstation issue)

## TICKET
--- TICKET ---
${ticketText}
--- END TICKET ---
${customerTimezone ? `
## TIMEZONE CONTEXT
Customer timezone: "${customerTimezone}". Log timestamps may be in UTC or a different timezone. When the ticket mentions times like "9:15 AM", convert to the log timestamp format to find matching entries. Look for log entries within ±30 minutes of the reported incident time.
` : ''}
${datadogContext ? `
## DATADOG / PDF / ENRICHMENT CONTEXT
--- ENRICHMENT ---
${datadogContext}
--- END ENRICHMENT ---
Cross-reference the enrichment data above with the log entries below. Match by:
- Timestamp correlation (same time window)
- Station/host name correlation (machineData.name ↔ station in logs)
- Error message similarity
- Call-ID / Event-ID correlation
` : ''}
## LOADED LOG ENTRIES
Each log is prefixed with a 1-based index [N] and a **[Source]** tag (e.g. [Datadog], [Homer SIP], [CCS/PBX], [FDX], [Call Log], [APEX Local]).
Logs include correlation IDs (callId, reportId, operatorId, etc.) and file source info.

**CRITICAL: Cross-reference across ALL loaded sources.** Match timestamps, call IDs, station IDs, and error patterns between different log sources. For example, if a Homer SIP log shows a failed INVITE at 14:32, look for CCS/Datadog errors in the same ±2 minute window. The NOC agent loaded multiple sources specifically to find cross-source correlations.

--- LOGS ---
${logText}
--- END LOGS ---

## YOUR TASK

1. **Correlate** the ticket symptoms with specific log entries. Even if exact matches aren't found, identify logs from the same time window, same station, or same error pattern.
2. **Identify the root cause** using your knowledge of Carbyne's architecture (APEX, CCS, FDX, PBX, SIP routing).
3. **Suggest additional log sources** if the loaded logs don't contain enough information.
4. **Describe troubleshooting** steps already visible in the logs or that should be applied.

IMPORTANT: Be aggressive about correlating logs — if a log entry is from the right time window, right station, or shows a related error pattern, mark it as correlated and explain why. NOC agents need to see which logs matter. Do NOT return an empty correlated_indices unless there are truly zero loaded logs.

## REQUIRED RESPONSE FORMAT

Provide a brief prose explanation, then a REQUIRED JSON block:

\`\`\`json
{
  "correlated_indices": [1, 5, 12],
  "reasons": {
    "1": "Brief explanation of why this log is relevant to the ticket",
    "5": "Brief explanation",
    "12": "Brief explanation"
  },
  "summary": "One paragraph diagnosis summary",
  "root_cause": "Concise root cause (or 'Insufficient data — need X logs' if unclear)",
  "log_suggestions": [
    { "source": "Datadog", "reason": "Why this source would help", "query": "@log.machineData.callCenterName:xxx service:prod" },
    { "source": "HOMER", "reason": "Why SIP traces would help" }
  ],
  "applied_troubleshooting": "Steps already taken or visible in logs, and recommended next actions"
}
\`\`\`

You MUST include the JSON block. If evidence is weak, still correlate the most likely entries and note uncertainty in reasons.`;

  const responseText = await post(settings, [{ role: 'User', text: prompt }], { skipAssistant: true });
  return parseDiagnosisResponse(responseText, indexToId, logs);
}

/**
 * Generate a structured internal note draft from a diagnosis result.
 * The agent will edit this before posting to Zendesk.
 */
export async function generateInternalNote(
  settings: AiSettings,
  diagnosisResult: DiagnosisResult,
  ticketText: string,
  customerTimezone: string,
  nocTimezone: string
): Promise<string> {
  const correlatedLines = diagnosisResult.correlatedLogs
    .map(l => `  [${l.rawTimestamp}] ${l.level} ${l.component}: ${l.message}\n  → ${l.reason}`)
    .join('\n');

  const suggestionsLines = diagnosisResult.logSuggestions
    .map(s => `  • ${s.source}: ${s.reason}${s.query ? ` (query: ${s.query})` : ''}`)
    .join('\n');

  const prompt = `You are a NOC analyst writing an internal support note. Based on the diagnosis below, generate a clear, professional internal ticket note that a NOC agent can review and post to Zendesk.

DIAGNOSIS SUMMARY: ${diagnosisResult.summary}
ROOT CAUSE: ${diagnosisResult.rootCause}
CUSTOMER TIMEZONE: ${customerTimezone}
NOC TIMEZONE: ${nocTimezone}
APPLIED TROUBLESHOOTING: ${diagnosisResult.appliedTroubleshooting}

CORRELATED LOG EVIDENCE:
${correlatedLines || '  (none identified)'}

ADDITIONAL LOG SOURCES RECOMMENDED:
${suggestionsLines || '  (none)'}

ORIGINAL TICKET CONTEXT:
${ticketText.slice(0, 1000)}

Write a structured internal note in plain text using EXACTLY this format (fill in each section):

ISSUE:
[One sentence description of what the customer experienced]

REPORTED AT:
[Time from ticket in customer timezone — note the NOC timezone equivalent]

ROOT CAUSE:
[Concise technical root cause]

RELEVANT LOG EVIDENCE:
[List the key log lines with timestamps and brief explanation of each]

STEPS TAKEN:
[Steps already taken, pulled from ticket comments or logs — or "None documented"]

NEXT STEPS:
[Numbered list of recommended actions for the NOC team]

ADDITIONAL LOGS TO CHECK:
[From log suggestions, or "None required"]

Keep each section concise and factual. Use plain text, no markdown.`;

  return post(settings, [{ role: 'User', text: prompt }], { skipAssistant: true });
}

/**
 * Refine an existing internal note draft based on an agent's chat instruction.
 * Returns the complete updated note text.
 */
export async function refineInternalNote(
  settings: AiSettings,
  currentNote: string,
  agentInstruction: string
): Promise<string> {
  // Check if the agent's instruction triggers a NOC template (e.g. closure note)
  const template = matchTemplate(agentInstruction);
  const effectiveInstruction = template
    ? `${template.prompt}\n\nAgent's original request: "${agentInstruction}"`
    : agentInstruction;

  const prompt = `You are helping a NOC agent refine an internal ticket note. Here is the current draft:

--- CURRENT NOTE ---
${currentNote}
--- END NOTE ---

The agent has requested the following change:
"${effectiveInstruction}"

Return the complete updated note with the requested change applied. Keep the same structure and all other content intact. Return ONLY the note text, no preamble.`;

  return post(settings, [{ role: 'User', text: prompt }], { skipAssistant: true });
}
