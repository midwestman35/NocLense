export {};

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      reportError?: (payload: {
        source: string;
        message: string;
        stack?: string;
        metadata?: Record<string, unknown>;
        timestamp?: string;
        userAgent?: string;
        href?: string;
      }) => Promise<{ ok: boolean; reportId?: string; error?: string }>;
      getCrashReports?: (options?: {
        limit?: number;
      }) => Promise<{
        ok: boolean;
        reports?: Array<{
          reportId: string;
          source: string;
          timestamp: string;
          payload: Record<string, unknown>;
        }>;
        logPath?: string;
        error?: string;
      }>;
      openCrashLogLocation?: () => Promise<{ ok: boolean; error?: string }>;
      clearCrashReports?: () => Promise<{ ok: boolean; error?: string }>;
    };
  }
}
