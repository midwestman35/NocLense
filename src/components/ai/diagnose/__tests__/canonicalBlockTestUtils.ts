import {
  buildInvestigationFromResponse,
  type UnleashResponseShape,
} from '../../../../services/canonicalAdapter';
import {
  isBlockOfKind,
  asBlockId,
  asCitationId,
  type BlockKind,
  type BlockOf,
  type Citation,
  type CitationSource,
  type Investigation,
} from '../../../../types/canonical';

const FIXED_NOW = 1_745_000_000_000;
let fixtureSequence = 0;

function nextFixtureId(prefix: string): string {
  fixtureSequence += 1;
  return `${prefix}-${String(fixtureSequence).padStart(3, '0')}`;
}

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
    now: () => FIXED_NOW,
    resolveLogLocator: () => ({
      fileName: 'pbx.log',
      lineNumber: 42,
      byteOffset: 1024,
    }),
  });
}

type BuiltTestBlock<K extends BlockKind> = {
  block: BlockOf<K>;
  citations: Investigation['citations'];
};

type PriorArtOverrides = Partial<Omit<BlockOf<'prior-art'>, 'body'>> & {
  body?: Partial<BlockOf<'prior-art'>['body']>;
  citation?: Partial<Citation> & { source?: CitationSource };
};

export function buildPriorArtBlock(
  overrides: PriorArtOverrides = {},
): BuiltTestBlock<'prior-art'> {
  const hasSummaryOverride = Object.prototype.hasOwnProperty.call(overrides.body ?? {}, 'summary');
  const sourceCitationId =
    overrides.body?.sourceCitationId ?? asCitationId(nextFixtureId('citation-prior-art'));
  const citation: Citation = {
    id: sourceCitationId,
    displayText: overrides.citation?.displayText ?? 'REP-18421',
    source: overrides.citation?.source ?? { kind: 'jira', key: 'REP-18421' },
    createdAt: overrides.citation?.createdAt ?? FIXED_NOW,
    lastVerifiedAt: overrides.citation?.lastVerifiedAt,
  };

  return {
    block: {
      id: overrides.id ?? asBlockId(nextFixtureId('block-prior-art')),
      kind: 'prior-art',
      createdAt: overrides.createdAt ?? FIXED_NOW,
      updatedAt: overrides.updatedAt ?? FIXED_NOW,
      citations: overrides.citations ?? [sourceCitationId],
      body: {
        source: overrides.body?.source ?? 'jira',
        title: overrides.body?.title ?? 'REP-18421',
        summary: hasSummaryOverride ? overrides.body?.summary : 'Similar registration fault.',
        sourceCitationId,
      },
    },
    citations: {
      [sourceCitationId]: {
        ...citation,
        id: sourceCitationId,
      },
    },
  };
}

type NoteOverrides = Partial<Omit<BlockOf<'note'>, 'body'>> & {
  body?: Partial<BlockOf<'note'>['body']>;
};

export function buildNoteBlock(
  overrides: NoteOverrides = {},
): BuiltTestBlock<'note'> {
  return {
    block: {
      id: overrides.id ?? asBlockId(nextFixtureId('block-note')),
      kind: 'note',
      createdAt: overrides.createdAt ?? FIXED_NOW,
      updatedAt: overrides.updatedAt ?? FIXED_NOW,
      citations: overrides.citations ?? [],
      body: {
        markdown: overrides.body?.markdown ?? 'Engineer note',
        authorRole: overrides.body?.authorRole ?? 'engineer',
      },
    },
    citations: {},
  };
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
