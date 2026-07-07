import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ListFilter,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { SectionHeader } from './ui';
import {
  getSourceOperationsRecentRuns,
  type SourceOperationsFailureSummary,
  type SourceOperationsRun,
  type SourceOperationsRunStatus,
} from '../lib/sourceOperations';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';
type StatusFilter = 'all' | 'succeeded' | 'partial' | 'failed';
type CoverageFilter = 'all' | 'attention';

const statusStyles: Record<
  SourceOperationsRunStatus,
  {
    label: string;
    chip: string;
    dot: string;
    icon: typeof CheckCircle2;
  }
> = {
  succeeded: {
    label: 'Succeeded',
    chip: 'border-success-500/30 bg-success-500/10 text-success-300',
    dot: 'bg-success-500',
    icon: CheckCircle2,
  },
  partial: {
    label: 'Partial coverage',
    chip: 'border-warning-500/30 bg-warning-500/10 text-warning-300',
    dot: 'bg-warning-500',
    icon: AlertTriangle,
  },
  failed: {
    label: 'Failed',
    chip: 'border-error-500/30 bg-error-500/10 text-error-300',
    dot: 'bg-error-500',
    icon: AlertTriangle,
  },
  running: {
    label: 'Running',
    chip: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
    icon: Activity,
  },
  unknown: {
    label: 'Status unavailable',
    chip: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    dot: 'bg-slate-500',
    icon: Server,
  },
};

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeTime(value: string): string {
  const date = new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return 'Time unavailable';
  }

  const diffMs = Date.now() - timestamp;
  const absDiffMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absDiffMs < minute) {
    return 'just now';
  }

  if (absDiffMs < hour) {
    const minutes = Math.max(1, Math.round(absDiffMs / minute));
    return `${minutes}m ${diffMs >= 0 ? 'ago' : 'from now'}`;
  }

  if (absDiffMs < day) {
    const hours = Math.max(1, Math.round(absDiffMs / hour));
    return `${hours}h ${diffMs >= 0 ? 'ago' : 'from now'}`;
  }

  const days = Math.max(1, Math.round(absDiffMs / day));
  return `${days}d ${diffMs >= 0 ? 'ago' : 'from now'}`;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return 'In progress';
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 1)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

function humanize(value: string | null): string {
  if (!value) {
    return 'Not recorded';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function failureSummaryLabel(summary: SourceOperationsFailureSummary): string {
  const parts = [
    summary.category ? humanize(summary.category) : null,
    summary.partition ? humanize(summary.partition) : null,
    summary.status ? humanize(summary.status) : null,
    summary.attempts !== null
      ? `${summary.attempts} attempt${summary.attempts === 1 ? '' : 's'}`
      : null,
    summary.outcome ? humanize(summary.outcome) : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' · ') || 'Safe provider failure summary unavailable';
}

function coverageMessage(run: SourceOperationsRun): string {
  if (run.status === 'succeeded') {
    return 'Completed without recorded coverage warnings.';
  }

  if (run.status === 'partial') {
    return run.retainedStoredRecords
      ? 'Partial provider coverage. Stored source-backed records were retained.'
      : 'Partial provider coverage was recorded.';
  }

  if (run.status === 'failed') {
    return run.retainedStoredRecords
      ? 'No successful provider coverage was recorded. Existing stored records were retained.'
      : 'No successful provider coverage was recorded for this run.';
  }

  if (run.status === 'running') {
    return 'The ingestion run is still in progress.';
  }

  return 'Operational outcome metadata is unavailable for this historical run.';
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Activity;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function RunStatusChip({ status }: { status: SourceOperationsRunStatus }) {
  const config = statusStyles[status];

  return (
    <span className={`chip ${config.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export function SourceOperationsPanel() {
  const [state, setState] = useState<LoadState>('loading');
  const [runs, setRuns] = useState<SourceOperationsRun[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all');

  const loadRuns = useCallback(async () => {
    setState('loading');
    setErrorMessage(null);

    try {
      const nextRuns = await getSourceOperationsRecentRuns(20);
      setRuns(nextRuns);
      setState(nextRuns.length > 0 ? 'ready' : 'empty');
    } catch {
      setRuns([]);
      setState('error');
      setErrorMessage(
        'Operational history could not be loaded. Stored source records remain available where retained.',
      );
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const sourceOptions = useMemo(() => {
    const sources = new Map<string, string>();

    runs.forEach((run) => {
      sources.set(run.sourceCode, run.displayName);
    });

    return [...sources.entries()]
      .map(([code, displayName]) => ({ code, displayName }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [runs]);

  const visibleRuns = useMemo(() => {
    return runs.filter((run) => {
      if (sourceFilter !== 'all' && run.sourceCode !== sourceFilter) {
        return false;
      }

      if (statusFilter !== 'all' && run.status !== statusFilter) {
        return false;
      }

      if (
        coverageFilter === 'attention' &&
        run.status !== 'partial' &&
        run.status !== 'failed'
      ) {
        return false;
      }

      return true;
    });
  }, [coverageFilter, runs, sourceFilter, statusFilter]);

  const summary = useMemo(() => {
    const partialOrFailed = visibleRuns.filter(
      (run) => run.status === 'partial' || run.status === 'failed',
    ).length;
    const retries = visibleRuns.reduce((total, run) => total + run.retryCount, 0);
    const sourceCount = new Set(visibleRuns.map((run) => run.sourceCode)).size;

    return {
      partialOrFailed,
      retries,
      sourceCount,
    };
  }, [visibleRuns]);

  const hasActiveFilters =
    sourceFilter !== 'all' || statusFilter !== 'all' || coverageFilter !== 'all';

  const resetFilters = () => {
    setSourceFilter('all');
    setStatusFilter('all');
    setCoverageFilter('all');
  };

  return (
    <section aria-labelledby="source-operations-heading">
      <SectionHeader
        title="Source Operations"
        icon={Server}
        action={
          <button
            type="button"
            onClick={() => {
              void loadRuns();
            }}
            className="btn-secondary px-3 py-2 text-xs"
            disabled={state === 'loading'}
            aria-label="Refresh source operations history"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
            {state === 'loading' ? 'Loading...' : 'Refresh view'}
          </button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Visible runs"
          value={`${visibleRuns.length} / ${runs.length}`}
          hint="Runs matching the current client-side filters"
          icon={Activity}
        />
        <SummaryCard
          label="Sources observed"
          value={summary.sourceCount}
          hint="Distinct sources in the filtered run window"
          icon={Database}
        />
        <SummaryCard
          label="Partial or failed"
          value={summary.partialOrFailed}
          hint="Filtered runs with incomplete or unsuccessful coverage"
          icon={AlertTriangle}
        />
        <SummaryCard
          label="Retries observed"
          value={summary.retries}
          hint="Bounded retries in the filtered run window"
          icon={Timer}
        />
      </div>

      <div className="panel ambient-sweep-bg overflow-hidden">
        <div className="border-b border-ink-700/70 px-4 py-4 lg:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="source-operations-heading" className="text-sm font-semibold text-slate-100">
              Recent ingestion history
            </h3>
            <span className="chip border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              Authenticated read-only view
            </span>
          </div>
          <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-400">
            This view exposes safe operational summaries only. Filters run in this browser over
            the already-sanitized results. Refresh reloads stored history and does not trigger
            provider ingestion, scheduler jobs, or protected Edge Functions.
          </p>
        </div>

        {state === 'ready' ? (
          <div className="border-b border-ink-700/70 bg-ink-900/40 px-4 py-4 lg:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <ListFilter className="h-4 w-4 text-cyan-300" />
                Filter recent runs
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[720px]">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-400">Source</span>
                  <select
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                    className="w-full rounded-lg border border-ink-600/70 bg-ink-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-cyan-500/60"
                  >
                    <option value="all">All sources</option>
                    {sourceOptions.map((source) => (
                      <option key={source.code} value={source.code}>
                        {source.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-400">Outcome</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="w-full rounded-lg border border-ink-600/70 bg-ink-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-cyan-500/60"
                  >
                    <option value="all">All outcomes</option>
                    <option value="succeeded">Succeeded</option>
                    <option value="partial">Partial coverage</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-400">Coverage</span>
                  <select
                    value={coverageFilter}
                    onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}
                    className="w-full rounded-lg border border-ink-600/70 bg-ink-950/80 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-cyan-500/60"
                  >
                    <option value="all">All coverage states</option>
                    <option value="attention">Partial or failed only</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <p className="text-slate-500" aria-live="polite">
                Showing {visibleRuns.length} of {runs.length} recent run{runs.length === 1 ? '' : 's'}.
              </p>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-cyan-300 transition-colors hover:text-cyan-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {state === 'loading' ? (
          <div className="space-y-0" aria-live="polite" aria-label="Loading source operations">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="grid gap-4 border-t border-ink-700/70 px-4 py-4 first:border-t-0 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:px-5"
              >
                <div className="space-y-2">
                  <div className="h-3 w-36 rounded-full skeleton-shimmer" />
                  <div className="h-3 w-24 rounded-full skeleton-shimmer" />
                </div>
                <div className="h-6 w-28 rounded-full skeleton-shimmer" />
                <div className="h-3 w-20 rounded-full skeleton-shimmer" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded-full skeleton-shimmer" />
                  <div className="h-3 w-2/3 rounded-full skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {state === 'empty' ? (
          <div className="px-4 py-6 lg:px-5">
            <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 p-4 text-sm text-slate-400">
              No completed source-ingestion runs are available yet.
            </div>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="px-4 py-6 lg:px-5">
            <div className="rounded-lg border border-warning-500/20 bg-warning-500/10 p-4 text-sm text-warning-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">Source Operations history is unavailable.</p>
                  <p className="mt-1 text-xs leading-relaxed text-warning-100/90">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}


        {state === 'ready' && visibleRuns.length === 0 ? (
          <div className="px-4 py-6 lg:px-5">
            <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 p-4">
              <p className="text-sm font-medium text-slate-200">No recent runs match these filters.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Reset the filters to return to the complete sanitized run window.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </button>
            </div>
          </div>
        ) : null}

        {state === 'ready' && visibleRuns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1060px] w-full text-left">
              <thead className="border-b border-ink-700/70 bg-ink-900/60 text-xs uppercase tracking-[0.13em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium lg:px-5">Source / started</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Records</th>
                  <th className="px-4 py-3 font-medium">Retries</th>
                  <th className="px-4 py-3 font-medium">Coverage note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/60">
                {visibleRuns.map((run) => {
                  const statusConfig = statusStyles[run.status];

                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={`${run.sourceCode}-${run.startedAt}`} className="align-top">
                      <td className="px-4 py-4 lg:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-100">{run.displayName}</p>
                          <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                            {run.sourceCode.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {relativeTime(run.startedAt)} · {formatTimestamp(run.startedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <RunStatusChip status={run.status} />
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {humanize(run.finalProviderOutcome)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-sm text-slate-200">{formatDuration(run.durationMs)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {run.completedAt ? 'Completed' : 'Awaiting completion'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-200">
                          {run.recordsReceived.toLocaleString()} received
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {run.recordsCreated.toLocaleString()} created · {run.recordsUpdated.toLocaleString()} updated
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-200">
                          {run.retryCount.toLocaleString()} {run.retryCount === 1 ? 'retry' : 'retries'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {run.retryableFailureCount.toLocaleString()} retryable failure{run.retryableFailureCount === 1? '' : 's'}
                          {run.successfulResponseCount > 0
                            ? ` · ${run.successfulResponseCount.toLocaleString()} HTTP 200s`
                            : ''}
                        </p>
                      </td>
                      <td className="max-w-md px-4 py-4">
                        <p className="text-xs leading-relaxed text-slate-400">
                          {coverageMessage(run)}
                        </p>
                        {run.failureSummaries.length > 0 ? (
                          <details className="mt-2 rounded-lg border border-warning-500/15 bg-warning-500/5 px-3 py-2 text-xs text-warning-100">
                            <summary className="cursor-pointer font-medium text-warning-300">
                              {run.failureSummaryCount} safe provider {run.failureSummaryCount === 1 ? 'summary' : 'summaries'}
                            </summary>
                            <ul className="mt-2 space-y-1.5">
                              {run.failureSummaries.map((summary, index) => (
                                <li key={`${summary.category ?? 'source'}-${summary.partition ?? 'partition'}-${index}`}>
                                  {failureSummaryLabel(summary)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                        {run.retainedStoredRecords ? (
                          <p className="mt-2 flex items-start gap-1.5 text-xs text-cyan-300">
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            Stored records retained
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default SourceOperationsPanel;
