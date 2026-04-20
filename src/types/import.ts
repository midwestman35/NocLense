/**
 * Import and Export Type Definitions
 *
 * Purpose:
 * Consolidates types for file import operations and data export/archive functionality.
 * Handles results from import processes and structures for export operations.
 *
 * @module types/import
 */

// ─── Import Operation Results ────────────────────────────────────────────────

export interface ImportFilesResult {
  success: boolean;
  importBatchId?: string;
  jobIds?: string[];
  warning?: string;
}

export interface ImportTextResult {
  success: boolean;
  importBatchId?: string;
  jobId?: string;
  message: string;
}

export interface ServerImportResult {
  jobId: string;
  importBatchId: string;
  fileName: string;
  logCount: number;
}

// ─── Export/Archive Types ────────────────────────────────────────────────────

export interface ZipEntry {
  /** Path within the zip file (e.g., "logs/output.json") */
  path: string;
  /** File content as Blob or string */
  data: Blob | string;
  /** Optional: size in bytes (computed if not provided) */
  size?: number;
}

// ─── Archive Options ────────────────────────────────────────────────────────

export interface ArchiveOptions {
  /** Name of the archive file (without .zip extension) */
  archiveName: string;
  /** Include parsed logs in the archive */
  includeLogs?: boolean;
  /** Include investigation notes and bookmarks */
  includeNotes?: boolean;
  /** Include export metadata and provenance information */
  includeProvenance?: boolean;
  /** Compression level (1-9, default: 6) */
  compressionLevel?: number;
}
