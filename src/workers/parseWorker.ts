/// <reference lib="webworker" />

/**
 * Web Worker for log file parsing.
 *
 * Offloads the CPU-intensive parseLogFileStreaming work so the main thread
 * stays responsive for 10-50 MB files opened in the browser (non-Electron) path.
 *
 * Communication protocol (postMessage):
 *   Main -> Worker:  { file: File, fileName: string, fileColor: string, startId: number }
 *   Worker -> Main:  { type: 'progress', progress: number }
 *                  | { type: 'done', logs: LogEntry[] }
 *                  | { type: 'error', error: string }
 */

import { parseLogFileStreaming } from '../utils/parser';

self.onmessage = async (e: MessageEvent) => {
  const { file, fileColor, startId, timezone } = e.data as {
    file: File;
    fileColor: string;
    startId: number;
    timezone?: string;
  };

  try {
    const logs = await parseLogFileStreaming(file, fileColor, startId, (progress) => {
      self.postMessage({ type: 'progress', progress });
    }, timezone);

    self.postMessage({ type: 'done', logs });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
