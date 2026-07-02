import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Sentinel Atlas route error:', error, errorInfo);
    }
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center px-4 py-16">
        <div className="panel ambient-sweep-bg w-full overflow-hidden p-0">
          <div className="border-b border-error-500/20 bg-error-500/5 p-6">
            <div className="flex items-center gap-2 text-error-300">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">View interrupted</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-100">
              Sentinel Atlas paused this view before it could destabilise the workspace.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Retry the current view, or return to the Command Centre and continue from a stable route.
            </p>
          </div>
          {import.meta.env.DEV && (
            <pre className="max-h-40 overflow-auto border-b border-ink-700/60 bg-ink-950/70 p-4 text-xs text-error-200">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex flex-col gap-3 p-6 sm:flex-row">
            <button type="button" onClick={this.retry} className="btn-primary justify-center">
              <RefreshCw className="h-4 w-4" />
              Retry view
            </button>
            <Link to="/command-centre" onClick={this.retry} className="btn-secondary justify-center">
              Return to Command Centre
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
