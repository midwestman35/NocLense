import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNoclenseZip } from '../investigationExporter';
import { importNoclenseFile } from '../noclenseImporter';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../types/canonical';

const {
  saveCaseMock,
  indexCaseMock,
} = vi.hoisted(() => ({
  saveCaseMock: vi.fn().mockResolvedValue(undefined),
  indexCaseMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../caseRepository', () => ({
  caseRepository: {
    saveCase: saveCaseMock,
  },
}));

vi.mock('../caseLibraryService', () => ({
  caseLibraryService: {
    indexCase: indexCaseMock,
  },
}));

const baseInvestigation: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [],
  citations: {},
};

const baseEvidenceSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [],
};

async function makeZipFile(overrides?: {
  manifest?: unknown;
  investigation?: unknown;
  evidence?: unknown;
}): Promise<File> {
  if (!overrides) {
    const { blob } = await buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0');
    return new File([blob], 'test.noclense', { type: 'application/zip' });
  }
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(overrides.manifest ?? { manifestSchemaVersion: 1 }));
  if (overrides.investigation !== undefined) {
    zip.file('investigation.json', JSON.stringify(overrides.investigation));
  }
  if (overrides.evidence !== undefined) {
    zip.file('evidence.json', JSON.stringify(overrides.evidence));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'test.noclense', { type: 'application/zip' });
}

describe('importNoclenseFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveCaseMock.mockResolvedValue(undefined);
    indexCaseMock.mockResolvedValue(undefined);
  });

  it('imports a valid v1 archive successfully', async () => {
    const file = await makeZipFile();
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.investigation.id).toBe('inv-1');
      expect(result.evidenceSet.caseId).toBe('case-1');
      expect(result.importedCase.id).toBe('case-1');
      expect(result.importedCase.status).toBe('handoff');
    }

    await Promise.resolve();
    await Promise.resolve();

    expect(saveCaseMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'case-1' }));
    expect(indexCaseMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'case-1' }));
  });

  it('returns error for non-ZIP file', async () => {
    const file = new File(['not a zip'], 'bad.noclense');
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/could not be read/i);
  });

  it('returns error when manifest.json is missing', async () => {
    const zip = new JSZip();
    zip.file('investigation.json', '{}');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'test.noclense');
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/missing its manifest/i);
  });

  it('returns graceful error for v0 packs - no manifestSchemaVersion key', async () => {
    const file = await makeZipFile({
      manifest: { schemaVersion: 0 },
      investigation: baseInvestigation,
      evidence: baseEvidenceSet,
    });
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/older version/i);
  });

  it('returns graceful error when manifestSchemaVersion is null', async () => {
    const file = await makeZipFile({
      manifest: { manifestSchemaVersion: null },
      investigation: baseInvestigation,
      evidence: baseEvidenceSet,
    });
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/older version/i);
  });

  it('returns upgrade-required error for future versions', async () => {
    const file = await makeZipFile({
      manifest: { manifestSchemaVersion: 99 },
      investigation: baseInvestigation,
      evidence: baseEvidenceSet,
    });
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/update the app/i);
  });

  it('returns error when investigation.json is missing', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ manifestSchemaVersion: 1 }));
    zip.file('evidence.json', JSON.stringify(baseEvidenceSet));
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'test.noclense');
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/investigation/i);
  });

  it('round-trip preserves branded IDs usable downstream', async () => {
    const exportedFile = await makeZipFile();
    const result = await importNoclenseFile(exportedFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.investigation.id).toBe(baseInvestigation.id);
      expect(result.evidenceSet.investigationId).toBe(baseInvestigation.id);
      const typedInvestigation: Investigation = result.investigation;
      const typedEvidenceSet: EvidenceSet = result.evidenceSet;
      void typedInvestigation;
      void typedEvidenceSet;
    }
  });
});
