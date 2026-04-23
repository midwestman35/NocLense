import { invoke } from '@tauri-apps/api/core';

interface RuntimeErrorPayload {
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

interface RuntimeErrorResult {
  reportId: string;
}

export async function reportRuntimeError(payload: RuntimeErrorPayload): Promise<RuntimeErrorResult | null> {
  const report = {
    ...payload,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    href: window.location.href,
  };

  try {
    const result = await invoke<RuntimeErrorResult>('report_runtime_error', { report });
    if (result?.reportId) {
      return { reportId: result.reportId };
    }
  } catch (error) {
    console.error('Failed to report runtime error via Tauri command:', error);
  }

  // Browser fallback keeps diagnostics available during web/dev runs.
  console.error('[runtime-error-fallback]', report);
  return { reportId: `local-${Date.now()}` };
}

/**
 * Install global browser error/rejection handlers.
 *
 * Why:
 * - Captures unhandled runtime exceptions outside React error boundaries.
 * - Captures async promise rejections that otherwise disappear from user reports.
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    void reportRuntimeError({
      source: 'window-error',
      message: event.message || 'Unhandled window error',
      stack: event.error?.stack,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    void reportRuntimeError({
      source: 'window-unhandledrejection',
      message:
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection',
      stack: reason instanceof Error ? reason.stack : undefined,
      metadata: {
        reasonType: typeof reason,
      },
    });
  });
}
