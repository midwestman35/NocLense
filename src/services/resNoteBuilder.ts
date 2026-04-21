/**
 * resNoteBuilder.ts — generates Res-note.txt from canonical data.
 *
 * Format (DailyNOC standard):
 *   [DRAFT — unconfirmed]   ← only if no CONFIRMED hypothesis
 *   Issue Summary: ...
 *   Root Cause: ...
 *   Resolution: ...
 *   Linked Jira: ...
 *   Customer Action: ...
 *   Status: ...
 *
 * @param investigation  Canonical Investigation.
 * @param evidenceSet    Associated EvidenceSet (used for item count).
 * @returns { text: string; isDraft: boolean }
 */

import type { Investigation, EvidenceSet, Block, BlockId } from '../types/canonical';

export interface ResNoteResult {
  text: string;
  /** True when no hypothesis reached CONFIRMED — "[DRAFT]" header is prepended. */
  isDraft: boolean;
}

function getContextBlock(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'context' } => b.kind === 'context',
  );
}

function getConfirmedHypothesis(investigation: Investigation) {
  const analyses = investigation.blocks.filter(
    (b): b is Block & { kind: 'analysis' } =>
      b.kind === 'analysis' && b.body.statusUpdate === 'CONFIRMED',
  );
  if (analyses.length === 0) return null;
  const firstAnalysis = analyses[0];
  return investigation.blocks.find(
    (b): b is Block & { kind: 'hypothesis' } =>
      b.kind === 'hypothesis' && b.id === firstAnalysis.body.hypothesisBlockId,
  ) ?? null;
}

function getTopHypothesis(investigation: Investigation) {
  const hypotheses = investigation.blocks.filter(
    (b): b is Block & { kind: 'hypothesis' } => b.kind === 'hypothesis',
  );
  return hypotheses.sort((a, b) => a.body.rank - b.body.rank)[0] ?? null;
}

function getAnalysisSummaryForHypothesis(
  investigation: Investigation,
  hypothesisId: BlockId,
): string | null {
  const match = investigation.blocks.find(
    (b): b is Block & { kind: 'analysis' } =>
      b.kind === 'analysis' && b.body.hypothesisBlockId === hypothesisId,
  );
  return match?.body.summary ?? null;
}

function getActionBlock(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'action' } => b.kind === 'action',
  );
}

function formatJiraRef(investigation: Investigation): string {
  const action = getActionBlock(investigation);
  if (!action) return 'N/A';
  if (action.body.payload.kind === 'jira') {
    const { projectKey, summary } = action.body.payload;
    return `${projectKey} — ${summary}`;
  }
  return 'N/A';
}

export function buildResNote(
  investigation: Investigation,
  evidenceSet: EvidenceSet,
): ResNoteResult {
  const contextBlock = getContextBlock(investigation);
  const confirmedHypothesis = getConfirmedHypothesis(investigation);
  const isDraft = confirmedHypothesis === null;
  const activeHypothesis = confirmedHypothesis ?? getTopHypothesis(investigation);

  const customer = contextBlock?.body.customer ?? '(unknown customer)';
  const ticketRef = contextBlock?.body.ticketUrl
    ? ` — ${contextBlock.body.ticketUrl}`
    : '';

  const rootCause = activeHypothesis?.body.title ?? '(root cause not identified)';

  let resolutionSummary = '(investigation incomplete)';
  if (activeHypothesis) {
    const analysisSummary = getAnalysisSummaryForHypothesis(
      investigation,
      activeHypothesis.id,
    );
    if (analysisSummary) {
      resolutionSummary = analysisSummary;
    } else {
      resolutionSummary = isDraft
        ? '(analysis pending for top hypothesis)'
        : '(no analysis recorded)';
    }
  }

  const jiraRef = formatJiraRef(investigation);

  const action = getActionBlock(investigation);
  const customerAction =
    action?.body.payload.kind === 'resolve'
      ? action.body.payload.resolutionNote
      : action?.body.summary ?? 'Monitor for recurrence';

  const status = isDraft ? 'DRAFT — Pending confirmation' : 'RESOLVED';
  const evidenceCount = evidenceSet.items.length;

  const lines: string[] = [
    ...(isDraft ? ['[DRAFT — unconfirmed]', ''] : []),
    `Issue Summary: ${customer}${ticketRef}`,
    `Root Cause: ${rootCause}`,
    `Resolution: ${resolutionSummary}`,
    `Linked Jira: ${jiraRef}`,
    `Customer Action: ${customerAction}`,
    `Status: ${status}`,
    `Evidence Items: ${evidenceCount}`,
  ];

  return { text: lines.join('\n'), isDraft };
}
