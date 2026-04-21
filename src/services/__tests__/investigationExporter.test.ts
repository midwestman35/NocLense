import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildNoclenseZip, CryptoUnavailableError, noclenseFileName } from '../investigationExporter';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../types/canonical';

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

describe('buildNoclenseZip', () => {
  it('produces a ZIP blob containing manifest, investigation, and evidence', async () => {
    const { blob } = await buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0');
    expect(blob.size).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('investigation.json')).not.toBeNull();
    expect(zip.file('evidence.json')).not.toBeNull();
  });

  it('manifest exportState is "abandoned" when no blocks', async () => {
    const { manifest } = await buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0');
    expect(manifest.exportState).toBe('abandoned');
  });

  it('manifest exportState is "confirmed" when analysis block is CONFIRMED', async () => {
    const inv: Investigation = {
      ...baseInvestigation,
      blocks: [
        {
          id: asBlockId('b1'),
          kind: 'analysis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            hypothesisBlockId: asBlockId('h1'),
            statusUpdate: 'CONFIRMED',
            summary: 'Root cause found.',
          },
        },
      ],
    };
    const { manifest } = await buildNoclenseZip(inv, baseEvidenceSet, '2.0.0');
    expect(manifest.exportState).toBe('confirmed');
  });

  it('manifest exportState is "draft-no-hypothesis-confirmed" with only INCONCLUSIVE hypotheses', async () => {
    const inv: Investigation = {
      ...baseInvestigation,
      blocks: [
        {
          id: asBlockId('h1'),
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'H1',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'INCONCLUSIVE',
          },
        },
      ],
    };
    const { manifest } = await buildNoclenseZip(inv, baseEvidenceSet, '2.0.0');
    expect(manifest.exportState).toBe('draft-no-hypothesis-confirmed');
  });

  it('manifest exportState is "draft-ruled-out-only" when every hypothesis is RULED_OUT', async () => {
    const inv: Investigation = {
      ...baseInvestigation,
      blocks: [
        {
          id: asBlockId('h1'),
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'H1',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'RULED_OUT',
          },
        },
        {
          id: asBlockId('h2'),
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 2,
            title: 'H2',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'RULED_OUT',
          },
        },
      ],
    };
    const { manifest } = await buildNoclenseZip(inv, baseEvidenceSet, '2.0.0');
    expect(manifest.exportState).toBe('draft-ruled-out-only');
  });

  it('throws InvestigationMismatchError when evidenceSet.investigationId ≠ investigation.id', async () => {
    const mismatched: EvidenceSet = {
      ...baseEvidenceSet,
      investigationId: asInvestigationId('inv-999'),
    };
    await expect(
      buildNoclenseZip(baseInvestigation, mismatched, '2.0.0'),
    ).rejects.toThrow(/does not match/);
  });

  it('manifest.files contains only investigation + evidence (no self-entry)', async () => {
    const { manifest } = await buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0');
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toContain('investigation.json');
    expect(paths).toContain('evidence.json');
    expect(paths).not.toContain('manifest.json');
    expect(manifest.files).toHaveLength(2);
  });

  it('all inventoried file entries have a 64-char SHA-256 hex', async () => {
    const { manifest } = await buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0');
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('integrity round-trip: manifest hash for investigation.json matches recomputed SHA-256', async () => {
    const { blob, manifest } = await buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0');
    const zip = await JSZip.loadAsync(blob);
    const invFile = zip.file('investigation.json');
    expect(invFile).not.toBeNull();
    const bytes = new Uint8Array(await invFile!.async('arraybuffer'));
    const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
    const recomputed = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const claimed = manifest.files.find((f) => f.path === 'investigation.json')!.sha256;
    expect(recomputed).toBe(claimed);
  });

  it('throws CryptoUnavailableError when crypto.subtle is missing', async () => {
    const subtleDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
    const defineSubtle = (value: SubtleCrypto | undefined): void => {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        configurable: true,
        value,
      });
    };

    try {
      defineSubtle(undefined);
      await expect(
        buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0'),
      ).rejects.toThrow(CryptoUnavailableError);
    } finally {
      if (subtleDescriptor) {
        Object.defineProperty(globalThis.crypto, 'subtle', subtleDescriptor);
      }
    }
  });
});

describe('noclenseFileName', () => {
  it('formats customer name + date', () => {
    const inv: Investigation = {
      ...baseInvestigation,
      blocks: [
        {
          id: asBlockId('ctx'),
          kind: 'context',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: { customer: 'Acme Corp', ticketUrl: undefined },
        },
      ],
    };
    const name = noclenseFileName(inv);
    expect(name).toMatch(/^acme-corp-\d{4}-\d{2}-\d{2}\.noclense$/);
  });

  it('falls back to "investigation" when no context block', () => {
    const name = noclenseFileName(baseInvestigation);
    expect(name).toMatch(/^investigation-\d{4}-\d{2}-\d{2}\.noclense$/);
  });
});
