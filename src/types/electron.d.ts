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
      isSecureStorageAvailable?: () => Promise<{ ok: boolean; available: boolean; error?: string }>;
      getSecureStorage?: (key: string) => Promise<{ ok: boolean; value?: string | null; error?: string }>;
      setSecureStorage?: (key: string, value: string) => Promise<{ ok: boolean; error?: string }>;
      deleteSecureStorage?: (key: string) => Promise<{ ok: boolean; error?: string }>;
      migrateToSecureStorage?: (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
      codexHealth?: () => Promise<{ ok: boolean; available?: boolean; error?: string }>;
      codexAnalyze?: (payload: {
        query: string;
        context: string;
        model?: string;
        apiKey?: string;
      }) => Promise<{
        ok: boolean;
        content?: string;
        tokensUsed?: number;
        error?: string;
      }>;
    };
  }
}
