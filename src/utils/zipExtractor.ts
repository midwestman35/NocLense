/**
 * zipExtractor.ts
 *
 * Client-side zip extraction for Zendesk ticket attachments.
 * Uses JSZip (dynamically imported to keep initial bundle small)
 * to unpack archives and return only log-relevant files (.log, .txt, .csv).
 * Handles nested folders — the full path is flattened to just the filename.
 */

const LOG_EXTENSIONS = new Set(['.log', '.txt', '.csv']);

/**
 * Returns true when a file or attachment looks like a zip archive.
 */
export function isZipFile(name: string, contentType?: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.zip') ||
    contentType === 'application/zip' ||
    contentType === 'application/x-zip-compressed' ||
    contentType === 'application/x-zip' ||
    contentType === 'application/octet-stream' && lower.endsWith('.zip')
  );
}

/**
 * Extracts all .log, .txt, and .csv files from a zip Blob.
 * Returns them as an array of File objects ready to pass to importFiles().
 * Skips directories, hidden files, and macOS __MACOSX metadata entries.
 *
 * JSZip is dynamically imported so it doesn't bloat the initial bundle.
 */
export async function extractLogFilesFromZip(blob: Blob, _zipName: string): Promise<File[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  const files: File[] = [];

  const entries = Object.entries(zip.files);

  await Promise.all(
    entries.map(async ([path, entry]) => {
      if (entry.dir) return;
      if (path.startsWith('__MACOSX') || path.includes('/.')) return; // skip macOS metadata

      const fileName = path.split('/').pop() ?? path;
      const ext = '.' + fileName.split('.').pop()?.toLowerCase();
      if (!LOG_EXTENSIONS.has(ext)) return;

      const content = await entry.async('blob');
      files.push(new File([content], fileName, { type: 'text/plain' }));
    })
  );

  return files;
}
