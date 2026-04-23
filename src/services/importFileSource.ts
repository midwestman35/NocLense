import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  open as openFsFile,
  readFile,
  readTextFile,
  stat,
  SeekMode,
} from '@tauri-apps/plugin-fs';

export interface NativeImportFile {
  kind: 'tauri-path';
  name: string;
  path: string;
  size: number;
}

export type ImportFileSource = File | NativeImportFile;

export function isBrowserImportFile(file: ImportFileSource): file is File {
  return typeof File !== 'undefined' && file instanceof File;
}

export function isNativeImportFile(file: ImportFileSource): file is NativeImportFile {
  return typeof file === 'object' && file !== null && 'kind' in file && file.kind === 'tauri-path';
}

function isTauriDesktopRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return '__TAURI_INTERNALS__' in window;
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function inferMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.csv')) {
    return 'text/csv';
  }
  if (lowerName.endsWith('.noclense')) {
    return 'application/zip';
  }
  return 'text/plain';
}

export async function openImportFilesDialog(): Promise<NativeImportFile[] | null> {
  if (!isTauriDesktopRuntime()) {
    return null;
  }

  const selection = await openDialog({
    title: 'Import workspace files',
    multiple: true,
    filters: [
      { name: 'Log files', extensions: ['log', 'txt', 'csv', 'noclense'] },
    ],
  });

  if (selection === null) {
    return [];
  }

  const paths = Array.isArray(selection) ? selection : [selection];
  const nativeFiles: NativeImportFile[] = [];

  for (const path of paths) {
    const info = await stat(path);
    if (!info.isFile) {
      continue;
    }

    nativeFiles.push({
      kind: 'tauri-path',
      path,
      name: basename(path),
      size: info.size,
    });
  }

  return nativeFiles;
}

export async function readImportFileText(file: ImportFileSource): Promise<string> {
  if (isBrowserImportFile(file)) {
    return file.text();
  }

  return readTextFile(file.path);
}

export async function readImportFileSliceText(
  file: ImportFileSource,
  start: number,
  end: number,
): Promise<string> {
  if (isBrowserImportFile(file)) {
    return file.slice(start, end).text();
  }

  const handle = await openFsFile(file.path, { read: true });
  try {
    await handle.seek(start, SeekMode.Start);
    const buffer = new Uint8Array(Math.max(end - start, 0));
    const bytesRead = await handle.read(buffer);
    if (bytesRead === null || bytesRead === 0) {
      return '';
    }

    return new TextDecoder().decode(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

export async function toBrowserImportFile(file: ImportFileSource): Promise<File> {
  if (isBrowserImportFile(file)) {
    return file;
  }

  const bytes = await readFile(file.path);
  return new File([bytes], file.name, { type: inferMimeType(file.name) });
}
