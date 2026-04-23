/**
 * investigationExporter.ts — builds a .noclense ZIP archive.
 *
 * Produces: manifest.json + investigation.json + evidence.json
 * inside a JSZip blob. Log attachment files are referenced in
 * manifest metadata but not bundled (Phase 03 scope).
 *
 * Manifest integrity is via the ZIP's CRC32 (written by JSZip);
 * the manifest itself is NOT inventoried in `manifest.files` —
 * that would be a self-referential hash.
 *
 * @param investigation  Canonical Investigation to export.
 * @param evidenceSet    Associated EvidenceSet. MUST have
 *                       evidenceSet.investigationId === investigation.id.
 * @param appVersion     Semver string from package.json (caller-supplied).
 * @returns              { blob: Blob; manifest: NoclenseManifestV1 }
 * @throws  InvestigationMismatchError when IDs don't match.
 * @throws  CryptoUnavailableError when crypto.subtle is not available.
 */

import JSZip from 'jszip';
import {
  INVESTIGATION_SCHEMA_VERSION,
  MANIFEST_SCHEMA_VERSION,
  type EvidenceSet,
  type Investigation,
  type ManifestExportState,
  type ManifestFileEntry,
  type NoclenseManifestV1,
} from '../types/canonical';
import { InvestigationMismatchError } from '../types/errors';
export { InvestigationMismatchError };

export class CryptoUnavailableError extends Error {
  constructor() {
    super(
      'Web Crypto API (crypto.subtle) is not available in this runtime. ' +
      '.noclense export requires SHA-256 hashing.',
    );
    this.name = 'CryptoUnavailableError';
  }
}

function assertCryptoAvailable(): void {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.subtle === 'undefined' ||
    typeof crypto.subtle.digest !== 'function'
  ) {
    throw new CryptoUnavailableError();
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function deriveExportState(investigation: Investigation): ManifestExportState {
  const blocks = investigation.blocks;
  const hasConfirmed = blocks.some(
    (b) => b.kind === 'analysis' && b.body.statusUpdate === 'CONFIRMED',
  );
  if (hasConfirmed) return 'confirmed';

  const hypothesisBlocks = blocks.filter((b) => b.kind === 'hypothesis');
  if (hypothesisBlocks.length === 0) return 'abandoned';

  const allRuledOut = hypothesisBlocks.every(
    (b) => b.kind === 'hypothesis' && b.body.status === 'RULED_OUT',
  );
  if (allRuledOut) return 'draft-ruled-out-only';

  return 'draft-no-hypothesis-confirmed';
}

export interface NoclenseExportResult {
  blob: Blob;
  manifest: NoclenseManifestV1;
}

export async function buildNoclenseZip(
  investigation: Investigation,
  evidenceSet: EvidenceSet,
  appVersion: string,
): Promise<NoclenseExportResult> {
  assertCryptoAvailable();

  if (evidenceSet.investigationId !== investigation.id) {
    throw new InvestigationMismatchError(
      investigation.id,
      evidenceSet.investigationId,
    );
  }

  const encoder = new TextEncoder();

  const investigationJson = JSON.stringify(investigation, null, 2);
  const evidenceJson = JSON.stringify(evidenceSet, null, 2);

  const investigationBytes = encoder.encode(investigationJson);
  const evidenceBytes = encoder.encode(evidenceJson);

  const [investigationHash, evidenceHash] = await Promise.all([
    sha256Hex(investigationBytes),
    sha256Hex(evidenceBytes),
  ]);

  const files: ManifestFileEntry[] = [
    {
      path: 'investigation.json',
      role: 'investigation',
      size: investigationBytes.byteLength,
      sha256: investigationHash,
    },
    {
      path: 'evidence.json',
      role: 'evidence',
      size: evidenceBytes.byteLength,
      sha256: evidenceHash,
    },
  ];

  const manifest: NoclenseManifestV1 = {
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    createdAt: Date.now(),
    app: { name: 'NocLense', version: appVersion },
    investigation: {
      id: investigation.id,
      schemaVersion: INVESTIGATION_SCHEMA_VERSION,
    },
    evidence: {
      caseId: evidenceSet.caseId,
      itemCount: evidenceSet.items.length,
    },
    files,
    exportState: deriveExportState(investigation),
    redaction: { applied: false, rules: [] },
  };

  const manifestJson = JSON.stringify(manifest, null, 2);

  const zip = new JSZip();
  zip.file('manifest.json', manifestJson);
  zip.file('investigation.json', investigationJson);
  zip.file('evidence.json', evidenceJson);

  const blob = await zip.generateAsync({ type: 'blob' });

  return { blob, manifest };
}

export function noclenseFileName(investigation: Investigation): string {
  const contextBlock = investigation.blocks.find((b) => b.kind === 'context');
  const customer = contextBlock?.kind === 'context'
    ? contextBlock.body.customer.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    : 'investigation';
  const date = new Date(investigation.createdAt).toISOString().slice(0, 10);
  return `${customer}-${date}.noclense`;
}
