/**
 * jiraTemplateBuilder.ts — generates Jira issue creation template
 * from canonical Investigation data.
 *
 * Returns structured fields that the Submit Room can display and
 * copy individually or as a pre-formatted text block.
 *
 * @param investigation  Canonical Investigation.
 * @returns JiraTemplate with summary, description, priority, labels.
 */

import type { Investigation, Block } from '../types/canonical';

export interface JiraTemplate {
  summary: string;
  description: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  labels: string[];
  /** Pre-formatted text for one-click copy. */
  formatted: string;
}

function getContext(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'context' } => b.kind === 'context',
  );
}

function getTopHypothesis(investigation: Investigation) {
  return investigation.blocks
    .filter((b): b is Block & { kind: 'hypothesis' } => b.kind === 'hypothesis')
    .sort((a, b) => a.body.rank - b.body.rank)[0] ?? null;
}

function getActionBlock(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'action' } => b.kind === 'action',
  );
}

function derivePriority(investigation: Investigation): JiraTemplate['priority'] {
  const action = getActionBlock(investigation);
  if (action?.body.payload.kind === 'jira' && action.body.payload.priority) {
    return action.body.payload.priority;
  }
  const hasHighSignal = investigation.blocks.some(
    (b) => b.kind === 'hypothesis' && b.body.rank === 1 && b.body.status === 'CONFIRMED',
  );
  return hasHighSignal ? 'High' : 'Normal';
}

function deriveLabels(investigation: Investigation): string[] {
  const context = getContext(investigation);
  const labels: string[] = ['noclense-export'];
  if (context?.body.site) labels.push(`site:${context.body.site}`);
  if (context?.body.cnc) labels.push(`cnc:${context.body.cnc}`);
  if (context?.body.region) labels.push(`region:${context.body.region}`);
  return labels;
}

export function buildJiraTemplate(investigation: Investigation): JiraTemplate {
  const context = getContext(investigation);
  const topHypothesis = getTopHypothesis(investigation);
  const action = getActionBlock(investigation);

  const customer = context?.body.customer ?? '(unknown)';
  const ticketRef = context?.body.ticketUrl
    ? ` [${context.body.ticketUrl}]`
    : '';
  const rootCause = topHypothesis?.body.title ?? 'Root cause TBD';

  const summary = action?.body.payload.kind === 'jira'
    ? action.body.payload.summary
    : `${customer} — ${rootCause}`;

  const descriptionLines: string[] = [
    `*Customer:* ${customer}${ticketRef}`,
    '',
    `*Root Cause:* ${rootCause}`,
    '',
    `*Supporting Evidence:* ${topHypothesis?.body.supportingEvidence ?? 'See attached investigation.'}`,
    '',
    `*Evidence to Confirm:* ${topHypothesis?.body.evidenceToConfirm ?? 'N/A'}`,
    '',
    `*Recommended Action:* ${action?.body.summary ?? 'See attached investigation.'}`,
    '',
    '_Exported from NocLense. See attached .noclense file for full investigation._',
  ];

  const description = action?.body.payload.kind === 'jira'
    ? action.body.payload.description
    : descriptionLines.join('\n');

  const priority = derivePriority(investigation);
  const labels = deriveLabels(investigation);

  const formatted = [
    `Summary: ${summary}`,
    `Priority: ${priority}`,
    `Labels: ${labels.join(', ')}`,
    '',
    'Description:',
    description,
  ].join('\n');

  return { summary, description, priority, labels, formatted };
}
