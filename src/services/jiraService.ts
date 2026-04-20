/**
 * jiraService.ts
 *
 * Creates Jira Cloud issues for NOC escalation tickets.
 * Uses the Jira REST API v3 with Atlassian Document Format (ADF) for description.
 *
 * Dependencies: AiSettings (jiraSubdomain, jiraEmail, jiraToken, jiraProjectKey)
 */
import type { AiSettings } from '../store/aiSettings';
import type { JiraTicketDraft } from '../types/diagnosis';
import {
  resolveApiUrl,
  basicAuthHeader,
  jsonHeaders,
  extractErrorDetail,
  validateSettingsFields,
  parseJson,
} from './apiUtils';

export interface JiraIssueCreatedResponse {
  key: string;
  url: string;
}

function resolveJiraUrl(settings: AiSettings, path: string): string {
  return resolveApiUrl(`/jira-proxy${path}`, `https://${settings.jiraSubdomain}${path}`);
}

function jiraHeaders(settings: AiSettings): HeadersInit {
  return jsonHeaders(basicAuthHeader(settings.jiraEmail, settings.jiraToken));
}

/**
 * Build an ADF (Atlassian Document Format) document from the Jira draft fields.
 * Uses a simple heading + bullet structure for readability.
 *
 * @param draft - The pre-filled Jira ticket draft from the diagnosis
 * @param ticketSubject - Optional Zendesk ticket subject for cross-reference
 */
function buildAdfDescription(draft: JiraTicketDraft, ticketSubject?: string): unknown {
  const row = (label: string, value: string) => ({
    type: 'paragraph',
    content: [
      { type: 'text', text: `${label}: `, marks: [{ type: 'strong' }] },
      { type: 'text', text: value },
    ],
  });

  const content: unknown[] = [];

  if (ticketSubject) {
    content.push(row('Zendesk Ticket', ticketSubject));
  }
  content.push(row('Fault Description', draft.faultDescription));
  content.push(row('Incident Priority', draft.priority));
  content.push(row('Failure Time Frame', draft.failureTimeFrame));
  content.push(row('Position Affected', draft.positionAffected));
  content.push(row('Evidence', draft.evidence));
  content.push(row('Applied Troubleshooting', draft.appliedTroubleshooting));

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Create a Jira escalation ticket from a NOC diagnosis draft.
 *
 * @param settings - AI/integration settings (jiraSubdomain, jiraEmail, jiraToken, jiraProjectKey)
 * @param draft - Pre-filled ticket draft from the diagnosis result
 * @param ticketSubject - Optional Zendesk ticket subject for cross-reference in description
 * @returns The created issue key and URL
 * @throws Error with user-friendly message on API or auth failure
 */
export async function createJiraTicket(
  settings: AiSettings,
  draft: JiraTicketDraft,
  ticketSubject?: string
): Promise<JiraIssueCreatedResponse> {
  validateSettingsFields(
    settings,
    ['jiraSubdomain', 'jiraEmail', 'jiraToken', 'jiraProjectKey'],
    'Jira'
  );

  const headers = jiraHeaders(settings);
  const url = resolveJiraUrl(settings, '/rest/api/3/issue');

  const body = {
    fields: {
      project: { key: settings.jiraProjectKey },
      summary: `[NOC Escalation] ${draft.faultDescription.slice(0, 200)}`,
      issuetype: { name: 'Bug' },
      priority: { name: draft.priority },
      description: buildAdfDescription(draft, ticketSubject),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e: unknown) {
    throw new Error(`Network error — cannot reach Jira. (${e instanceof Error ? e.message : String(e)})`);
  }

  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    if (res.status === 401) throw new Error('Jira authentication failed. Check your email and API token in settings.');
    if (res.status === 403) throw new Error('Jira permission denied. Ensure your account can create issues in this project.');
    if (res.status === 404) throw new Error(`Jira project "${settings.jiraProjectKey}" not found.`);
    throw new Error(`Jira error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await parseJson<{ id: string; key: string; self: string }>(res);
  const key = data.key;
  const baseUrl = import.meta.env.DEV
    ? `https://${settings.jiraSubdomain}`
    : `https://${settings.jiraSubdomain}`;
  return { key, url: `${baseUrl}/browse/${key}` };
}
