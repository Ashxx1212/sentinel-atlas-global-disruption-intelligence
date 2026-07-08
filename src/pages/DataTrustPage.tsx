import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Globe2,
  Lock,
  MapPin,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { mockSources } from '../data/mockIncidents';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { PageHeader, SectionHeader } from '../components/ui';
import { useLiveUsgsIncidents } from '../hooks/useLiveUsgsIncidents';
import type { LiveUsgsSourceStatus } from '../types/liveIntelligence';
import { AuthGate } from '../components/AuthGate';
import { SourceOperationsPanel } from '../components/SourceOperationsPanel';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

function liveSourceLabel(code: string, fallbackName: string): string {
  if (code === 'usgs') return 'USGS Earthquake Catalog';
  if (code === 'eonet') return 'NASA EONET';
  if (code === 'gdacs') return 'GDACS';
  return fallbackName || code.toUpperCase();
}

function liveSourceSubtitle(code: string): string {
  if (code === 'usgs') return 'U.S. Geological Survey earthquake event metadata';
  if (code === 'eonet') return 'NASA Earth Observatory Natural Event Tracker';
  if (code === 'gdacs') return 'Global Disaster Alert and Coordination System awareness metadata';
  return 'Live source-backed records';
}

function liveSourceRole(code: string): string {
  if (code === 'usgs') {
    return 'Earthquake event catalog used for source-backed seismic incident records.';
  }

  if (code === 'eonet') {
    return 'Environmental event catalog used for wildfire, volcano, flood, and severe-weather context.';
  }

  if (code === 'gdacs') {
    return 'Awareness and coordination metadata. It is not presented as an official emergency warning.';
  }

  return 'Source-backed event metadata stored in Sentinel Atlas.';
}

function LiveSourceCard({
  source,
  count,
  loading,
  onRefresh,
}: {
  source: LiveUsgsSourceStatus;
  count: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const operational =
    source.source_mode === 'live_source' &&
    source.ingestion_status === 'operational';

  return (
    <div className="panel ambient-sweep-bg relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {liveSourceLabel(source.code, source.display_name)}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {liveSourceSubtitle(source.code)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-ghost"
          aria-label={`Refresh ${liveSourceLabel(source.code, source.display_name)} layer`}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-200">
        {operational ? (
          <CheckCircle2 className="h-4 w-4 text-success-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-warning-400" />
        )}
        <span>
          {operational
            ? 'Live source operational'
            : source.ingestion_status ?? 'Status unavailable'}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        {liveSourceRole(source.code)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span className="chip border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          {count} active stored record{count === 1 ? '' : 's'}
        </span>
        <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
          {source.ingestion_status ?? 'status unavailable'}
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-ink-700/60 bg-ink-900/50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Last successful ingestion
        </p>
        <p className="mt-1 text-xs text-slate-300">
          {formatTimestamp(source.last_success_at)}
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Sentinel Atlas stores provider observations and exposes integrity labels.
        It does not independently validate provider observations or issue emergency orders.
      </p>
    </div>
  );
}

function PrototypeSourceCard({ source }: { source: (typeof mockSources)[number] }) {
  return (
    <div className="panel panel-hover p-4 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{source.shortName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{source.name}</p>
        </div>
        <span className="chip border-warning-500/20 bg-warning-500/10 text-warning-300">
          Prototype fixture
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">
        {source.description}
      </p>
      <div className="mt-3 space-y-2 border-t border-ink-700/60 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Coverage</span>
          <span className="text-slate-300">{source.coverage}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Data role</span>
          <span className="text-slate-300">{source.dataUseRole}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Fixture refresh</span>
          <span className="font-mono text-cyan-300">
            {formatTimestamp(source.lastSync)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TrustModelCard({
  title,
  body,
  icon: Icon,
  to,
  action,
}: {
  title: string;
  body: string;
  icon: typeof ShieldCheck;
  to?: string;
  action?: string;
}) {
  const content = (
    <div className="panel panel-hover group h-full p-4 transition-all">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
          <Icon className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
          {action ? (
            <p className="mt-3 text-xs font-medium text-cyan-300 transition-colors group-hover:text-cyan-200">
              {action}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

export function DataTrustPage() {
  const { state, records, sources, errorMessage, refresh } = useLiveUsgsIncidents();
  const liveSourceCodes = useMemo(
    () => new Set(sources.map((source) => source.code)),
    [sources],
  );
  const fixtureSources = mockSources.filter(
    (sourceItem) => !liveSourceCodes.has(sourceItem.id),
  );
  const recordCountByCode = useMemo(() => {
    const counts = new Map<string, number>();
    records.forEach((record) => {
      if (!record.source_code) return;
      counts.set(record.source_code, (counts.get(record.source_code) ?? 0) + 1);
    });
    return counts;
  }, [records]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <div id="public-data-trust" className="scroll-mt-24">
        <PageHeader
          title="Data Trust"
          subtitle="How Sentinel Atlas separates live source records, prototype fixtures, integrity labels, private alerts, and sanitized operations history."
        >
          <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            Source-backed transparency
          </span>
        </PageHeader>
      </div>

      {/* Trust model */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TrustModelCard
          title="Live source records"
          body="USGS, GDACS, and NASA EONET records are stored as source-backed metadata with provider timestamps, source labels, and integrity states."
          icon={Database}
          to="/global-map"
          action="Open Global Map"
        />
        <TrustModelCard
          title="Prototype fixtures"
          body="Some demo context remains intentionally labeled as prototype fixture data. It should not be confused with live source observations."
          icon={Globe2}
          to="/incidents"
          action="Review Incident Rooms"
        />
        <TrustModelCard
          title="Private alert evaluator"
          body="Server-side matching compares newly changed source-backed incidents against saved watchlist locations and enabled alert rules."
          icon={Bell}
          to="/alerts"
          action="Open Notification Centre"
        />
        <TrustModelCard
          title="Browser safety model"
          body="Browser code can read account-scoped rows and mark notifications read, but it cannot create private alert notifications or trigger protected ingestion."
          icon={Lock}
          to="/settings"
          action="Review Settings"
        />
      </div>

      {/* Integrity labels explanation */}
      <div className="mb-8">
        <SectionHeader title="Integrity Labels" icon={ShieldCheck} />
        <div className="panel p-5">
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Every surfaced record carries an integrity label so users can tell whether
            a value is a stored source observation, forecast-style context, pending
            metadata, or unavailable data. Labels describe the state of the data inside
            Sentinel Atlas. They are not emergency-certification badges, because apparently
            dashboards should not cosplay as disaster agencies.
          </p>
          <DataIntegrityPanel variant="list" />
        </div>
      </div>

      {/* Source cards */}
      <div className="mb-8">
        <SectionHeader title="Data Sources" icon={Database} />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          {state === 'loading' && sources.length === 0 ? (
            <div className="panel ambient-sweep-bg relative overflow-hidden p-4">
              <div className="mt-4 space-y-3">
                <div className="h-3 w-2/3 rounded-full skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded-full skeleton-shimmer" />
                <div className="h-3 w-3/4 rounded-full skeleton-shimmer" />
              </div>
            </div>
          ) : null}

          {sources.map((source) => (
            <LiveSourceCard
              key={source.id}
              source={source}
              count={recordCountByCode.get(source.code) ?? 0}
              loading={state === 'loading'}
              onRefresh={() => {
                void refresh(true);
              }}
            />
          ))}

          {sources.length === 0 && state === 'empty' ? (
            <div className="panel ambient-sweep-bg relative overflow-hidden p-4">
              <div className="mt-4 rounded-lg border border-ink-700/60 bg-ink-900/60 p-3 text-sm text-slate-400">
                No active stored live source records are currently available.
              </div>
            </div>
          ) : null}

          {sources.length === 0 && state === 'unconfigured' ? (
            <div className="panel ambient-sweep-bg relative overflow-hidden p-4">
              <div className="mt-4 rounded-lg border border-warning-500/20 bg-warning-500/10 p-3 text-sm text-warning-300">
                The live source layer is unavailable because Supabase configuration is missing in this browser session.
              </div>
            </div>
          ) : null}

          {sources.length === 0 && state === 'error' ? (
            <div className="panel ambient-sweep-bg relative overflow-hidden p-4">
              <div className="mt-4 rounded-lg border border-error-500/20 bg-error-500/10 p-3 text-sm text-error-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Stored source data is temporarily unavailable.</span>
                </div>
                <p className="mt-2 text-xs text-error-200/90">
                  {errorMessage ?? 'The source query failed.'}
                </p>
              </div>
            </div>
          ) : null}

          {fixtureSources.map((sourceItem) => (
            <PrototypeSourceCard key={sourceItem.id} source={sourceItem} />
          ))}
        </div>
      </div>

      {/* Authenticated Source Operations */}
      <div className="mb-8">
        <AuthGate
          title="Source Operations"
          description="Sign in to view sanitized ingestion history, safe run outcomes, retry summaries, and retained-record status."
        >
          <SourceOperationsPanel />
        </AuthGate>
      </div>

      {/* Alert evaluator explanation */}
      <div className="mb-8">
        <SectionHeader title="Private Alert Evaluator" icon={Bell} />
        <div className="panel p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4">
              <MapPin className="h-4 w-4 text-cyan-300" />
              <h3 className="mt-2 text-sm font-semibold text-slate-100">
                Saved locations
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Users define radius-based watchlist locations from Settings. These rows are account-scoped.
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4">
              <Settings className="h-4 w-4 text-cyan-300" />
              <h3 className="mt-2 text-sm font-semibold text-slate-100">
                Alert rules
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Rules filter hazard type, minimum severity, distance cap, and optional single-location scope.
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4">
              <Bell className="h-4 w-4 text-cyan-300" />
              <h3 className="mt-2 text-sm font-semibold text-slate-100">
                Private notifications
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Matching creates private in-app notifications server-side. Browser code cannot insert alert rows.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/settings" className="btn-secondary text-xs">
              <Settings className="h-3.5 w-3.5" />
              Manage rules
            </Link>
            <Link to="/alerts" className="btn-secondary text-xs">
              <Bell className="h-3.5 w-3.5" />
              View alerts
            </Link>
            <Link to="/global-map" className="btn-secondary text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Open map
            </Link>
          </div>
        </div>
      </div>

      {/* Trust commitment */}
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <Radio className="h-5 w-5 flex-shrink-0 text-cyan-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Our Data Commitment
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              This interface combines source-backed records with clearly labeled local
              prototype fixtures. No public-source data is presented as an operational
              warning. Every record is labeled with its integrity state and traceable
              back to its displayed origin where source metadata is available.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'No emergency-warning claims',
                'Clear source traceability',
                'Integrity labels everywhere',
                'Private alerts are server-created',
                'No browser-triggered ingestion',
              ].map((commit) => (
                <span
                  key={commit}
                  className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300"
                >
                  {commit}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTrustPage;
