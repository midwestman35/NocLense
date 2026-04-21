/**
 * canonical.ts — NocLense canonical investigation schema (v1)
 *
 * Phase 00 deliverable for the UI polish redesign. Shared data model
 * across AI output, Evidence, and `.noclense` exports. See design spec
 * §5.1 at docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md.
 *
 * File-location note: `src/types/investigation.ts` was already taken by
 * the Investigation Setup Modal handoff type. The canonical schema lives
 * here instead. Spec §5.1 has been amended to reflect this.
 *
 * Runtime vs persisted separation: `Citation.source` contains only
 * persisted fields. Session-scoped enrichment (like `entryId`, an
 * index into the parsed log array) lives in a separate runtime map
 * maintained by `LogContext` — see `CitationRuntimeEnrichment` below.
 * This keeps exports portable and prevents drift between persisted
 * locators and session indices.
 *
 * Type guards (`isBlockOfKind`, `isCitationOfKind`) narrow already-
 * typed values only. Runtime validation of unknown input (AI output,
 * imported manifests) is the adapter/importer's responsibility and
 * lands in Phase 01b via `canonicalAdapter.ts`.
 */

// ─── Branded IDs ─────────────────────────────────────────────────────────
//
// Nominal typing prevents accidental mixing of a BlockId where a
// CitationId is expected, or a plain string where either is expected.

declare const blockIdBrand: unique symbol;
declare const citationIdBrand: unique symbol;
declare const investigationIdBrand: unique symbol;
declare const caseIdBrand: unique symbol;

export type BlockId = string & { readonly [blockIdBrand]: never };
export type CitationId = string & { readonly [citationIdBrand]: never };
export type InvestigationId = string & { readonly [investigationIdBrand]: never };
export type CaseId = string & { readonly [caseIdBrand]: never };

/** Cast helpers. Use at the boundary where a string is known to be a valid ID. */
export const asBlockId = (s: string): BlockId => s as BlockId;
export const asCitationId = (s: string): CitationId => s as CitationId;
export const asInvestigationId = (s: string): InvestigationId => s as InvestigationId;
export const asCaseId = (s: string): CaseId => s as CaseId;

// ─── Schema versions (orthogonal concerns) ───────────────────────────────

/** Investigation content schema. Bump on canonical block / citation changes. */
export const INVESTIGATION_SCHEMA_VERSION = 1 as const;
export type InvestigationSchemaVersion = typeof INVESTIGATION_SCHEMA_VERSION;

/** `.noclense` manifest schema. Bump on manifest layout or file-inventory changes. */
export const MANIFEST_SCHEMA_VERSION = 1 as const;
export type ManifestSchemaVersion = typeof MANIFEST_SCHEMA_VERSION;

// ─── Enums / small unions ────────────────────────────────────────────────

export type HypothesisStatus = 'INCONCLUSIVE' | 'CONFIRMED' | 'RULED_OUT';

export type PriorArtSource =
  | 'jira'
  | 'zendesk'
  | 'slack'
  | 'datadog'
  | 'confluence'
  | 'local-folder';

// ─── Block body shapes ───────────────────────────────────────────────────

/**
 * ContextBody requires a stable identifier (`customer`). Downstream exports
 * use `customer` for case titles, Res-note headers, and .noclense filenames.
 * If the ticket doesn't surface a customer name, callers must supply a
 * placeholder like `"(unknown customer)"` at block construction time.
 */
export interface ContextBody {
  customer: string;
  ticketUrl?: string;
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
  /**
   * CitationId referencing the canonical source for this row. Required so
   * every prior-art row is navigable back to its origin.
   */
  sourceCitationId: CitationId;
}

export interface HypothesisBody {
  rank: 1 | 2 | 3;
  title: string;
  supportingEvidence: string;
  evidenceToConfirm: string;
  evidenceToRuleOut: string;
  status: HypothesisStatus;
}

/** Collection step dependency — properly discriminated. */
export type CollectionStepDependency =
  | { kind: 'do-first' }
  | { kind: 'if-fails'; ofStepLabel: string };

export interface CollectionStep {
  label: string;
  command?: string;
  dependsOn?: CollectionStepDependency;
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

/** Action payload — discriminated by action kind. No free-form `Record`. */
export type ActionPayload =
  | { kind: 'jira'; projectKey: string; summary: string; description: string; priority?: 'Low' | 'Normal' | 'High' | 'Urgent' }
  | { kind: 'test-script'; scriptId: string; parameters?: Record<string, string> }
  | { kind: 'resolve'; resolutionNote: string; tags: string[] }
  | { kind: 'escalate'; team: string; reason: string };

export interface ActionBody {
  summary: string;
  payload: ActionPayload;
}

export interface NoteBody {
  markdown: string;
  authorRole: 'engineer' | 'ai';
}

// ─── Block (discriminated over kind) ─────────────────────────────────────

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

/** Narrow a Block to a specific kind. */
export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>;

/**
 * Kind → body map. Useful for writing generic helpers that operate on body
 * given a known kind (e.g. `renderBody<K>(kind: K, body: BlockBodyByKind[K])`).
 */
export type BlockBodyByKind = {
  context: ContextBody;
  'prior-art': PriorArtRowBody;
  hypothesis: HypothesisBody;
  collection: CollectionBody;
  analysis: AnalysisBody;
  action: ActionBody;
  note: NoteBody;
};

// ─── Citation (persisted source only) ────────────────────────────────────

/**
 * Canonical *persisted* source of a citation. Session-scoped enrichment
 * (entryId, resolved line-number-as-rendered, link-health checks) lives
 * in `CitationRuntimeEnrichment` maintained by `LogContext`. The persisted
 * source must be complete enough to re-resolve the citation on import
 * without any runtime state.
 */
export type CitationSource =
  | {
      kind: 'log';
      fileName: string;
      /** 1-based line number where the entry begins. Display locator. */
      lineNumber: number;
      /** Byte offset where the entry begins. Canonical locator — stable across re-parse. */
      byteOffset: number;
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
    }
  | {
      kind: 'local-folder';
      /** Path relative to `DailyNOC/` or similar root. */
      path: string;
      fileName: string;
    };

export interface Citation {
  id: CitationId;
  /**
   * Render hint (e.g. "log.txt:14382"). UI may re-derive from `source`.
   * Kept in the schema so exports remain human-inspectable.
   */
  displayText: string;
  source: CitationSource;
  createdAt: number;
  /** Last link-health check. Phase 02+ tracking. Optional at persist time. */
  lastVerifiedAt?: number;
}

export type CitationKind = CitationSource['kind'];

export type CitationOf<K extends CitationKind> = Citation & {
  source: Extract<CitationSource, { kind: K }>;
};

/**
 * Runtime-only enrichment of a citation within a live session. Keyed by
 * CitationId. Never persisted. `LogContext` owns this map and invalidates
 * on re-parse.
 */
export interface CitationRuntimeEnrichment {
  /** Session-scoped index into the parsed log array. Regenerated on re-parse. */
  entryId?: number;
  /** Resolved line-number-as-rendered when the UI has wrapped or filtered. */
  resolvedLineNumber?: number;
  /** Whether the target is currently reachable (e.g. log file still loaded). */
  resolvable: boolean;
}

// ─── Investigation ───────────────────────────────────────────────────────

export interface Investigation {
  schemaVersion: InvestigationSchemaVersion;
  id: InvestigationId;
  ticketUrl?: string;
  createdAt: number;
  updatedAt: number;
  blocks: Block[];
  /** Flat pool of citations keyed by CitationId. Blocks reference by ID. */
  citations: Record<CitationId, Citation>;
}

// ─── Evidence ────────────────────────────────────────────────────────────

/**
 * Evidence items are canonical block references + provenance. No new union —
 * `Block` IS the item type.
 *
 * Dedupe invariant: within an `EvidenceSet`, `blockId` is unique. Re-pinning
 * the same block updates `pinnedAt` and re-orders; it never creates a dup.
 * `EvidenceSet.items.length` must equal `new Set(items.map(i => i.blockId)).size`.
 * Enforcement is Phase 01c's reducer responsibility; this type documents the
 * invariant but cannot encode it structurally.
 *
 * Reference resolution: `blockId` is a reference into
 * `Investigation.blocks` where `Investigation.id === investigationId`.
 * EvidenceSets and Investigations form a 1:1 pair inside a .noclense
 * archive.
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
  caseId: CaseId;
  /** Pairs this evidence set with a specific investigation. */
  investigationId: InvestigationId;
  items: EvidenceItem[];
}

// ─── Manifest (orthogonal version from Investigation) ────────────────────

export type ManifestFileRole =
  | 'investigation'
  | 'evidence'
  | 'log'
  | 'attachment'
  | 'ai-transcript';

export interface ManifestFileEntry {
  /** Path inside the `.noclense` ZIP, forward-slashes. */
  path: string;
  role: ManifestFileRole;
  size: number;
  sha256: string;
}

/**
 * Export state — what finished state produced this archive? Used by
 * restore UI to set expectations and by the Res-note fallback.
 */
export type ManifestExportState =
  | 'confirmed' // at least one hypothesis reached CONFIRMED
  | 'draft-no-hypothesis-confirmed' // all hypotheses INCONCLUSIVE
  | 'draft-ruled-out-only' // all hypotheses RULED_OUT, no confirmed
  | 'abandoned'; // user aborted before analysis

export interface NoclenseManifestV1 {
  manifestSchemaVersion: ManifestSchemaVersion;
  createdAt: number;
  app: {
    name: 'NocLense';
    version: string;
  };
  investigation: {
    id: InvestigationId;
    schemaVersion: InvestigationSchemaVersion;
  };
  evidence: {
    caseId: CaseId;
    itemCount: number;
  };
  /**
   * Inventory of every file in the `.noclense` ZIP EXCEPT the manifest
   * itself. The manifest's integrity is covered by the ZIP's CRC32
   * checksum (ZIP local file headers). This avoids the self-referential
   * hash problem of a manifest that describes its own SHA-256.
   */
  files: ManifestFileEntry[];
  exportState: ManifestExportState;
  redaction: {
    applied: boolean;
    rules: string[];
  };
}

// ─── Type guards (narrowing only — see header note) ──────────────────────

/**
 * Narrow a Block to a specific kind. Does NOT validate unknown input —
 * use a runtime validator (Phase 01b) for that.
 */
export function isBlockOfKind<K extends BlockKind>(
  block: Block,
  kind: K,
): block is BlockOf<K> {
  return block.kind === kind;
}

/**
 * Narrow a Citation to a specific source kind. Does NOT validate unknown
 * input — use a runtime validator for that.
 */
export function isCitationOfKind<K extends CitationKind>(
  citation: Citation,
  kind: K,
): citation is CitationOf<K> {
  return citation.source.kind === kind;
}
