/**
 * nocTemplates.ts
 *
 * Registry of NOC prompt templates that can be triggered by keyword phrases
 * in the AI chat. When a user's message matches a template's trigger phrases,
 * the template body is injected into the prompt so the AI fills it out using
 * the investigation context (ticket, logs, diagnosis) already in the conversation.
 */

export interface NocTemplate {
  /** Unique identifier */
  id: string;
  /** Human-readable label (shown in UI template buttons, if added later) */
  label: string;
  /** Phrases that trigger this template (matched case-insensitively against user message) */
  triggers: string[];
  /** The prompt injected when triggered — the AI fills this out using conversation context */
  prompt: string;
}

export const NOC_TEMPLATES: NocTemplate[] = [
  {
    id: 'closure_note',
    label: 'Closure Note',
    triggers: [
      'closing note',
      'closure note',
      'close the ticket',
      'close template',
      'close this case',
      'ticket closure',
      'wrap up the ticket',
      'fill out the close',
      'closing recap',
      'closure recap',
    ],
    prompt: `Write a ticket closure recap for the customer of the attached ticket using the following format:

Issue Summary:
[Summarize what the customer reported and the impact]

Troubleshooting Steps Taken(s):
[List each step taken during the investigation, including log analysis, Datadog checks, SIP trace review, etc.]

Root Cause:
[State the identified root cause based on the evidence gathered, or "Unable to determine — additional monitoring recommended" if inconclusive]

We have addressed your ticket and are subsequently closing the case. If you have any other issues, we encourage you to contact our support team to either reopen this ticket or initiate a new one.

---
Use the ticket details, log evidence, and any conclusions from this investigation to fill out each section. Be specific — reference actual timestamps, station names, error codes, and log sources where applicable. Keep it professional and customer-facing.`,
  },
];

/**
 * Check if a user message matches any registered template.
 * Returns the matching template or null.
 */
export function matchTemplate(userMessage: string): NocTemplate | null {
  const lower = userMessage.toLowerCase();
  for (const template of NOC_TEMPLATES) {
    for (const trigger of template.triggers) {
      if (lower.includes(trigger)) {
        return template;
      }
    }
  }
  return null;
}
