import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportRuntimeError } from '../utils/errorReporting';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  reportId: string | null;
}

/**
 * Top-level React error boundary.
 *
 * Why:
 * - Prevents full white-screen crashes from uncaught render/lifecycle exceptions.
 * - Captures component stack details and forwards them to centralized reporting.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, reportId: null };
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, reportId: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // DEBUG: identify which component is failing
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[ErrorBoundary] Error:', error.message);
    // Capture structured crash info with component stack so support can triage.
    void reportRuntimeError({
      source: 'react-error-boundary',
      message: error.message,
      stack: error.stack,
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    }).then((result) => {
      if (result?.reportId) {
        this.setState({ reportId: result.reportId });
      }
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, reportId: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="h-screen w-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-6 shadow-[var(--shadow-floating)]">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="text-[var(--destructive)]" size={22} />
            <h1 className="text-lg font-semibold">Application Error</h1>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            The app hit an unexpected error. A crash report was captured to help troubleshooting.
          </p>
          {this.state.reportId && (
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Crash reference: <span className="font-mono">{this.state.reportId}</span>
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--foreground)] text-ink-0 hover:bg-[var(--foreground)]/90"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Hard Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
