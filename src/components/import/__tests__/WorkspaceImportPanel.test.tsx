import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceImportPanel } from '../WorkspaceImportPanel';
import { importFiles } from '../../../services/importService';
import { useLogContext } from '../../../contexts/LogContext';
import { useCase } from '../../../store/caseContext';

// ── module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../services/importService', () => ({
  importFiles: vi.fn(),
  importPastedLogs: vi.fn(),
  appendLogsToIndexedDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

vi.mock('../../../store/caseContext', () => ({
  useCase: vi.fn(),
}));

vi.mock('../../../utils/indexedDB', () => ({
  dbManager: { getMaxLogId: vi.fn().mockResolvedValue(0) },
}));

// Toast is a context provider; mock it so notifications don't blow up
vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
// Also handle the barrel export path
vi.mock('../../ui', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, useToast: () => ({ toast: vi.fn() }) };
});

// ── helpers ───────────────────────────────────────────────────────────────────

const mockImportFiles = importFiles as ReturnType<typeof vi.fn>;
const mockUseLogContext = useLogContext as ReturnType<typeof vi.fn>;
const mockUseCase = useCase as ReturnType<typeof vi.fn>;

function makeDataset(logCount: number, warnings: string[] = []) {
  return {
    id: 'ds_1',
    importBatchId: 'batch_1',
    sourceType: 'apex' as const,
    sourceLabel: 'APEX',
    fileName: 'test.log',
    kind: 'file' as const,
    size: 100,
    importedAt: Date.now(),
    logCount,
    warnings,
  };
}

function defaultLogContext() {
  return {
    logs: [],
    setLogs: vi.fn(),
    setLoading: vi.fn(),
    setSelectedLogId: vi.fn(),
    parsingProgress: 0,
    setParsingProgress: vi.fn(),
    enableIndexedDBMode: vi.fn().mockResolvedValue(undefined),
    useIndexedDBMode: false,
    addImportedDatasets: vi.fn(),
    serverMode: false,
    serverUploadAndParse: vi.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('WorkspaceImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogContext.mockReturnValue(defaultLogContext());
    mockUseCase.mockReturnValue({ activeCase: null, updateCase: vi.fn() });
  });

  it('calls onComplete when importFiles succeeds with logs', async () => {
    const onComplete = vi.fn();
    mockImportFiles.mockResolvedValue({
      logs: [{ id: 1 }],
      datasets: [makeDataset(1)],
      warnings: [],
      usedIndexedDB: false,
      nextLogId: 2,
    });

    render(<WorkspaceImportPanel onComplete={onComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['[INFO] [01/01/2026, 00:00:00] [c]: msg'], 'test.log', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('does NOT call onComplete when importFiles returns zero logs', async () => {
    const onComplete = vi.fn();
    mockImportFiles.mockResolvedValue({
      logs: [],
      datasets: [makeDataset(0)],
      warnings: [],
      usedIndexedDB: false,
      nextLogId: 1,
    });

    render(<WorkspaceImportPanel onComplete={onComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'empty.log', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText(/No parsable events found/i)).toBeInTheDocument()
    );
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete when fallback-imported logs are present (warnings in result)', async () => {
    const onComplete = vi.fn();
    mockImportFiles.mockResolvedValue({
      logs: [{ id: 1 }, { id: 2 }],
      datasets: [makeDataset(2, ['"plain.log" did not match a known log format; imported 2 lines as standalone events.'])],
      warnings: ['"plain.log" did not match a known log format; imported 2 lines as standalone events.'],
      usedIndexedDB: false,
      nextLogId: 3,
    });

    render(<WorkspaceImportPanel onComplete={onComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['line one\nline two'], 'plain.log', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('shows the fallback warning notice after line-by-line import', async () => {
    const warningMsg = '"plain.log" did not match a known log format; imported 2 lines as standalone events.';
    mockImportFiles.mockResolvedValue({
      logs: [{ id: 1 }, { id: 2 }],
      datasets: [makeDataset(2, [warningMsg])],
      warnings: [warningMsg],
      usedIndexedDB: false,
      nextLogId: 3,
    });

    render(<WorkspaceImportPanel onComplete={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['line one\nline two'], 'plain.log', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(warningMsg)).toBeInTheDocument());
  });

  it('renders a drop zone button and activates drag-active state on dragover', () => {
    render(<WorkspaceImportPanel />);

    const dropZone = screen.getByText(/Choose or drop files/i).closest('button')!;
    expect(dropZone).toBeInTheDocument();

    fireEvent.dragOver(dropZone, { preventDefault: vi.fn(), stopPropagation: vi.fn() });

    expect(screen.getByText(/Drop files to import/i)).toBeInTheDocument();
  });

  it('feeds dropped files into the upload handler', async () => {
    const onComplete = vi.fn();
    mockImportFiles.mockResolvedValue({
      logs: [{ id: 1 }],
      datasets: [makeDataset(1)],
      warnings: [],
      usedIndexedDB: false,
      nextLogId: 2,
    });

    render(<WorkspaceImportPanel onComplete={onComplete} />);

    const dropZone = screen.getByText(/Choose or drop files/i).closest('button')!;
    const file = new File(['content'], 'dropped.log', { type: 'text/plain' });
    fireEvent.drop(dropZone, {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(mockImportFiles).toHaveBeenCalled());
  });
});
