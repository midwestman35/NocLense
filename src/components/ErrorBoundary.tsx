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

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-red-500/40 bg-red-500/10 p-6 shadow-[var(--shadow-lg)]">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="text-red-400" size={22} />
            <h1 className="text-lg font-semibold">Application Error</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            The app hit an unexpected error. A crash report was captured to help troubleshooting.
          </p>
          {this.state.reportId && (
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Crash reference: <span className="font-mono">{this.state.reportId}</span>
            </p>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
          >
            <RefreshCw size={14} />
            Reload Application
          </button>
        </div>
      </div>
    );
  }
}
