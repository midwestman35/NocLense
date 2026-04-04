/**
 * adapter.ts — file-system streaming adapter for the server-side parser.
 *
 * The client-side parser uses File.slice() to read chunks from a browser File
 * object. On the server there is no File API — this adapter provides the
 * equivalent via Node's fs.createReadStream so the rest of the parser can
 * work with a consistent streaming interface.
 */

import fs from 'fs';
import path from 'path';

export interface FileStreamOptions {
  /** Encoding for the stream. Defaults to 'utf-8'. */
  encoding?: BufferEncoding;
  /** Read chunk size in bytes. Defaults to 2 MB. */
  highWaterMark?: number;
}

/**
 * Create a readable stream from an on-disk file path.
 * Drop-in replacement for the browser's File.stream() / File.slice() pattern.
 */
export function createFileStream(
  filePath: string,
  options: FileStreamOptions = {}
): fs.ReadStream {
  const { encoding = 'utf-8', highWaterMark = 2 * 1024 * 1024 } = options;
  return fs.createReadStream(filePath, { encoding, highWaterMark });
}

/**
 * Return the size in bytes of a file on disk.
 * Equivalent to File.size in the browser.
 */
export function getFileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

/**
 * Return the base filename from a path.
 * Equivalent to File.name in the browser.
 */
export function getFileName(filePath: string): string {
  return path.basename(filePath);
}
