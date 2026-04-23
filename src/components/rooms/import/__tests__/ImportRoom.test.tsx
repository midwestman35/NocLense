import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportRoom } from '../ImportRoom';
import { useToast } from '../../../ui';
import { useLogContext } from '../../../../contexts/LogContext';
import { useEvidence } from '../../../../contexts/EvidenceContext';
import { useCase } from '../../../../store/caseContext';
import { importFiles, importPastedLogs } from '../../../../services/importService';
import { importNoclenseFile } from '../../../../services/noclenseImporter';
import { openImportFilesDialog } from '../../../../services/importFileSource';
import { dbManager } from '../../../../utils/indexedDB';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../../../types/canonical';
import type { Case } from '../../../../types/case';

const toastMock = vi.fn();
const setInvestigationMock = vi.fn();
const restoreEvidenceSetMock = vi.fn();
const clearAllDataMock = vi.fn().mockResolvedValue(undefined);
const setLoadingMock = vi.fn();
const setSelectedLogIdMock = vi.fn();
const setParsingProgressMock = vi.fn();
const setLogsMock = vi.fn();
const enableIndexedDBModeMock = vi.fn().mockResolvedValue(undefined);
const caseDispatchMock = vi.fn();
const setActiveCaseMock = vi.fn();
const updateCaseMock = vi.fn();
const addImportedDatasetsMock = vi.fn();

vi.mock('../../../ui', async () => {
  const actual = await vi.importActual<typeof import('../../../ui')>('../../../ui');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

vi.mock('../../../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('../../../../contexts/EvidenceContext', () => ({
  useEvidence: vi.fn(),
}));

vi.mock('../../../../store/caseContext', () => ({
  useCase: vi.fn(),
}));

vi.mock('../../../../services/importService', () => ({
  appendLogsToIndexedDB: vi.fn(),
  importFiles: vi.fn(),
  importPastedLogs: vi.fn(),
}));

vi.mock('../../../../services/noclenseImporter', () => ({
  importNoclenseFile: vi.fn(),
}));

vi.mock('../../../../services/importFileSource', async () => {
  const actual = await vi.importActual<typeof import('../../../../services/importFileSource')>('../../../../services/importFileSource');
  return {
    ...actual,
    openImportFilesDialog: vi.fn(),
  };
});

vi.mock('../../../../utils/indexedDB', () => ({
  dbManager: {
    getMaxLogId: vi.fn().mockResolvedValue(0),
    getMetadata: vi.fn().mockResolvedValue({
      totalLogs: 250000,
      fileNames: ['huge.log'],
      dateRange: { min: 1713872400000, max: 1713876000000 },
    }),
  },
}));

const mockUseToast = vi.mocked(useToast);
const mockUseLogContext = vi.mocked(useLogContext);
const mockUseEvidence = vi.mocked(useEvidence);
const mockUseCase = vi.mocked(useCase);
const mockImportFiles = vi.mocked(importFiles);
const mockImportPastedLogs = vi.mocked(importPastedLogs);
const mockImportNoclenseFile = vi.mocked(importNoclenseFile);
const mockOpenImportFilesDialog = vi.mocked(openImportFilesDialog);
const mockDbManager = vi.mocked(dbManager);

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

function buildImportedCase(): Case {
  return {
    id: 'case-1',
    title: 'Acme Telecom / Imported investigation',
    severity: 'medium',
    status: 'resolved',
    summary: 'Imported summary',
    impact: 'Imported impact',
    createdAt: 1,
    updatedAt: 1,
    attachments: [],
    bookmarks: [],
    notes: [],
    timeWindow: null,
  };
}

describe('ImportRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: toastMock });
    mockUseLogContext.mockReturnValue({
      logs: [],
      setLogs: setLogsMock,
      setLoading: setLoadingMock,
      setSelectedLogId: setSelectedLogIdMock,
      parsingProgress: 0,
      setParsingProgress: setParsingProgressMock,
      clearAllData: clearAllDataMock,
      enableIndexedDBMode: enableIndexedDBModeMock,
      useIndexedDBMode: false,
      addImportedDatasets: addImportedDatasetsMock,
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
      cases: [],
      dispatch: caseDispatchMock,
      setActiveCase: setActiveCaseMock,
      updateCase: updateCaseMock,
    } as unknown as ReturnType<typeof useCase>);
    mockImportPastedLogs.mockResolvedValue({
      logs: [],
      dataset: {
        id: 'dataset-paste',
        importBatchId: 'import-paste',
        sourceType: 'aws',
        sourceLabel: 'AWS Console',
        fileName: 'aws-console-paste.log',
        kind: 'paste',
        size: 32,
        importedAt: 1,
        logCount: 0,
        warnings: [],
      },
      warnings: [],
      nextLogId: 1,
    });
  });

  it('renders the room shell and imports a small file from the drop zone', async () => {
    mockImportFiles.mockResolvedValue({
      logs: [
        {
          id: 1,
          timestamp: 1713872400000,
          rawTimestamp: '2026-04-23T10:00:00.000Z',
          displayTimestamp: '10:00',
          level: 'INFO',
          component: 'test',
          displayComponent: 'test',
          message: 'Imported line',
          displayMessage: 'Imported line',
          payload: '',
          type: 'LOG',
          isSip: false,
          fileName: 'session.log',
          fileColor: '#3b82f6',
        },
      ],
      datasets: [
        {
          id: 'dataset-1',
          importBatchId: 'import-1',
          sourceType: 'apex',
          sourceLabel: 'APEX',
          fileName: 'session.log',
          kind: 'file',
          size: 128,
          importedAt: 1,
          logCount: 1,
          warnings: [],
        },
      ],
      warnings: [],
      usedIndexedDB: false,
      nextLogId: 2,
    });

    const onComplete = vi.fn();
    render(<ImportRoom onComplete={onComplete} />);

    expect(screen.getByRole('heading', { name: /start an investigation/i })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [new File(['hello'], 'session.log', { type: 'text/plain' })] },
    });

    await waitFor(() => {
      expect(mockImportFiles).toHaveBeenCalledTimes(1);
    });

    expect(setLogsMock).toHaveBeenCalledTimes(1);
    expect(addImportedDatasetsMock).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Import ready')).toBeInTheDocument();
    expect(screen.getByText('session.log')).toBeInTheDocument();
  });

  it('imports a .noclense archive and restores investigation state', async () => {
    mockImportNoclenseFile.mockResolvedValue({
      ok: true,
      investigation: buildInvestigation(),
      evidenceSet: buildEvidenceSet(),
      importedCase: buildImportedCase(),
      manifest: {
        manifestSchemaVersion: 1,
        createdAt: 1,
        app: { name: 'NocLense', version: '1.0.0' },
        investigation: {
          id: asInvestigationId('inv-1'),
          schemaVersion: INVESTIGATION_SCHEMA_VERSION,
        },
        files: [],
        evidence: { caseId: asCaseId('case-1'), itemCount: 1 },
        exportState: 'confirmed',
        redaction: {
          applied: false,
          rules: [],
        },
      },
    });

    const onComplete = vi.fn();
    render(<ImportRoom onComplete={onComplete} />);

    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [new File(['zip'], 'case.noclense', { type: 'application/zip' })] },
    });

    await waitFor(() => {
      expect(mockImportNoclenseFile).toHaveBeenCalledTimes(1);
    });

    expect(clearAllDataMock).toHaveBeenCalledTimes(1);
    expect(setInvestigationMock).toHaveBeenCalledTimes(1);
    expect(restoreEvidenceSetMock).toHaveBeenCalledTimes(1);
    expect(caseDispatchMock).toHaveBeenCalledTimes(1);
    expect(setActiveCaseMock).toHaveBeenCalledWith('case-1');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses the native dialog path for large streaming imports', async () => {
    mockOpenImportFilesDialog.mockResolvedValue([
      {
        kind: 'tauri-path',
        path: 'C:/logs/huge.log',
        name: 'huge.log',
        size: 100 * 1024 * 1024,
      },
    ]);
    mockImportFiles.mockResolvedValue({
      logs: [],
      datasets: [
        {
          id: 'dataset-large',
          importBatchId: 'import-large',
          sourceType: 'apex',
          sourceLabel: 'APEX',
          fileName: 'huge.log',
          kind: 'file',
          size: 100 * 1024 * 1024,
          importedAt: 1,
          logCount: 250000,
          warnings: [],
        },
      ],
      warnings: ['Large file routed to IndexedDB.'],
      usedIndexedDB: true,
      nextLogId: 250001,
    });

    render(<ImportRoom />);

    fireEvent.click(screen.getByTestId('import-dropzone'));

    await waitFor(() => {
      expect(mockOpenImportFilesDialog).toHaveBeenCalledTimes(1);
      expect(mockImportFiles).toHaveBeenCalledTimes(1);
    });

    expect(enableIndexedDBModeMock).toHaveBeenCalledTimes(1);
    expect(mockDbManager.getMetadata).toHaveBeenCalled();
    expect(screen.getByText('IndexedDB streaming')).toBeInTheDocument();
    expect(screen.getByText('250,000 entries')).toBeInTheDocument();
  });
});
