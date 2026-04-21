import {
  buildInvestigationFromResponse,
  type UnleashResponseShape,
} from '../../../../services/canonicalAdapter';
import {
  isBlockOfKind,
  type BlockKind,
  type BlockOf,
  type Investigation,
} from '../../../../types/canonical';

function makeIdFactory(prefix: string): () => string {
  let value = 0;

  return () => `${prefix}-${String(++value).padStart(3, '0')}`;
}

export function makeInvestigation(
  overrides: Partial<UnleashResponseShape> = {},
): Investigation {
  const response: UnleashResponseShape = {
    summary: 'Caller reports repeated dropped calls after login attempts.',
    rootCause: 'PBX registration failure',
    hypotheses: [
      {
        rank: 1,
        title: 'PBX registration failure',
        supportingEvidence: 'Repeated 401 responses during re-registration.',
        evidenceToConfirm: 'Confirm registrations succeed after credential refresh.',
        evidenceToRuleOut: 'Find successful registrations during the failure window.',
        statusHint: 'CONFIRMED',
      },
    ],
    correlatedLogs: [{ logId: 7, index: 0, reason: 'Registration failures spike here.' }],
    logSuggestions: [],
    appliedTroubleshooting: 'Re-registered extension 4201.',
    rawResponse: 'raw',
    ...overrides,
  };

  return buildInvestigationFromResponse({
    response,
    ticketUrl: 'https://carbyne.zendesk.com/agent/tickets/45892',
    customer: 'Acme PSAP',
    idFactory: makeIdFactory('id'),
    now: () => 1_745_000_000_000,
    resolveLogLocator: () => ({
      fileName: 'pbx.log',
      lineNumber: 42,
      byteOffset: 1024,
    }),
  });
}

export function getBlock<K extends BlockKind>(
  investigation: Investigation,
  kind: K,
  index = 0,
): BlockOf<K> {
  const block = investigation.blocks.filter((candidate) => isBlockOfKind(candidate, kind))[index];
  if (!block) {
    throw new Error(`Missing block kind: ${kind}`);
  }

  return block;
}
