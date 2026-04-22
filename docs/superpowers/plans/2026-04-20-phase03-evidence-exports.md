# Phase 03 — Evidence Exports: Implementation Plan

> **For agentic workers:** Read spec §5.1, §5.4, §6.5 in
> `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md`
> and the full `src/types/canonical.ts` before starting.
> Implement task-by-task in commit order. Never chain commits
> without an explicit approval signal between them.

**Goal:** Wire the canonical Investigation + EvidenceSet schemas into
three export surfaces (Res-note text, Jira creation text, `.noclense`
ZIP), implement a ZIP importer with graceful v0 rejection, and replace
the Submit Room stubs with a fully functional two-card layout.

**Spec anchor:** §5.4 (Evidence exports), §5.1 (canonical schema),
§6.5 Phase 03 row.

**Tech stack:** React 19, TypeScript strict, Tailwind 4, `jszip`
(already in `package.json`), `crypto.subtle` for SHA-256, Vitest

---

## Revision v2 — Post-Codex review

This plan has been revised to address Codex's NO-GO findings:

1. **Manifest self-reference resolved** (§A below). `ManifestFileRole`
   drops `'manifest'`; the manifest's `files` inventory now covers
   only the non-manifest entries; the manifest's own integrity is
   verified via the ZIP's CRC32 (already in the ZIP central directory).
2. **Res-note draft path fixed** — `getAnalysisSummaryForHypothesis`
   accepts a hypothesis `BlockId` and returns the analysis tied to
   that hypothesis regardless of `statusUpdate`. Draft branches use
   the top-ranked hypothesis's analysis if one exists.
3. **Commit 4 split** — `.noclense` import wiring now lands in
   `WorkspaceImportPanel.handleFiles()`, not `NewWorkspaceLayout`.
   Commit sequence re-ordered: services → importer → EvidenceContext
   restore action → import-panel wiring → SubmitRoom → layout swap.
4. **Schema amendment** — `src/types/canonical.ts` is touched as a
   Phase 03 companion edit (removes `'manifest'` from the role enum,
   clarifies the comment on `NoclenseManifestV1.files`). This is a
   surgical contract revision, not a Phase 00 redo.
5. **Yellow findings addressed** — `BlockId` typing on helpers,
   investigation-id consistency check in `buildNoclenseZip`,
   `crypto.subtle` feature detection, explicit log-state-on-import
   semantics, added tests for mismatched IDs / draft-ruled-out-only
   / crypto-unavailable / manifest round-trip / draft analysis.

---

## Section A — Manifest integrity model (decision record)

**Problem:** Codex flagged that recording a SHA-256 for `manifest.json`
inside `manifest.json` is a fixpoint problem. You cannot hash the
manifest before finalizing the manifest, because the manifest contains
the hashes. And hashing the manifest after finalizing means the
recorded hash cannot match (writing it changes the bytes).

**Resolution:** Standard package-format pattern — **the manifest
inventories the other files, not itself**. Manifest integrity is
verified by the ZIP's own CRC32 checksum (every ZIP local file header
contains a CRC32 of the file bytes; JSZip computes this on write and
validates on read).

**Schema change required:**

In `src/types/canonical.ts`:

```typescript
// BEFORE
export type ManifestFileRole =
  | 'manifest'
  | 'investigation'
  | 'evidence'
  | 'log'
  | 'attachment'
  | 'ai-transcript';

// AFTER
export type ManifestFileRole =
  | 'investigation'
  | 'evidence'
  | 'log'
  | 'attachment'
  | 'ai-transcript';
```

And the comment on `NoclenseManifestV1.files` updates to:

```typescript
/**
 * Inventory of every file in the `.noclense` ZIP EXCEPT the manifest
 * itself. The manifest's integrity is covered by the ZIP's CRC32
 * checksum (ZIP local file headers). This avoids the self-referential
 * hash problem of a manifest that describes its own SHA-256.
 */
files: ManifestFileEntry[];
```

This schema edit is the first change in Commit 1 below. Existing
canonical-related code that references `ManifestFileRole === 'manifest'`
must be searched and deleted (grep first; probable match count = 0
since v1 export code does not yet exist).

**Verification on import:** The importer does NOT recompute and
compare SHA-256 of `manifest.json`. It trusts the ZIP CRC check that
JSZip performs when `loadAsync` reads the file. For the other files
(`investigation.json`, `evidence.json`), the importer MAY verify
SHA-256 matches the manifest claim — but this is a Phase 04+
enhancement, deferred. Phase 03 imports trust the ZIP CRC end-to-end.

---

## Foundation assumptions (verify before first commit)

These must be true; if any are not, stop and flag:

1. `src/types/canonical.ts` exports `NoclenseManifestV1`,
   `EvidenceSet`, `Investigation`, `ManifestExportState`, and all
   branded ID helpers — **verified in Phase 00**.
2. `jszip` is importable from the renderer process (`"jszip": "^3.10.1"`
   in `package.json` dependencies).
3. `src/services/zipBuilder.ts` exports `buildZip` and `downloadBlob`
   (Phase 00 / pre-existing).
4. `src/contexts/EvidenceContext.tsx` exports `useEvidence()` returning
   `{ investigation, evidenceSet, ... }`.
5. `src/components/workspace/NewWorkspaceLayout.tsx` already has
   placeholder `submitContent` passed to `RoomRouter`.

---

## File map

### New files
```
src/services/investigationExporter.ts
src/services/resNoteBuilder.ts
src/services/jiraTemplateBuilder.ts
src/services/noclenseImporter.ts
src/components/workspace/SubmitRoom.tsx

src/services/__tests__/investigationExporter.test.ts
src/services/__tests__/resNoteBuilder.test.ts
src/services/__tests__/jiraTemplateBuilder.test.ts
src/services/__tests__/noclenseImporter.test.ts
src/components/workspace/__tests__/SubmitRoom.test.tsx
```

### Modified files
```
src/components/workspace/NewWorkspaceLayout.tsx   (wire SubmitRoom + import)
```

---

## Commit 1 — Schema amendment + export service layer

**Files modified:** `src/types/canonical.ts` (schema amendment per §A above).

**Files created:** `investigationExporter.ts`, `resNoteBuilder.ts`,
`jiraTemplateBuilder.ts`, and their test files.

---

### Task 1a: Amend `canonical.ts` (manifest role enum)

- [ ] **Step 0 (schema amendment — MUST be first)**

Grep first for any existing consumer of `'manifest'` role:

```bash
git grep -n "'manifest'" src/types/canonical.ts src/services src/components
```

Expected: only references inside `canonical.ts` itself (the enum
definition). Phase 00 landed the type but no production consumer
has been written yet.

Then edit `src/types/canonical.ts`:

- Remove `| 'manifest'` from the `ManifestFileRole` union.
- Update the JSDoc comment on `NoclenseManifestV1.files` to the text
  specified in §A above.
- Leave every other type in the file unchanged.

---

### Task 1b: `investigationExporter.ts`

**Purpose:** Builds a `.noclense` ZIP archive from an `Investigation` +
`EvidenceSet`. Uses `jszip` (already installed). Returns a `Blob` ready
for `downloadBlob()`.

**ZIP contents:**
```
manifest.json       (integrity via ZIP CRC32; not self-inventoried)
investigation.json  (role: investigation)
evidence.json       (role: evidence)
```

Log attachment files are NOT bundled — too large (can be 200 MB+).
Attachment metadata (fileName, size) comes from `Investigation`
context blocks but no file data is embedded in Phase 03.

**SHA-256:** Computed with `crypto.subtle.digest('SHA-256', bytes)` for
investigation.json and evidence.json only. Manifest integrity is via
ZIP CRC. `buildNoclenseZip` is `async`.

**Feature detection:** `crypto.subtle` is standard in Electron renderer
as of the Chromium version shipped with Electron 40. The builder still
explicitly guards and throws a typed error if unavailable so the UI
can show a meaningful message rather than a stack trace.

**Investigation-id consistency:** Phase 03 enforces that the supplied
`evidenceSet.investigationId === investigation.id`. Mismatch throws
`InvestigationMismatchError` (typed error subclass). Callers are
responsible for handing in a coherent pair — the EvidenceContext
already rebuilds the set whenever the investigation changes, so this
should never fire in normal UI flow.

**`exportState` derivation logic:**
```
If any analysis block has statusUpdate === 'CONFIRMED'  → 'confirmed'
Else if there are hypothesis blocks AND all hypothesis blocks have
    status === 'RULED_OUT'                              → 'draft-ruled-out-only'
Else if there are any hypothesis blocks                 → 'draft-no-hypothesis-confirmed'
Else                                                    → 'abandoned'
```

- [ ] **Step 1: Create the file**

```typescript
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

// ─── Typed errors ────────────────────────────────────────────────────────────

export class InvestigationMismatchError extends Error {
  constructor(investigationId: string, evidenceInvestigationId: string) {
    super(
      `EvidenceSet.investigationId (${evidenceInvestigationId}) does not match ` +
      `Investigation.id (${investigationId}). Refusing to export a mismatched pair.`
    );
    this.name = 'InvestigationMismatchError';
  }
}

export class CryptoUnavailableError extends Error {
  constructor() {
    super(
      'Web Crypto API (crypto.subtle) is not available in this runtime. ' +
      '.noclense export requires SHA-256 hashing.'
    );
    this.name = 'CryptoUnavailableError';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function deriveExportState(investigation: Investigation): ManifestExportState {
  const blocks = investigation.blocks;
  const hasConfirmed = blocks.some(
    (b) => b.kind === 'analysis' && b.body.statusUpdate === 'CONFIRMED'
  );
  if (hasConfirmed) return 'confirmed';

  const hypothesisBlocks = blocks.filter((b) => b.kind === 'hypothesis');
  if (hypothesisBlocks.length === 0) return 'abandoned';

  const allRuledOut = hypothesisBlocks.every(
    (b) => b.kind === 'hypothesis' && b.body.status === 'RULED_OUT'
  );
  if (allRuledOut) return 'draft-ruled-out-only';

  return 'draft-no-hypothesis-confirmed';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NoclenseExportResult {
  blob: Blob;
  manifest: NoclenseManifestV1;
}

export async function buildNoclenseZip(
  investigation: Investigation,
  evidenceSet: EvidenceSet,
  appVersion: string
): Promise<NoclenseExportResult> {
  assertCryptoAvailable();

  // Contract: EvidenceSet must match its Investigation.
  if (evidenceSet.investigationId !== investigation.id) {
    throw new InvestigationMismatchError(
      investigation.id,
      evidenceSet.investigationId
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

  // NB: manifest.files inventories only NON-manifest files. Manifest
  // integrity is covered by ZIP CRC32 (see plan §A).
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
```

- [ ] **Step 2: Write tests**

```typescript
// src/services/__tests__/investigationExporter.test.ts
import { describe, expect, it } from 'vitest';
import { buildNoclenseZip, noclenseFileName } from '../investigationExporter';
import JSZip from 'jszip';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type Investigation,
  type EvidenceSet,
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
      buildNoclenseZip(baseInvestigation, mismatched, '2.0.0')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalSubtle = (globalThis.crypto as any).subtle;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis.crypto as any).subtle = undefined;
      await expect(
        buildNoclenseZip(baseInvestigation, baseEvidenceSet, '2.0.0')
      ).rejects.toThrow(/crypto\.subtle/);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis.crypto as any).subtle = originalSubtle;
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
```

---

### Task 1b: `resNoteBuilder.ts`

**Purpose:** Generates a `Res-note.txt` string from `Investigation +
EvidenceSet`. The Res-note format matches the DailyNOC workflow:
Issue summary / Root cause / Resolution / Linked Jira / Customer action
/ Status.

**Fallback rule (spec §5.4):** If no hypothesis reaches CONFIRMED, use
the top-ranked hypothesis (rank 1) and prepend `[DRAFT — unconfirmed]`
to the header.

- [ ] **Step 3: Create the file**

```typescript
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getContextBlock(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'context' } => b.kind === 'context'
  );
}

function getConfirmedHypothesis(investigation: Investigation) {
  const analyses = investigation.blocks.filter(
    (b): b is Block & { kind: 'analysis' } =>
      b.kind === 'analysis' && b.body.statusUpdate === 'CONFIRMED'
  );
  if (analyses.length === 0) return null;
  const firstAnalysis = analyses[0];
  return investigation.blocks.find(
    (b): b is Block & { kind: 'hypothesis' } =>
      b.kind === 'hypothesis' && b.id === firstAnalysis.body.hypothesisBlockId
  ) ?? null;
}

function getTopHypothesis(investigation: Investigation) {
  const hypotheses = investigation.blocks.filter(
    (b): b is Block & { kind: 'hypothesis' } => b.kind === 'hypothesis'
  );
  return hypotheses.sort((a, b) => a.body.rank - b.body.rank)[0] ?? null;
}

/**
 * Find the analysis block linked to a given hypothesis, regardless of
 * its statusUpdate. Draft Res-notes use this so that a draft/inconclusive
 * report still surfaces the engineer's running analysis rather than
 * dropping it on the floor. Spec §5.4 fallback explicitly requires this.
 */
function getAnalysisSummaryForHypothesis(
  investigation: Investigation,
  hypothesisId: BlockId
): string | null {
  const match = investigation.blocks.find(
    (b): b is Block & { kind: 'analysis' } =>
      b.kind === 'analysis' && b.body.hypothesisBlockId === hypothesisId
  );
  return match?.body.summary ?? null;
}

function getActionBlock(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'action' } => b.kind === 'action'
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

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildResNote(
  investigation: Investigation,
  evidenceSet: EvidenceSet
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

  // Resolution line:
  //   - Confirmed path:  analysis tied to the confirmed hypothesis.
  //   - Draft path:      analysis tied to the top-ranked hypothesis
  //                      regardless of its statusUpdate (§5.4 fallback).
  //   - No hypothesis:   "(investigation incomplete)".
  let resolutionSummary = '(investigation incomplete)';
  if (activeHypothesis) {
    const analysisSummary = getAnalysisSummaryForHypothesis(
      investigation,
      activeHypothesis.id
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
```

- [ ] **Step 4: Write tests**

```typescript
// src/services/__tests__/resNoteBuilder.test.ts
import { describe, expect, it } from 'vitest';
import { buildResNote } from '../resNoteBuilder';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../types/canonical';

const evidenceSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [],
};

const emptyInvestigation: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [],
  citations: {},
};

describe('buildResNote', () => {
  it('marks isDraft=true when no CONFIRMED analysis', () => {
    const { isDraft } = buildResNote(emptyInvestigation, evidenceSet);
    expect(isDraft).toBe(true);
  });

  it('prepends [DRAFT] header when isDraft', () => {
    const { text } = buildResNote(emptyInvestigation, evidenceSet);
    expect(text).toMatch(/^\[DRAFT/);
  });

  it('fills customer from context block', () => {
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: asBlockId('ctx'),
          kind: 'context',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: { customer: 'Acme Corp' },
        },
      ],
    };
    const { text } = buildResNote(inv, evidenceSet);
    expect(text).toContain('Acme Corp');
  });

  it('isDraft=false when analysis block has CONFIRMED status', () => {
    const hId = asBlockId('h1');
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: hId,
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'Registration storm',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'CONFIRMED',
          },
        },
        {
          id: asBlockId('a1'),
          kind: 'analysis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            hypothesisBlockId: hId,
            statusUpdate: 'CONFIRMED',
            summary: 'Platform restage resolved the storm.',
          },
        },
      ],
    };
    const { isDraft, text } = buildResNote(inv, evidenceSet);
    expect(isDraft).toBe(false);
    expect(text).not.toMatch(/^\[DRAFT/);
    expect(text).toContain('Registration storm');
    expect(text).toContain('Platform restage resolved');
  });

  it('includes evidence item count', () => {
    const setWith3: EvidenceSet = {
      ...evidenceSet,
      items: [
        { blockId: asBlockId('b1'), pinnedAt: 1, pinnedBy: 'user', order: 0 },
        { blockId: asBlockId('b2'), pinnedAt: 2, pinnedBy: 'ai', order: 1 },
        { blockId: asBlockId('b3'), pinnedAt: 3, pinnedBy: 'user', order: 2 },
      ],
    };
    const { text } = buildResNote(emptyInvestigation, setWith3);
    expect(text).toContain('Evidence Items: 3');
  });

  it('draft path surfaces analysis summary for top hypothesis even when not CONFIRMED', () => {
    // Regression test for Codex plan review finding (draft branch dropped analysis).
    const hId = asBlockId('h1');
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: hId,
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'Candidate: storm on registration socket',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'INCONCLUSIVE',
          },
        },
        {
          id: asBlockId('a1'),
          kind: 'analysis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            hypothesisBlockId: hId,
            statusUpdate: 'INCONCLUSIVE',
            summary: 'Observed 12 reconnect cycles/min; root cause unverified.',
          },
        },
      ],
    };
    const { isDraft, text } = buildResNote(inv, evidenceSet);
    expect(isDraft).toBe(true);
    expect(text).toContain('Observed 12 reconnect cycles');
    expect(text).not.toContain('(no analysis recorded)');
    expect(text).not.toContain('(analysis pending');
  });

  it('draft path with no analysis shows "analysis pending" marker', () => {
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: asBlockId('h1'),
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'Placeholder',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'INCONCLUSIVE',
          },
        },
      ],
    };
    const { text } = buildResNote(inv, evidenceSet);
    expect(text).toContain('(analysis pending for top hypothesis)');
  });
});
```

---

### Task 1c: `jiraTemplateBuilder.ts`

**Purpose:** Generates a Jira creation template from `Investigation`.
Returns structured fields (not a single string) so the Submit Room UI
can display them separately and copy them individually.

- [ ] **Step 5: Create the file**

```typescript
/**
 * jiraTemplateBuilder.ts — generates Jira issue creation template
 * from canonical Investigation data.
 *
 * Returns structured fields that the Submit Room can display and
 * copy individually or as a pre-formatted text block.
 *
 * @param investigation  Canonical Investigation.
 * @returns JiraTemplate with summary, description, priority, labels.
 */

import type { Investigation, Block } from '../types/canonical';

export interface JiraTemplate {
  summary: string;
  description: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  labels: string[];
  /** Pre-formatted text for one-click copy. */
  formatted: string;
}

function getContext(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'context' } => b.kind === 'context'
  );
}

function getTopHypothesis(investigation: Investigation) {
  return investigation.blocks
    .filter((b): b is Block & { kind: 'hypothesis' } => b.kind === 'hypothesis')
    .sort((a, b) => a.body.rank - b.body.rank)[0] ?? null;
}

function getActionBlock(investigation: Investigation) {
  return investigation.blocks.find(
    (b): b is Block & { kind: 'action' } => b.kind === 'action'
  );
}

function derivePriority(investigation: Investigation): JiraTemplate['priority'] {
  const action = getActionBlock(investigation);
  if (action?.body.payload.kind === 'jira' && action.body.payload.priority) {
    return action.body.payload.priority;
  }
  // Fallback: check if any ERROR-level evidence exists
  const hasHighSignal = investigation.blocks.some(
    (b) => b.kind === 'hypothesis' && b.body.rank === 1 && b.body.status === 'CONFIRMED'
  );
  return hasHighSignal ? 'High' : 'Normal';
}

function deriveLabels(investigation: Investigation): string[] {
  const context = getContext(investigation);
  const labels: string[] = ['noclense-export'];
  if (context?.body.site) labels.push(`site:${context.body.site}`);
  if (context?.body.cnc) labels.push(`cnc:${context.body.cnc}`);
  if (context?.body.region) labels.push(`region:${context.body.region}`);
  return labels;
}

export function buildJiraTemplate(investigation: Investigation): JiraTemplate {
  const context = getContext(investigation);
  const topHypothesis = getTopHypothesis(investigation);
  const action = getActionBlock(investigation);

  const customer = context?.body.customer ?? '(unknown)';
  const ticketRef = context?.body.ticketUrl
    ? ` [${context.body.ticketUrl}]`
    : '';
  const rootCause = topHypothesis?.body.title ?? 'Root cause TBD';

  const summary = action?.body.payload.kind === 'jira'
    ? action.body.payload.summary
    : `${customer} — ${rootCause}`;

  const descriptionLines: string[] = [
    `*Customer:* ${customer}${ticketRef}`,
    '',
    `*Root Cause:* ${rootCause}`,
    '',
    `*Supporting Evidence:* ${topHypothesis?.body.supportingEvidence ?? 'See attached investigation.'}`,
    '',
    `*Evidence to Confirm:* ${topHypothesis?.body.evidenceToConfirm ?? 'N/A'}`,
    '',
    `*Recommended Action:* ${action?.body.summary ?? 'See attached investigation.'}`,
    '',
    '_Exported from NocLense. See attached .noclense file for full investigation._',
  ];

  const description = action?.body.payload.kind === 'jira'
    ? action.body.payload.description
    : descriptionLines.join('\n');

  const priority = derivePriority(investigation);
  const labels = deriveLabels(investigation);

  const formatted = [
    `Summary: ${summary}`,
    `Priority: ${priority}`,
    `Labels: ${labels.join(', ')}`,
    '',
    'Description:',
    description,
  ].join('\n');

  return { summary, description, priority, labels, formatted };
}
```

- [ ] **Step 6: Write tests**

```typescript
// src/services/__tests__/jiraTemplateBuilder.test.ts
import { describe, expect, it } from 'vitest';
import { buildJiraTemplate } from '../jiraTemplateBuilder';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asInvestigationId,
  type Investigation,
} from '../../types/canonical';

const base: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [],
  citations: {},
};

describe('buildJiraTemplate', () => {
  it('returns a formatted string', () => {
    const { formatted } = buildJiraTemplate(base);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('uses action block summary when action kind is jira', () => {
    const inv: Investigation = {
      ...base,
      blocks: [
        {
          id: asBlockId('a1'),
          kind: 'action',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            summary: 'Escalate to R&D',
            payload: {
              kind: 'jira',
              projectKey: 'REP',
              summary: 'Registration storm — APEX 9.2',
              description: 'Full investigation in attached file.',
              priority: 'High',
            },
          },
        },
      ],
    };
    const { summary, priority } = buildJiraTemplate(inv);
    expect(summary).toBe('Registration storm — APEX 9.2');
    expect(priority).toBe('High');
  });

  it('includes noclense-export label always', () => {
    const { labels } = buildJiraTemplate(base);
    expect(labels).toContain('noclense-export');
  });

  it('adds site label when context block has site', () => {
    const inv: Investigation = {
      ...base,
      blocks: [
        {
          id: asBlockId('ctx'),
          kind: 'context',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: { customer: 'Carbyne', site: 'MACC-01' },
        },
      ],
    };
    const { labels } = buildJiraTemplate(inv);
    expect(labels).toContain('site:MACC-01');
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add \
  src/services/investigationExporter.ts \
  src/services/resNoteBuilder.ts \
  src/services/jiraTemplateBuilder.ts \
  src/services/__tests__/investigationExporter.test.ts \
  src/services/__tests__/resNoteBuilder.test.ts \
  src/services/__tests__/jiraTemplateBuilder.test.ts
git commit -m "feat(phase-03): add export service layer — investigationExporter, resNoteBuilder, jiraTemplateBuilder"
```

---

## Commit 2 — `.noclense` importer

**Files:** `noclenseImporter.ts` + test.

**Uses `jszip`** for ZIP reading (already installed). No custom ZIP
parsing needed.

**Validation strategy:**
1. Load ZIP with `JSZip.loadAsync(file)`.
2. Confirm `manifest.json` exists. If missing → error.
3. Parse `manifest.json`. If `manifestSchemaVersion !== 1` → graceful
   rejection with user-visible message (not a throw).
4. If v1: read and parse `investigation.json` + `evidence.json`.
   Return `{ ok: true; investigation; evidenceSet }`.
5. For unknown/future versions: return `{ ok: false; error: ... }`.

**No deep structural validation in Phase 03.** Shape validation of
the parsed JSON blobs is Phase 01b's `canonicalAdapter.ts` territory.
Phase 03 only validates: ZIP readable, manifest present, version known.

---

### Task 2a: `noclenseImporter.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * noclenseImporter.ts — imports a .noclense ZIP archive.
 *
 * Validates the manifest schema version before reading content.
 * Returns a discriminated union — callers must check `ok` before
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
  file: File
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

  const version = manifest['manifestSchemaVersion'];
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
```

- [ ] **Step 2: Write tests**

```typescript
// src/services/__tests__/noclenseImporter.test.ts
import { describe, expect, it } from 'vitest';
import { importNoclenseFile } from '../noclenseImporter';
import { buildNoclenseZip } from '../investigationExporter';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../types/canonical';
import JSZip from 'jszip';

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
  it('imports a valid v1 archive successfully', async () => {
    const file = await makeZipFile();
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.investigation.id).toBe('inv-1');
      expect(result.evidenceSet.caseId).toBe('case-1');
    }
  });

  it('returns error for non-ZIP file', async () => {
    const file = new File(['not a zip'], 'bad.noclense');
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be read/i);
  });

  it('returns error when manifest.json is missing', async () => {
    const zip = new JSZip();
    zip.file('investigation.json', '{}');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'test.noclense');
    const result = await importNoclenseFile(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing its manifest/i);
  });

  it('returns graceful error for v0 packs — no manifestSchemaVersion key', async () => {
    const file = await makeZipFile({
      // Pre-v1 packs used { schemaVersion: 0 } on the top-level manifest.
      // The v1 importer looks for manifestSchemaVersion specifically, so
      // v0 packs land in the "missing version" branch.
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
    // Verifies that the importer returns objects the rest of the app can
    // use without re-casting. IDs come back as the canonical branded
    // types (via declared-type casts at the import boundary).
    const exportedFile = await makeZipFile();
    const result = await importNoclenseFile(exportedFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.investigation.id).toBe(baseInvestigation.id);
      expect(result.evidenceSet.investigationId).toBe(baseInvestigation.id);
      // Shape smoke test: the objects satisfy their declared types.
      const _typed: Investigation = result.investigation;
      const _typed2: EvidenceSet = result.evidenceSet;
      void _typed; void _typed2;
    }
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add \
  src/services/noclenseImporter.ts \
  src/services/__tests__/noclenseImporter.test.ts
git commit -m "feat(phase-03): add .noclense importer with v1 validation and graceful v0 rejection"
```

---

## Commit 3 — `EvidenceContext.restoreEvidenceSet` action

**File:** `src/contexts/EvidenceContext.tsx` (modified only).

**Why a dedicated commit:** Commit 4 (WorkspaceImportPanel wiring)
depends on this action existing. Keeping it on its own commit makes
the diff reviewable independently of the UI plumbing.

**Scope:** Add a `restoreEvidenceSet(set: EvidenceSet)` action to the
EvidenceContext value. It bypasses the auto-rebuild that
`setInvestigation()` performs and directly installs the supplied set.

**Case-state non-sync note:** Phase 03 import does NOT synchronize
`useCase()` state. The restored `EvidenceSet.caseId` is preserved but
no new `Case` record is created and no active case is set. Rationale:
the case library work is deferred to Phase 06 (spec §6.3); Phase 03
keeps the import semantics minimal. A followup note in the Submit Room
empty state directs the engineer to pin items from the loaded
investigation if they want case-level integration.

- [ ] **Step 1: Extend the context interface + provider**

Open `src/contexts/EvidenceContext.tsx`. In `EvidenceContextValue`,
add:

```typescript
restoreEvidenceSet: (set: EvidenceSet) => void;
```

In `EvidenceProvider`, add:

```typescript
const restoreEvidenceSet = useCallback((set: EvidenceSet) => {
  commitEvidenceSet(set);
}, [commitEvidenceSet]);
```

And include `restoreEvidenceSet` in the returned `value` object.

- [ ] **Step 2: Add a unit test** (extend existing
      `src/contexts/__tests__/EvidenceContext.test.tsx` if present, or
      create a focused test in the import-panel test file).

Test: after calling `setInvestigation(inv)`, calling
`restoreEvidenceSet(customSet)` replaces the auto-built empty set with
`customSet`; items in `customSet` are visible via `evidenceSet.items`.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/EvidenceContext.tsx \
        src/contexts/__tests__/EvidenceContext.test.tsx
git commit -m "feat(phase-03): add EvidenceContext.restoreEvidenceSet for .noclense import"
```

---

## Commit 4 — Wire `.noclense` import into `WorkspaceImportPanel`

**File:** `src/components/import/WorkspaceImportPanel.tsx` (modified).

**Why this is the correct seam (Codex finding):** The actual file
drop and parse flow lives in `WorkspaceImportPanel.handleFiles()`
around line 108. `NewWorkspaceLayout` only renders the Submit Room
placeholder; it does not own the file intake. Wiring `.noclense`
import anywhere else would leave the drop zone unreachable.

**Integration points inside `handleFiles`:**

1. **Extension branch before parse** — if `files.length === 1` and
   `files[0].name.endsWith('.noclense')`, route to the new import flow.
   Mixing `.noclense` with regular log files in a single drop is
   unsupported — show a toast error "Drop .noclense files alone" and
   return.
2. **Log state on import** — when a `.noclense` file is accepted:
   - Clear the existing logs context (matches "load a different case"
     semantics). The imported `.noclense` has NO bundled logs, so any
     existing logs would be misleading. Use the existing
     `clearLogs()` / equivalent action in `LogContext`.
   - Call `setInvestigation(result.investigation)`.
   - Call `restoreEvidenceSet(result.evidenceSet)`.
   - Show a success toast: "Investigation imported."
   - Navigate to the Investigate phase via the existing
     `onInvestigationReady` / `onComplete` callback (whichever one
     `WorkspaceImportPanel` already uses for regular file imports).
3. **Accept attribute** — extend the existing `accept` attribute on
   the file input from `.log,.txt,.csv` to
   `.log,.txt,.csv,.noclense`.

- [ ] **Step 1: Read the current `handleFiles` and its surroundings**

Before editing, the implementor must:
- Read `src/components/import/WorkspaceImportPanel.tsx` in full.
- Identify the actual "clear logs" primitive in scope (it may be on
  `useLogContext()` or passed in as a prop).
- Identify which callback fires on successful import (`onComplete` or
  `onInvestigationReady` — use the one that navigates to Investigate).

If the "clear logs" primitive does not exist at component scope, stop
and flag. Phase 03 does not invent new LogContext actions — that's
Phase 04 scope. As a fallback, skip the clear step and note in the
toast: "Logs from the previous session remain loaded."

- [ ] **Step 2: Add the `.noclense` branch**

Top of file:

```typescript
import { importNoclenseFile } from '../../services/noclenseImporter';
import { useEvidence } from '../../contexts/EvidenceContext';
```

Inside the component body (near other context hooks):

```typescript
const { setInvestigation, restoreEvidenceSet } = useEvidence();
```

Inside `handleFiles`, before the existing logic:

```typescript
// .noclense pack import — early-return branch
const firstFile = fileList.length > 0 ? fileList.item(0) : null;
if (firstFile && firstFile.name.toLowerCase().endsWith('.noclense')) {
  if (fileList.length > 1) {
    setError('Drop .noclense files alone — do not mix with log files.');
    toast('Drop .noclense files alone', { variant: 'error' });
    return;
  }
  setLoading(true);
  try {
    const result = await importNoclenseFile(firstFile);
    if (!result.ok) {
      setError(result.error);
      toast(result.error, { variant: 'error' });
      return;
    }
    setInvestigation(result.investigation);
    restoreEvidenceSet(result.evidenceSet);
    toast('Investigation imported.', { variant: 'success' });
    // Use whichever navigation callback this panel already invokes on
    // successful import — consult the existing code path.
    onComplete?.();
  } finally {
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }
  return;
}
```

- [ ] **Step 3: Extend the `accept` attribute**

Change:

```tsx
accept=".log,.txt,.csv"
```
to:
```tsx
accept=".log,.txt,.csv,.noclense"
```

- [ ] **Step 4: Tests**

Extend `src/components/import/__tests__/WorkspaceImportPanel.test.tsx`
(or create it if it does not exist). Cases:

1. Dropping a valid `.noclense` file calls `setInvestigation` and
   `restoreEvidenceSet` with the parsed objects.
2. Dropping a corrupted `.noclense` file shows a toast error and does
   NOT call `setInvestigation`.
3. Dropping `.noclense` + `.log` together shows "Drop .noclense files
   alone" error.
4. Dropping a v0 (no `manifestSchemaVersion`) `.noclense` shows the
   graceful error toast.

Mock `importNoclenseFile` rather than building real ZIPs in the
component test — the importer itself is unit-tested separately.

- [ ] **Step 5: Commit**

```bash
git add src/components/import/WorkspaceImportPanel.tsx \
        src/components/import/__tests__/WorkspaceImportPanel.test.tsx
git commit -m "feat(phase-03): import .noclense files in WorkspaceImportPanel drop zone"
```

---

## Commit 5 — Submit Room component

**File:** `src/components/workspace/SubmitRoom.tsx` + test.

**Layout (spec §6.1):** Two centered cards side-by-side in the Submit
Room's `flex items-start justify-center gap-6 p-10` container.

| Card | Width | Content |
|---|---|---|
| Closure Note | 420px | Editable res-note textarea, pre-filled; Copy to Zendesk button; Export `.noclense` button |
| Evidence Summary | 320px | Pinned item count; Jira template copy button; list of top 5 pinned items |

**State wiring:**
- `useEvidence()` → `investigation`, `evidenceSet`
- `useMemo` on `buildResNote(investigation, evidenceSet)` (cheap)
- `useMemo` on `buildJiraTemplate(investigation)` (cheap)
- `buildNoclenseZip` is async — use `useCallback` + local loading state

**Draft indicator:** If `isDraft === true`, show a muted amber chip
"Draft" above the textarea using `Badge variant="outline"`.

**Copy-to-Zendesk:** Uses `navigator.clipboard.writeText(text)`.
Shows a ✓ Toast on success. Does NOT actually POST to Zendesk (that's
Phase 04+ work). The button label is "Copy for Zendesk".

**Export `.noclense`:** Calls `buildNoclenseZip` + `downloadBlob`.
During export, the button shows a loading state (braille spinner +
"exporting…" label). On error, shows inline error text.

**Accessibility:**
- `role="status"` on the draft indicator
- The textarea has a visible label
- Buttons have accessible names

---

### Task 3a: `SubmitRoom.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * SubmitRoom.tsx — Submit phase two-card layout.
 *
 * Cards:
 *  - Closure Note: editable res-note pre-filled from Investigation.
 *    Copy-for-Zendesk and Export-.noclense actions.
 *  - Evidence Summary: pinned item count + top items + Jira copy.
 *
 * Uses useEvidence() for all data; no prop drilling.
 * buildNoclenseZip is async so export uses local loading state.
 */

import {
  useCallback,
  useMemo,
  useState,
  type JSX,
  type ChangeEvent,
} from 'react';
import { Download, FileText, Bookmark, Copy, Check } from 'lucide-react';
import { WorkspaceCard } from './WorkspaceCard';
import Button from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useEvidence } from '../../contexts/EvidenceContext';
import { buildResNote } from '../../services/resNoteBuilder';
import { buildJiraTemplate } from '../../services/jiraTemplateBuilder';
import { buildNoclenseZip, noclenseFileName } from '../../services/investigationExporter';
import { downloadBlob } from '../../services/zipBuilder';

const APP_VERSION = '2.0.0';
const MAX_EVIDENCE_PREVIEW = 5;

// ─── Closure Note card ───────────────────────────────────────────────────────

interface ClosureNoteCardProps {
  text: string;
  isDraft: boolean;
  onTextChange: (next: string) => void;
  onExport: () => Promise<void>;
  exportLoading: boolean;
  exportError: string | null;
}

function ClosureNoteCard({
  text,
  isDraft,
  onTextChange,
  onExport,
  exportLoading,
  exportError,
}: ClosureNoteCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <WorkspaceCard
      id="closure-note"
      title="Closure Note"
      icon={<FileText size={14} />}
      accentColor="#76ce40"
      className="w-[420px]"
    >
      <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
        {isDraft && (
          <div role="status" aria-label="Closure note is a draft">
            <Badge variant="outline" className="text-amber-500 border-amber-500/40">
              Draft — no confirmed hypothesis
            </Badge>
          </div>
        )}

        <label htmlFor="closure-note-textarea" className="text-[var(--text-xs)] text-[var(--muted-foreground)]">
          Edit before posting to Zendesk
        </label>
        <textarea
          id="closure-note-textarea"
          value={text}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onTextChange(event.target.value)}
          className="min-h-[180px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)] p-[var(--space-3)] font-mono text-[var(--text-xs)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          spellCheck={false}
        />

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleCopy()}
          className="w-full"
          aria-label="Copy closure note to clipboard for Zendesk"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-[var(--space-2)]">{copied ? 'Copied!' : 'Copy for Zendesk'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onExport()}
          disabled={exportLoading}
          className="w-full"
          aria-label="Export investigation as .noclense file"
        >
          <Download size={14} />
          <span className="ml-[var(--space-2)]">
            {exportLoading ? '⣾ exporting…' : 'Export .noclense'}
          </span>
        </Button>

        {exportError && (
          <p role="alert" className="text-[var(--text-xs)] text-[var(--destructive)]">
            {exportError}
          </p>
        )}
      </div>
    </WorkspaceCard>
  );
}

// ─── Evidence Summary card ───────────────────────────────────────────────────

interface EvidenceSummaryCardProps {
  itemCount: number;
  previewItems: { label: string; kind: string }[];
  jiraFormatted: string;
}

function EvidenceSummaryCard({
  itemCount,
  previewItems,
  jiraFormatted,
}: EvidenceSummaryCardProps): JSX.Element {
  const [copiedJira, setCopiedJira] = useState(false);

  async function handleCopyJira(): Promise<void> {
    await navigator.clipboard.writeText(jiraFormatted);
    setCopiedJira(true);
    setTimeout(() => setCopiedJira(false), 2000);
  }

  return (
    <WorkspaceCard
      id="evidence-summary"
      title="Evidence Summary"
      icon={<Bookmark size={14} />}
      accentColor="#f59e0b"
      className="w-[320px]"
    >
      <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
        <p className="text-[var(--text-sm)] text-[var(--foreground)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''} pinned
        </p>

        {itemCount === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--muted-foreground)]" style={{ textWrap: 'pretty' }}>
            Pin evidence blocks from the AI Assistant with <kbd>Ctrl+Shift+P</kbd>.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-1)]" aria-label="Pinned evidence items">
            {previewItems.map((item, index) => (
              <li key={index} className="flex items-center gap-[var(--space-2)] text-[var(--text-xs)]">
                <Badge variant="outline">{item.kind}</Badge>
                <span className="min-w-0 truncate text-[var(--muted-foreground)]">{item.label}</span>
              </li>
            ))}
            {itemCount > MAX_EVIDENCE_PREVIEW && (
              <li className="text-[var(--text-xs)] text-[var(--muted-foreground)]">
                +{itemCount - MAX_EVIDENCE_PREVIEW} more
              </li>
            )}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopyJira()}
          className="w-full"
          aria-label="Copy Jira creation template to clipboard"
        >
          {copiedJira ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-[var(--space-2)]">{copiedJira ? 'Copied!' : 'Copy Jira Template'}</span>
        </Button>
      </div>
    </WorkspaceCard>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export function SubmitRoom(): JSX.Element {
  const { investigation, evidenceSet } = useEvidence();

  const { text: initialResNote, isDraft } = useMemo(
    () =>
      investigation && evidenceSet
        ? buildResNote(investigation, evidenceSet)
        : { text: '', isDraft: true },
    [investigation, evidenceSet]
  );

  const [editedNote, setEditedNote] = useState<string | null>(null);
  const resNoteText = editedNote ?? initialResNote;

  // Re-sync when investigation changes (new diagnosis loaded)
  const [prevInitial, setPrevInitial] = useState(initialResNote);
  if (initialResNote !== prevInitial) {
    setPrevInitial(initialResNote);
    setEditedNote(null);
  }

  const jiraTemplate = useMemo(
    () => (investigation ? buildJiraTemplate(investigation) : null),
    [investigation]
  );

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!investigation || !evidenceSet) {
      setExportError('No investigation to export.');
      return;
    }
    setExportLoading(true);
    setExportError(null);
    try {
      const { blob } = await buildNoclenseZip(investigation, evidenceSet, APP_VERSION);
      downloadBlob(noclenseFileName(investigation), blob);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Export failed. Check disk space and try again.'
      );
    } finally {
      setExportLoading(false);
    }
  }, [investigation, evidenceSet]);

  const previewItems = useMemo(() => {
    if (!investigation || !evidenceSet) return [];
    return evidenceSet.items
      .slice(0, MAX_EVIDENCE_PREVIEW)
      .map((item) => {
        const block = investigation.blocks.find((b) => b.id === item.blockId);
        const kind = block?.kind ?? 'unknown';
        const label =
          block?.kind === 'hypothesis'
            ? block.body.title
            : block?.kind === 'analysis'
              ? block.body.summary.slice(0, 60)
              : block?.kind === 'context'
                ? block.body.customer
                : kind;
        return { label, kind };
      });
  }, [investigation, evidenceSet]);

  return (
    <>
      <ClosureNoteCard
        text={resNoteText}
        isDraft={isDraft}
        onTextChange={setEditedNote}
        onExport={handleExport}
        exportLoading={exportLoading}
        exportError={exportError}
      />
      <EvidenceSummaryCard
        itemCount={evidenceSet?.items.length ?? 0}
        previewItems={previewItems}
        jiraFormatted={jiraTemplate?.formatted ?? ''}
      />
    </>
  );
}

export default SubmitRoom;
```

- [ ] **Step 2: Write tests**

```typescript
// src/components/workspace/__tests__/SubmitRoom.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubmitRoom } from '../SubmitRoom';
import * as EvidenceContextModule from '../../../contexts/EvidenceContext';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../../types/canonical';

const inv: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [
    {
      id: asBlockId('ctx'),
      kind: 'context',
      createdAt: 1000,
      updatedAt: 1000,
      citations: [],
      body: { customer: 'Carbyne Test' },
    },
  ],
  citations: {},
};

const evSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [],
};

function renderWithContext(
  investigation: Investigation | null = inv,
  evidenceSet: EvidenceSet | null = evSet
) {
  vi.spyOn(EvidenceContextModule, 'useEvidence').mockReturnValue({
    investigation,
    evidenceSet,
    setInvestigation: vi.fn(),
    pinBlock: vi.fn(),
    unpinBlock: vi.fn(),
    reorderItems: vi.fn(),
    updateItemNote: vi.fn(),
  });
  return render(<SubmitRoom />);
}

describe('SubmitRoom', () => {
  it('renders both cards', () => {
    renderWithContext();
    expect(screen.getByText('Closure Note')).toBeInTheDocument();
    expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
  });

  it('pre-fills textarea with res-note content', () => {
    renderWithContext();
    const textarea = screen.getByRole('textbox', { name: /edit before posting/i });
    expect(textarea).toHaveValue(expect.stringContaining('Carbyne Test'));
  });

  it('shows draft badge when no confirmed hypothesis', () => {
    renderWithContext();
    expect(screen.getByRole('status')).toHaveTextContent(/draft/i);
  });

  it('shows "0 items pinned" when evidence set is empty', () => {
    renderWithContext();
    expect(screen.getByText('0 items pinned')).toBeInTheDocument();
  });

  it('shows "1 item pinned" with singular form', () => {
    const setWithOne: EvidenceSet = {
      ...evSet,
      items: [{ blockId: asBlockId('ctx'), pinnedAt: 1, pinnedBy: 'user', order: 0 }],
    };
    renderWithContext(inv, setWithOne);
    expect(screen.getByText('1 item pinned')).toBeInTheDocument();
  });

  it('Copy for Zendesk button is present', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /copy.*zendesk/i })).toBeInTheDocument();
  });

  it('Copy Jira Template button is present', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /copy jira/i })).toBeInTheDocument();
  });

  it('Export .noclense button is present', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /export.*noclense/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add \
  src/components/workspace/SubmitRoom.tsx \
  src/components/workspace/__tests__/SubmitRoom.test.tsx
git commit -m "feat(phase-03): add SubmitRoom component — closure note, evidence summary, .noclense export"
```

---

## Commit 6 — Swap `NewWorkspaceLayout.submitContent` to `<SubmitRoom />`

**File:** `src/components/workspace/NewWorkspaceLayout.tsx` (modified only).

**Scope:** Pure swap. No new logic. The `.noclense` import wiring has
already landed in Commit 4 inside `WorkspaceImportPanel`.

- [ ] **Step 1: Import `SubmitRoom`**

```typescript
import { SubmitRoom } from './SubmitRoom';
```

- [ ] **Step 2: Replace the `submitContent` stub**

Find the existing `submitContent = useMemo(...)` block (around line 352)
and replace it with a simple assignment:

```typescript
const submitContent = <SubmitRoom />;
```

Remove the old stub card trees for `"closure-note"` and
`"evidence-summary"` from `NewWorkspaceLayout` — the readOnly textarea,
the "Post to Zendesk" stub button, the placeholder body, all of it.
Also remove any imports (`FileText`, `Bookmark`, etc.) that were only
used by the removed stubs.

- [ ] **Step 3: Verify build + tests**

```bash
npx tsc --noEmit
npx vitest run
npx eslint src/
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/NewWorkspaceLayout.tsx
git commit -m "feat(phase-03): swap Submit Room stub for SubmitRoom component"
```

---

## Commit summary (final order)

| # | Commit | Files touched |
|---|---|---|
| 1 | Schema amendment + export services | `canonical.ts`, 3 services + 3 tests |
| 2 | `.noclense` importer | `noclenseImporter.ts` + test |
| 3 | `EvidenceContext.restoreEvidenceSet` action | `EvidenceContext.tsx` + test |
| 4 | `.noclense` import wiring in `WorkspaceImportPanel` | `WorkspaceImportPanel.tsx` + test |
| 5 | `SubmitRoom` component | `SubmitRoom.tsx` + test |
| 6 | `NewWorkspaceLayout.submitContent` → `<SubmitRoom />` | `NewWorkspaceLayout.tsx` |

---

## Verification checklist (before phase close-out)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run` — all tests pass (including new phase-03 tests)
- [ ] `npx eslint src/` — clean (0 errors, 0 new warnings)
- [ ] `ManifestFileRole` no longer has `'manifest'` member (grep confirms)
- [ ] Navigate to Submit Room: Closure Note textarea pre-fills from
      investigation data (even with no investigation, shows empty gracefully)
- [ ] Export `.noclense` produces a downloadable ZIP containing
      `manifest.json`, `investigation.json`, `evidence.json`
- [ ] Manifest integrity round-trip: reading the exported ZIP back,
      SHA-256 of `investigation.json` matches the `manifest.files` claim
- [ ] Importing the exported `.noclense` file back restores the
      investigation and navigates to Investigate Room
- [ ] Dropping a `.noclense` + a `.log` file together shows the
      "drop .noclense files alone" error
- [ ] Dropping a `.noclense` file from an older format (v0 / no
      `manifestSchemaVersion`) shows a user-visible error toast, does NOT crash
- [ ] Draft path: investigation with INCONCLUSIVE hypothesis + analysis
      block produces a Res-note containing the analysis summary
      (regression test for Codex finding)
- [ ] `prefers-reduced-motion` has no animated elements in SubmitRoom
      to audit — the component is static, no motion library usage needed

---

## Deferred items (confirmed safe for Phase 03)

| Item | Phase | Rationale |
|---|---|---|
| Redaction rules in manifest | Phase 04+ | `applied: false, rules: []` is the correct v1 default. |
| Attachment file bundling in ZIP | Phase 04+ | Log files too large; metadata-only reference is the correct Phase 03 scope. |
| Migration shim for v0 packs | Phase 04+ | Spec marks it optional; graceful error + user message is sufficient for Phase 03. |
| "Post to Zendesk" API integration | Phase 04+ | Phase 03 delivers copy-to-clipboard only. |
| Jira issue creation API | Phase 04+ | Phase 03 delivers template copy only. |
| Export loading `progress` glyph (spec §3.5) | Phase 05 | The `block` spinner spec is part of the broad pass; `disabled + text` state is acceptable now. |
| Case-library case sync on import | Phase 06 | `restoreEvidenceSet` does not touch `useCase()`; case-library work is a separate memo (spec §6.3). |
| Investigation-scoped SHA-256 verification on import | Phase 04+ | Phase 03 trusts the ZIP CRC end-to-end. |
| Evidence bundle size pulse in header (spec §5.4 "Bundle size") | Phase 05 | Visual polish belongs in the broad pass; the item count is sufficient signal for Phase 03. |
