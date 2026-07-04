import { AlertTriangle, CheckCircle2, Clock, Database, RefreshCw, Server } from 'lucide-react';
import { SectionHeader } from './ui';
import type {
  LiveUsgsIncidentRecord,
  LiveUsgsSourceStatus,
  LiveUsgsState,
} from '../types/liveIntelligence';

const SOURCE_ORDER = ['usgs', 'gdacs', 'eonet'] as const;

const sourceLabels: Record<(typeof SOURCE_ORDER)[number], string> = {
  usgs: 'USGS',
  gdacs: 'GDACS',
  eonet: 'NASA EONET',
};

const sourceFallbackNames: Record<(typeof SOURCE_ORDER)[number], string> = {
  usgs: 'USGS Earthquake Catalog',
  gdacs: 'GDACS',
  eonet: 'NASA EONET',
};

const statusStyles = {
  operational: {
    label: 'Operational',
    icon: CheckCircle2,
    dot: 'bg-success-500',
    chip: 'border-success-500/30 bg-success-500/10 text-success-300',
    text: 'text-success-300',
  },
  degraded: {
    label: 'Degraded',
    icon: AlertTriangle,
    dot: 'bg-warning-500',
    chip: 'border-warning-500/30 bg-warning-500/10 text-warning-300',
    text: 'text-warning-300',
  },
  fallback: {
    label: 'Status unavailable',
    icon: Server,
    dot: 'bg-slate-500',
    chip: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    text: 'text-slate-300',
  },
};

function sourceLabel(code: string): string {
  return sourceLabels[code as keyof typeof sourceLabels] ?? code.toUpperCase();
}

function sourceDisplayName(code: string, source?: LiveUsgsSourceStatus): string {
  const fallback = sourceFallbackNames[code as keyof typeof sourceFallbackNames] ?? sourceLabel(code);
  return source?.display_name || fallback;
}

function humanizeSourceMode(mode?: string | null): string {
  if (mode === 'live_source') {
    return 'Live Source';
  }

  return 'Source status';
}

function statusConfig(status?: string | null) {
  if (status === 'operational') {
    return statusStyles.operational;
  }

  if (status === 'degraded') {
    return statusStyles.degraded;
  }

  return {
    ...statusStyles.fallback,
    label: status ? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : statusStyles.fallback.label,
  };
}

function relativeTime(value?: string | null): string {
  if (!value) {
    return 'No successful refresh recorded';
  }

  const date = new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return 'Refresh time unavailable';
  }

  const diffMs = Date.now() - timestamp;
  const absDiffMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let relative: string;
  if (absDiffMs < minute) {
    relative = 'just now';
  } else if (absDiffMs < hour) {
    const minutes = Math.max(1, Math.round(absDiffMs / minute));
    relative = `${minutes}m ${diffMs >= 0 ? 'ago' : 'from now'}`;
  } else if (absDiffMs < day) {
    const hours = Math.max(1, Math.round(absDiffMs / hour));
    relative = `${hours}h ${diffMs >= 0 ? 'ago' : 'from now'}`;
  } else {
    const days = Math.max(1, Math.round(absDiffMs / day));
    relative = `${days}d ${diffMs >= 0 ? 'ago' : 'from now'}`;
  }

  const localTime = date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${relative} · ${localTime}`;
}

function sourceMessage(source?: LiveUsgsSourceStatus): string {
  if (!source) {
    return 'Source status has not been returned by the public source registry yet.';
  }

  if (source.ingestion_status === 'degraded') {
    return 'The provider is temporarily unavailable. Sentinel Atlas is retaining previously verified records.';
  }

  if (source.ingestion_status === 'operational') {
    return 'Live refreshes are operating normally.';
  }

  return 'Sentinel Atlas is retaining the latest available source-backed records while this source status is reviewed.';
}

function countRecordsForSource(records: LiveUsgsIncidentRecord[], code: string): number {
  return records.filter((record) => record.source_code === code).length;
}

function LiveSourceHealthRow({
  code,
  source,
  activeRecordCount,
}: {
  code: (typeof SOURCE_ORDER)[number];
  source?: LiveUsgsSourceStatus;
  activeRecordCount: number;
}) {
  const status = statusConfig(source?.ingestion_status);
  const StatusIcon = status.icon;

  return (
    <li
      className="grid gap-4 border-t border-ink-700/70 px-4 py-4 first:border-t-0 sm:grid-cols-[1.1fr_0.8fr_1.4fr] sm:items-center lg:px-5"
      aria-label={`${sourceLabel(code)} source health`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">{sourceDisplayName(code, source)}</h3>
          <span className="chip border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            {sourceLabel(code)}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{humanizeSourceMode(source?.source_mode)}</p>
      </div>

      <div className="space-y-2">
        <span
          className={`chip ${status.chip}`}
          aria-label={`${sourceLabel(code)} status: ${status.label}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Database className="h-3.5 w-3.5 text-slate-500" />
          <span>{activeRecordCount} active stored record{activeRecordCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="min-w-0">
        <p className={`flex items-start gap-2 text-xs leading-relaxed ${status.text}`}>
          <StatusIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{sourceMessage(source)}</span>
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>Last successful refresh: {relativeTime(source?.last_success_at)}</span>
        </p>
      </div>
    </li>
  );
}

export function LiveSourceHealthPanel({
  state,
  sources,
  records,
  onRefresh,
}: {
  state: LiveUsgsState;
  sources: LiveUsgsSourceStatus[];
  records: LiveUsgsIncidentRecord[];
  onRefresh: () => void;
}) {
  const sourcesByCode = new Map(sources.map((source) => [source.code, source]));
  const hasSources = sources.length > 0;
  const loading = state === 'loading';
  const error = state === 'error' || state === 'unconfigured';

  return (
    <section aria-labelledby="live-source-health-heading">
      <SectionHeader
        title="Live Source Health"
        icon={Server}
        action={
          <button
            type="button"
            onClick={onRefresh}
            className="btn-secondary px-3 py-2 text-xs"
            disabled={loading}
            aria-label="Refresh live source health"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      />

      <div className="panel ambient-sweep-bg overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-ink-700/70 px-4 py-4 lg:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="live-source-health-heading" className="text-sm font-semibold text-slate-100">
              Provider refresh status
            </h3>
            <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
              Public source registry
            </span>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
            Stored incidents remain available when a provider has a temporary upstream issue. Internal errors,
            request details, and credentials are never shown here.
          </p>
        </div>

        {loading && !hasSources ? (
          <div className="space-y-0" aria-live="polite" aria-label="Loading live source health">
            {SOURCE_ORDER.map((code) => (
              <div
                key={code}
                className="grid gap-4 border-t border-ink-700/70 px-4 py-4 first:border-t-0 sm:grid-cols-[1.1fr_0.8fr_1.4fr] lg:px-5"
              >
                <div>
                  <div className="h-3 w-40 rounded-full skeleton-shimmer" />
                  <div className="mt-3 h-3 w-24 rounded-full skeleton-shimmer" />
                </div>
                <div>
                  <div className="h-6 w-28 rounded-full skeleton-shimmer" />
                  <div className="mt-3 h-3 w-32 rounded-full skeleton-shimmer" />
                </div>
                <div>
                  <div className="h-3 w-full rounded-full skeleton-shimmer" />
                  <div className="mt-3 h-3 w-2/3 rounded-full skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : hasSources ? (
          <ul className="divide-y-0" aria-live="polite">
            {SOURCE_ORDER.map((code) => (
              <LiveSourceHealthRow
                key={code}
                code={code}
                source={sourcesByCode.get(code)}
                activeRecordCount={countRecordsForSource(records, code)}
              />
            ))}
          </ul>
        ) : (
          <div className="px-4 py-5 lg:px-5" aria-live="polite">
            <div
              className={`rounded-lg border p-4 text-sm ${
                error
                  ? 'border-warning-500/20 bg-warning-500/10 text-warning-200'
                  : 'border-ink-700/70 bg-ink-900/60 text-slate-400'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {state === 'unconfigured'
                      ? 'Live source health is unavailable in this browser session.'
                      : state === 'empty'
                        ? 'No live source status rows are currently available.'
                        : 'Live source health could not be loaded.'}
                  </p>
                  <p className="mt-1 text-xs opacity-90">
                    Sentinel Atlas will continue to show any already stored public records that are available to this
                    browser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default LiveSourceHealthPanel;
