/**
 * noclenseImporter.ts - imports a .noclense ZIP archive.
 *
 * Validates the manifest schema version before reading content.
 * Returns a discriminated union - callers must check `ok` before
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

export type ImportNoclenseResult =
  | { ok: true; investigation: Investigation; evidenceSet: EvidenceSet; manifest: NoclenseManifestV1 }
  | { ok: false; error: string };

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
          'This case pack was created with an older version of NocLense and cannot be imported. ' +
          'Open it in the version of NocLense that created it, or export a new .noclense file.',
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

  return {
    ok: true,
    investigation,
    evidenceSet,
    manifest: manifest as unknown as NoclenseManifestV1,
  };
}
