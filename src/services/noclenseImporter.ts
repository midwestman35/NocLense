/**
 * noclenseImporter.ts - imports a .noclense ZIP archive.
 *
 * Validates the manifest schema version before reading content.
 * Returns a discriminated union. Callers must check `ok` before
 * accessing `investigation` / `evidenceSet`.
 *
 * Phase 03 scope: version check + structural read only.
 * Deep schema validation is canonicalAdapter.ts territory (Phase 01b).
 */

import JSZip from 'jszip';
import { MANIFEST_SCHEMA_VERSION } from '../types/canonical';
import type {
  EvidenceSet,
  Investigation,
  NoclenseManifestV1,
} from '../types/canonical';
import type { Case, Note } from '../types/case';
import { caseLibraryService } from './caseLibraryService';
import { caseRepository } from './caseRepository';

export type ImportNoclenseResult =
  | {
      ok: true;
      investigation: Investigation;
      evidenceSet: EvidenceSet;
      manifest: NoclenseManifestV1;
      importedCase: Case;
    }
  | { ok: false; error: string };

type InvestigationBlock = Investigation['blocks'][number];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripMarkdown(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/[>#*_~-]/g, ' ')
  );
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function isContextBlock(block: InvestigationBlock): block is Extract<InvestigationBlock, { kind: 'context' }> {
  return block.kind === 'context';
}

function isHypothesisBlock(block: InvestigationBlock): block is Extract<InvestigationBlock, { kind: 'hypothesis' }> {
  return block.kind === 'hypothesis';
}

function isNoteBlock(block: InvestigationBlock): block is Extract<InvestigationBlock, { kind: 'note' }> {
  return block.kind === 'note';
}

function extractExternalRef(ticketUrl?: string): string | undefined {
  if (!ticketUrl) {
    return undefined;
  }

  try {
    const pathname = new URL(ticketUrl).pathname;
    const ticketId = pathname.split('/').filter(Boolean).at(-1);
    return ticketId || ticketUrl;
  } catch {
    return ticketUrl;
  }
}

function findLatestBlock<K extends InvestigationBlock['kind']>(
  blocks: InvestigationBlock[],
  kind: K,
): Extract<InvestigationBlock, { kind: K }> | null {
  const matchingBlocks = blocks
    .filter((block): block is Extract<InvestigationBlock, { kind: K }> => block.kind === kind)
    .sort((left, right) => right.updatedAt - left.updatedAt);

  return matchingBlocks[0] ?? null;
}

function buildImportedCaseNotes(caseId: string, investigation: Investigation): Note[] {
  return investigation.blocks
    .filter(isNoteBlock)
    .map((block, index) => ({
      id: `${caseId}_note_${index + 1}`,
      caseId,
      content: stripMarkdown(block.body.markdown),
      timestamp: block.updatedAt,
    }))
    .filter((note) => note.content.length > 0);
}

export function buildImportedCase(
  investigation: Investigation,
  evidenceSet: EvidenceSet,
  manifest: NoclenseManifestV1,
): Case {
  const contextBlock = investigation.blocks.find(isContextBlock) ?? null;
  const hypothesisBlocks = investigation.blocks.filter(isHypothesisBlock);
  const confirmedHypothesis =
    hypothesisBlocks.find((block) => block.body.status === 'CONFIRMED')
    ?? hypothesisBlocks[0]
    ?? null;
  const latestAnalysis = findLatestBlock(investigation.blocks, 'analysis');
  const latestNote = findLatestBlock(investigation.blocks, 'note');
  const fallbackId = `imported_${String(investigation.id)}`;
  const caseId = String(evidenceSet.caseId || fallbackId);
  const customer = contextBlock?.body.customer?.trim();
  const contextSummary = normalizeWhitespace(
    [contextBlock?.body.site, contextBlock?.body.region, contextBlock?.body.cnc]
      .filter(Boolean)
      .join(' / '),
  );
  const supportingTitle = confirmedHypothesis?.body.title || contextSummary || undefined;
  const title = truncate(
    normalizeWhitespace([customer, supportingTitle].filter(Boolean).join(' / ')) || 'Imported investigation',
    120,
  );
  const summary = truncate(
    normalizeWhitespace(
      [
        latestAnalysis?.body.summary,
        confirmedHypothesis?.body.title,
        latestNote ? stripMarkdown(latestNote.body.markdown) : '',
        contextSummary,
      ]
        .filter(Boolean)
        .join(' '),
    ) || 'Imported from a .noclense pack.',
    480,
  );
  const impact = truncate(
    normalizeWhitespace(
      [
        confirmedHypothesis?.body.supportingEvidence,
        confirmedHypothesis?.body.evidenceToConfirm,
        latestAnalysis?.body.summary,
      ]
        .filter(Boolean)
        .join(' '),
    ),
    480,
  );

  return {
    id: caseId,
    title,
    severity: 'medium',
    status: manifest.exportState === 'abandoned' ? 'handoff' : 'resolved',
    externalRef: extractExternalRef(contextBlock?.body.ticketUrl),
    summary,
    impact,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
    attachments: [],
    bookmarks: [],
    notes: buildImportedCaseNotes(caseId, investigation),
    timeWindow: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonFile<T>(zip: JSZip, path: string): Promise<T | null> {
  const file = zip.file(path);
  if (!file) return null;

  const text = await file.async('string');
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function importNoclenseFile(
  file: File,
): Promise<ImportNoclenseResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { ok: false, error: 'The file could not be read as a .noclense archive. It may be corrupted.' };
  }

  const manifest = await readJsonFile<Record<string, unknown>>(zip, 'manifest.json');
  if (!manifest) {
    return { ok: false, error: 'The .noclense archive is missing its manifest. The file may be incomplete or corrupted.' };
  }

  const version = manifest.manifestSchemaVersion;
  if (version !== MANIFEST_SCHEMA_VERSION) {
    if (version === undefined || version === null) {
      return {
        ok: false,
        error:
          'This case pack was created with an older version of NocLense and cannot be imported. '
          + 'Open it in the version of NocLense that created it, or export a new .noclense file.',
      };
    }

    if (typeof version === 'number' && version > MANIFEST_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `This case pack requires NocLense v${version} or newer. Please update the app.`,
      };
    }

    return {
      ok: false,
      error: `Unrecognized manifest version "${String(version)}". The file cannot be imported.`,
    };
  }

  const investigation = await readJsonFile<Investigation>(zip, 'investigation.json');
  if (!investigation || !isRecord(investigation)) {
    return { ok: false, error: 'The .noclense archive contains an unreadable investigation file.' };
  }

  const evidenceSet = await readJsonFile<EvidenceSet>(zip, 'evidence.json');
  if (!evidenceSet || !isRecord(evidenceSet)) {
    return { ok: false, error: 'The .noclense archive contains an unreadable evidence file.' };
  }

  const typedManifest = manifest as unknown as NoclenseManifestV1;
  const importedCase = buildImportedCase(investigation, evidenceSet, typedManifest);

  void caseRepository.saveCase(importedCase)
    .then(() => caseLibraryService.indexCase(importedCase).catch((error) => {
      console.error('indexCase failed', error);
    }))
    .catch((error) => {
      console.error('saveImportedCase failed', error);
    });

  return {
    ok: true,
    investigation,
    evidenceSet,
    manifest: typedManifest,
    importedCase,
  };
}
