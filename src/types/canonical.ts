/**
 * canonical.ts — NocLense canonical investigation schema (v1)
 *
 * Phase 00 deliverable for the UI polish redesign. Shared data model
 * across AI output, Evidence, and `.noclense` exports. See design spec
 * §5.1 at docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md.
 *
 * Naming note: `src/types/investigation.ts` is already taken by the
 * Investigation Setup Modal handoff type. The canonical investigation
 * schema lives here under `canonical` to avoid collision.
 */

/** Schema version stamped on every `.noclense` export. Bump on breaking changes. */
export const INVESTIGATION_SCHEMA_VERSION = 1 as const;

export type InvestigationSchemaVersion = typeof INVESTIGATION_SCHEMA_VERSION;

/** Opaque UUID for a Block within an Investigation. */
export type BlockId = string;

/** Opaque UUID for a Citation within an Investigation's citation pool. */
export type CitationId = string;

export type HypothesisStatus = 'INCONCLUSIVE' | 'CONFIRMED' | 'RULED_OUT';

export type ActionKind = 'jira' | 'test-script' | 'resolve' | 'escalate';

export type PriorArtSource =
  | 'jira'
  | 'zendesk'
  | 'slack'
  | 'datadog'
  | 'confluence'
  | 'local-folder';

// ─── Block body shapes per kind ──────────────────────────────────────────

export interface ContextBody {
  customer?: string;
  site?: string;
  cnc?: string;
  region?: string;
  version?: string;
  eventId?: string;
  reported?: string;
}

export interface PriorArtRowBody {
  source: PriorArtSource;
  title: string;
  summary?: string;
}

export interface HypothesisBody {
  rank: 1 | 2 | 3;
  title: string;
  supportingEvidence: string;
  evidenceToConfirm: string;
  evidenceToRuleOut: string;
  status: HypothesisStatus;
}

export interface CollectionStep {
  label: string;
  command?: string;
  dependsOn?: 'do-first' | { ifFails: string };
}

export interface CollectionBody {
  targetHypothesisBlockId?: BlockId;
  steps: CollectionStep[];
}

export interface AnalysisBody {
  hypothesisBlockId: BlockId;
  statusUpdate: HypothesisStatus;
  summary: string;
}

export interface ActionBody {
  kind: ActionKind;
  summary: string;
  /** Pre-filled payload for downstream templates (Res-note, Jira, etc.) */
  payload?: Record<string, unknown>;
}

export interface NoteBody {
  markdown: string;
  authorRole: 'engineer' | 'ai';
}

// ─── Block (discriminated union over kind) ───────────────────────────────

interface BlockBase {
  id: BlockId;
  createdAt: number;
  updatedAt: number;
  /** CitationIds referencing `Investigation.citations`. Never inline. */
  citations: CitationId[];
}

export type Block = BlockBase &
  (
    | { kind: 'context'; body: ContextBody }
    | { kind: 'prior-art'; body: PriorArtRowBody }
    | { kind: 'hypothesis'; body: HypothesisBody }
    | { kind: 'collection'; body: CollectionBody }
    | { kind: 'analysis'; body: AnalysisBody }
    | { kind: 'action'; body: ActionBody }
    | { kind: 'note'; body: NoteBody }
  );

export type BlockKind = Block['kind'];

/** Helper type to narrow a Block to a specific kind. */
export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>;

// ─── Citation (discriminated union over source kind) ─────────────────────

/**
 * Canonical source of a citation. UI re-derives display strings from these
 * structured fields on render; the spec forbids storing rendered link text
 * as the source of truth.
 */
export type CitationSource =
  | {
      kind: 'log';
      fileName: string;
      /** 1-based line number where the entry begins. Display locator. */
      lineNumber: number;
      /** Byte offset where the entry begins. Stable across re-parse. */
      byteOffset: number;
      /** Session-scoped index into parsed log array. NOT persisted in exports. */
      entryId?: number;
    }
  | {
      kind: 'datadog';
      /** Unix ms, inclusive */
      startMs: number;
      /** Unix ms, exclusive */
      endMs: number;
      query: string;
    }
  | {
      kind: 'pcap';
      fileName: string;
      packetIndex?: number;
    }
  | {
      kind: 'jira';
      /** e.g. "REP-18421" */
      key: string;
    }
  | {
      kind: 'zendesk';
      ticketId: string;
    }
  | {
      kind: 'slack';
      workspace: string;
      channelId: string;
      /** Message timestamp for deep-link (e.g. "1745000000.123456"). */
      messageTs?: string;
    }
  | {
      kind: 'confluence';
      spaceKey: string;
      pageId: string;
    }
  | {
      kind: 'pdf';
      fileName: string;
      /** 1-based page number */
      page: number;
    };

export interface Citation {
  id: CitationId;
  /**
   * Render hint (e.g. "log.txt:14382"). UI may re-derive from `source`.
   * Kept in the schema so exports are human-inspectable.
   */
  displayText: string;
  source: CitationSource;
  createdAt: number;
  /** Last link-health check. Phase 02+ tracking. */
  lastVerifiedAt?: number;
}

export type CitationKind = CitationSource['kind'];

export type CitationOf<K extends CitationKind> = Citation & {
  source: Extract<CitationSource, { kind: K }>;
};

// ─── Investigation and Evidence containers ──────────────────────────────

export interface Investigation {
  schemaVersion: InvestigationSchemaVersion;
  id: string;
  ticketUrl?: string;
  createdAt: number;
  updatedAt: number;
  blocks: Block[];
  /** Flat pool of citations keyed by CitationId. Blocks reference by ID. */
  citations: Record<CitationId, Citation>;
}

/**
 * Evidence items are canonical block references + provenance metadata.
 * No new item union — the block schema above IS the item type.
 */
export interface EvidenceItem {
  blockId: BlockId;
  pinnedAt: number;
  pinnedBy: 'user' | 'ai';
  /** User-controlled sort order within the evidence set. */
  order: number;
  /** Engineer overlay note, distinct from `Block.body`. */
  note?: string;
}

export interface EvidenceSet {
  caseId: string;
  items: EvidenceItem[];
}

/**
 * `.noclense` export manifest (v1). Lives at `manifest.json` inside the
 * ZIP alongside `investigation.json`, raw logs, AI transcripts, and
 * attachments.
 */
export interface NoclenseManifestV1 {
  schemaVersion: InvestigationSchemaVersion;
  createdAt: number;
  app: {
    name: 'NocLense';
    version: string;
  };
  investigation: {
    id: string;
    schemaVersion: InvestigationSchemaVersion;
  };
  attachments: Array<{
    fileName: string;
    size: number;
    sha256: string;
  }>;
  redaction: {
    applied: boolean;
    rules: string[];
  };
}

// ─── Type guards ─────────────────────────────────────────────────────────

/**
 * Narrow a Block to a specific kind.
 * @example
 *   if (isBlockOfKind(block, 'hypothesis')) block.body.rank; // typed
 */
export function isBlockOfKind<K extends BlockKind>(
  block: Block,
  kind: K,
): block is BlockOf<K> {
  return block.kind === kind;
}

/**
 * Narrow a Citation to a specific source kind.
 */
export function isCitationOfKind<K extends CitationKind>(
  citation: Citation,
  kind: K,
): citation is CitationOf<K> {
  return citation.source.kind === kind;
}
