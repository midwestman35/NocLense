import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceImportPanel } from '../WorkspaceImportPanel';
import { useToast } from '../../ui';
import { useLogContext } from '../../../contexts/LogContext';
import { useEvidence } from '../../../contexts/EvidenceContext';
import { useCase } from '../../../store/caseContext';
import { importNoclenseFile } from '../../../services/noclenseImporter';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../../types/canonical';

const toastMock = vi.fn();
const setInvestigationMock = vi.fn();
const restoreEvidenceSetMock = vi.fn();
const clearAllDataMock = vi.fn().mockResolvedValue(undefined);
const setLoadingMock = vi.fn();
const setSelectedLogIdMock = vi.fn();
const setParsingProgressMock = vi.fn();

vi.mock('../../ui', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  useToast: vi.fn(),
}));

vi.mock('../../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('../../../contexts/EvidenceContext', () => ({
  useEvidence: vi.fn(),
}));

vi.mock('../../../store/caseContext', () => ({
  useCase: vi.fn(),
}));

vi.mock('../../../services/noclenseImporter', () => ({
  importNoclenseFile: vi.fn(),
}));

const mockUseToast = vi.mocked(useToast);
const mockUseLogContext = vi.mocked(useLogContext);
const mockUseEvidence = vi.mocked(useEvidence);
const mockUseCase = vi.mocked(useCase);
const mockImportNoclenseFile = vi.mocked(importNoclenseFile);

function buildInvestigation(): Investigation {
  return {
    schemaVersion: INVESTIGATION_SCHEMA_VERSION,
    id: asInvestigationId('inv-1'),
    createdAt: 1,
    updatedAt: 1,
    blocks: [
      {
        id: asBlockId('block-1'),
        kind: 'context',
        createdAt: 1,
        updatedAt: 1,
        citations: [],
        body: {
          customer: 'Acme Telecom',
          ticketUrl: 'https://example.zendesk.com/tickets/1',
        },
      },
    ],
    citations: {},
  };
}

function buildEvidenceSet(): EvidenceSet {
  return {
    caseId: asCaseId('case-1'),
    investigationId: asInvestigationId('inv-1'),
    items: [
      {
        blockId: asBlockId('block-1'),
        pinnedAt: 1,
        pinnedBy: 'user',
        order: 0,
      },
    ],
  };
}

describe('WorkspaceImportPanel .noclense import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: toastMock });
    mockUseLogContext.mockReturnValue({
      logs: [],
      setLogs: vi.fn(),
      setLoading: setLoadingMock,
      setSelectedLogId: setSelectedLogIdMock,
      parsingProgress: 0,
      setParsingProgress: setParsingProgressMock,
      clearAllData: clearAllDataMock,
      enableIndexedDBMode: vi.fn(),
      useIndexedDBMode: false,
      addImportedDatasets: vi.fn(),
      serverMode: false,
      serverUploadAndParse: vi.fn(),
    } as unknown as ReturnType<typeof useLogContext>);
    mockUseEvidence.mockReturnValue({
      investigation: null,
      evidenceSet: null,
      setInvestigation: setInvestigationMock,
      restoreEvidenceSet: restoreEvidenceSetMock,
      pinBlock: vi.fn(),
      unpinBlock: vi.fn(),
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    } as unknown as ReturnType<typeof useEvidence>);
    mockUseCase.mockReturnValue({
      activeCase: null,
      updateCase: vi.fn(),
    } as unknown as ReturnType<typeof useCase>);
  });

  it('imports a .noclense file and restores investigation state', async () => {
    const investigation = buildInvestigation();
    const evidenceSet = buildEvidenceSet();
    mockImportNoclenseFile.mockResolvedValue({
      ok: true,
      investigation,
      evidenceSet,
      manifest: {
        manifestSchemaVersion: 1,
        createdAt: 1,
        app: { name: 'NocLense', version: '1.0.0' },
        investigation: {
          id: investigation.id,
          schemaVersion: investigation.schemaVersion,
        },
        files: [],
        evidence: { caseId: evidenceSet.caseId, itemCount: 1 },
        exportState: 'confirmed',
        redaction: {
          applied: false,
          rules: [],
        },
      },
    });

    const onComplete = vi.fn();
    const { container } = render(<WorkspaceImportPanel onComplete={onComplete} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['zip'], 'case.noclense', { type: 'application/zip' })] },
    });

    await waitFor(() => {
      expect(mockImportNoclenseFile).toHaveBeenCalledTimes(1);
    });

    expect(clearAllDataMock).toHaveBeenCalledTimes(1);
    expect(setInvestigationMock).toHaveBeenCalledWith(investigation);
    expect(restoreEvidenceSetMock).toHaveBeenCalledWith(evidenceSet);
    expect(toastMock).toHaveBeenCalledWith('Investigation imported.', { variant: 'success' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('surfaces importer failures without mutating evidence context', async () => {
    mockImportNoclenseFile.mockResolvedValue({
      ok: false,
      error: 'The archive is unreadable.',
    });

    const { container } = render(<WorkspaceImportPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['zip'], 'broken.noclense', { type: 'application/zip' })] },
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('The archive is unreadable.', { variant: 'error' });
    });

    expect(setInvestigationMock).not.toHaveBeenCalled();
    expect(restoreEvidenceSetMock).not.toHaveBeenCalled();
    expect(screen.getByText('The archive is unreadable.')).toBeInTheDocument();
  });

  it('rejects mixed .noclense and log drops', async () => {
    const { container } = render(<WorkspaceImportPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [
          new File(['zip'], 'case.noclense', { type: 'application/zip' }),
          new File(['logs'], 'session.log', { type: 'text/plain' }),
        ],
      },
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Drop .noclense files alone', { variant: 'error' });
    });

    expect(mockImportNoclenseFile).not.toHaveBeenCalled();
    expect(screen.getByText('Drop .noclense files alone. Do not mix with log files.')).toBeInTheDocument();
  });

  it('shows the graceful v0 rejection from the importer', async () => {
    mockImportNoclenseFile.mockResolvedValue({
      ok: false,
      error: 'older version of NocLense',
    });

    const { container } = render(<WorkspaceImportPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['zip'], 'legacy.noclense', { type: 'application/zip' })] },
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('older version of NocLense', { variant: 'error' });
    });

    expect(setInvestigationMock).not.toHaveBeenCalled();
  });

  it('drop zone applies motion-safe hover scale and glow classes', () => {
    render(<WorkspaceImportPanel />);

    const dropZone = screen.getByTestId('import-drop-zone');

    expect(dropZone.className).toMatch(/motion-safe:hover:scale/);
    expect(dropZone.className).toMatch(/shadow-\[var\(--shadow-glow-ready/);
  });
});
