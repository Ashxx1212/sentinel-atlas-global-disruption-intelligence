import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Bell,
  Server,
  Radio,
  ArrowRight,
  Clock,
  MapPin,
  Info,
  RefreshCw,
  DatabaseZap,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  mockSources,
  mockPriorityRegions,
  hazardTypeLabels,
} from '../data/mockIncidents';
import type { PriorityRegion } from '../types';
import type { HybridIncident } from '../types/hybridIntelligence';
import { MetricCard } from '../components/MetricCard';
import { SeverityBadge } from '../components/SeverityBadge';
import { LiveSourceHealthPanel } from '../components/LiveSourceHealthPanel';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { IncidentMapWorkspace } from '../components/IncidentMapWorkspace';
import { IncidentDrawer } from '../components/IncidentDrawer';
import { PageHeader, SectionHeader } from '../components/ui';
import { useLiveUsgsIncidents } from '../hooks/useLiveUsgsIncidents';
import { useHybridIncidents } from '../hooks/useHybridIncidents';
import { useNotifications } from '../contexts/NotificationContext';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const severityDot: Record<string, string> = {
  critical: 'bg-error-500',
  high: 'bg-orange-500',
  elevated: 'bg-yellow-500',
  advisory: 'bg-slate-500',
};

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

function statusTone(state: string): string {
  switch (state) {
    case 'success':
      return 'text-success-400';
    case 'loading':
      return 'text-cyan-300';
    case 'empty':
      return 'text-slate-400';
    case 'unconfigured':
      return 'text-warning-400';
    default:
      return 'text-error-400';
  }
}

export function CommandCentrePage() {
  const navigate = useNavigate();
  const [drawerIncident, setDrawerIncident] = useState<HybridIncident | null>(null);
  const { state, records, sources, recordCount, errorMessage, refresh } = useLiveUsgsIncidents();
  const {
    incidents: commandMapIncidents,
    state: hybridState,
    refresh: refreshHybridIncidents,
  } = useHybridIncidents();
  const { notifications, unreadCount } = useNotifications();

  const refreshDashboard = () => {
    void Promise.all([refresh(true), refreshHybridIncidents(true)]);
  };
  const latestLiveSourceSuccess = useMemo(() => {
    const timestamps = sources
      .map((source) => source.last_success_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return timestamps[0] ?? null;
  }, [sources]);
  
  const liveSourceCodes = useMemo(() => new Set(sources.map((source) => source.code)), [sources]);
  const prototypeSourceCount = useMemo(
    () => mockSources.filter((source) => !liveSourceCodes.has(source.id)).length,
    [liveSourceCodes],
  );
  const operationalLiveSourceCount = useMemo(
    () =>
      sources.filter(
        (source) => source.source_mode === 'live_source' && source.ingestion_status === 'operational',
      ).length,
    [sources],
  );
  const degradedLiveSourceCount = useMemo(
  () =>
    sources.filter(
      (source) => source.source_mode === 'live_source' && source.ingestion_status === 'degraded',
    ).length,
  [sources],
);

const sourceHealthSublabel = useMemo(() => {
  const degradedLabel =
    degradedLiveSourceCount > 0
      ? `${degradedLiveSourceCount} degraded source${
          degradedLiveSourceCount === 1 ? '' : 's'
        }`
      : 'all live sources healthy';

  const fixtureLabel = `${prototypeSourceCount} prototype fixture${
    prototypeSourceCount === 1 ? '' : 's'
  }`;

  return `${degradedLabel} · ${fixtureLabel}`;
}, [degradedLiveSourceCount, prototypeSourceCount]);

  const activeCount = useMemo(
    () => commandMapIncidents.filter((incident) => incident.status === 'active').length,
    [commandMapIncidents],
  );
  const liveIncidentCount = useMemo(
    () => commandMapIncidents.filter((incident) => incident.dataMode === 'live_source').length,
    [commandMapIncidents],
  );
  const fixtureIncidentCount = useMemo(
    () => commandMapIncidents.filter((incident) => incident.dataMode === 'prototype_fixture').length,
    [commandMapIncidents],
  );
  const priorityIncidents = useMemo(
    () =>
      commandMapIncidents
        .filter((incident) =>
          incident.severity === 'critical' ||
          incident.severity === 'high' ||
          incident.severity === 'elevated',
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [commandMapIncidents],
  );
  const priorityIncidentCount = priorityIncidents.length;
  const recentPriorityIncidents = priorityIncidents.slice(0, 6);
  const dashboardLoading = state === 'loading' || hybridState === 'loading';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Global Disruption Overview"
        subtitle="Hybrid operations dashboard for source-backed incidents, private alerts, source health, and prototype context."
      >
        <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
          Hybrid command layer
        </span>
      </PageHeader>

      {/* Metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <button
          onClick={() => navigate('/incidents')}
          className="text-left"
          aria-label="View active incidents"
        >
          <MetricCard
            label="Active Incidents"
            value={activeCount}
            icon={Activity}
            accent="cyan"
            sublabel={`${liveIncidentCount} live source · ${fixtureIncidentCount} fixture`}
          />
        </button>
        <button
          onClick={() => navigate('/incidents')}
          className="text-left"
          aria-label="View priority incidents"
        >
          <MetricCard
            label="Priority Incidents"
            value={priorityIncidentCount}
            icon={AlertOctagon}
            accent="high"
            sublabel="Elevated, high, and critical records"
          />
        </button>
        <button
          onClick={() => navigate('/alerts')}
          className="text-left"
          aria-label="View private alerts"
        >
          <MetricCard
            label="Private Alerts"
            value={unreadCount}
            icon={Bell}
            accent="elevated"
            sublabel={`${notifications.length} total notification${notifications.length === 1 ? '' : 's'}`}
          />
        </button>
        <button
          onClick={() => navigate('/data-trust')}
          className="text-left"
          aria-label="View source health"
        >
          <MetricCard
            label="Source Health"
            value={`${operationalLiveSourceCount} operational`}
            icon={Server}
            accent="cyan"
            sublabel={sourceHealthSublabel}
          />
        </button>
      </div>

      <div className="mt-6 panel ambient-sweep-bg relative overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <SectionHeader title="LIVE SOURCE RECORDS" icon={Activity} />
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Stored USGS, NASA EONET, and GDACS records are surfaced here as a read-only layer inside Sentinel Atlas. GDACS provides awareness and coordination metadata, not official emergency warnings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshDashboard}
              className="btn-secondary"
              disabled={dashboardLoading}
            >
              <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
              {dashboardLoading ? 'Refreshing dashboard data...' : 'Refresh dashboard data'}
            </button>
            <Link to="/global-map" className="btn-primary">
              <MapPin className="h-4 w-4" />
              View Global Map
            </Link>
          </div>
        </div>

        {state === 'loading' ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-4">
              <div className="h-3 w-28 rounded-full skeleton-shimmer" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-3/4 rounded-full skeleton-shimmer" />
                <div className="h-4 w-2/3 rounded-full skeleton-shimmer" />
                <div className="h-4 w-1/2 rounded-full skeleton-shimmer" />
              </div>
            </div>
            <div className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-4">
              <div className="h-3 w-24 rounded-full skeleton-shimmer" />
              <div className="mt-4 space-y-3">
                <div className="h-10 w-full rounded-lg skeleton-shimmer" />
                <div className="h-10 w-full rounded-lg skeleton-shimmer" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                {state === 'success' ? <CheckCircle2 className="h-4 w-4 text-success-400" /> : state === 'error' ? <AlertTriangle className="h-4 w-4 text-error-400" /> : state === 'empty' ? <DatabaseZap className="h-4 w-4 text-slate-400" /> : <AlertTriangle className="h-4 w-4 text-warning-400" />}
                <span>
  {state === 'success'
    ? 'Live source registry available'
    : state === 'unconfigured'
      ? 'Source connection unavailable'
      : state === 'empty'
        ? 'No active stored records currently available'
        : state === 'error'
          ? 'Stored layer unavailable'
          : 'Retrieving stored live source records'}
</span>
              </div>
              <p className={`mt-3 text-sm ${statusTone(state)}`}>
                {state === 'success'
                 ? 'Stored source records are available from the most recent successful ingestion snapshot.'
                 : state === 'empty'
               ? 'No active stored live source records are currently available in Sentinel Atlas.'
               : state === 'unconfigured'
              ? 'Supabase is not configured in this browser session, so the layer remains gracefully unavailable.'
              : state === 'error'
            ? errorMessage ?? 'The stored layer could not be loaded.'
            : 'Retrieving the latest stored live source records for this view.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="chip border-cyan-500/20 bg-cyan-500/10 text-cyan-300">{recordCount} active stored record{recordCount === 1 ? '' : 's'}</span>
                {sources.map((source) => (
                  <span key={source.id} className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                    {source.code.toUpperCase()}: {source.ingestion_status ?? 'status unavailable'}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Stored ingestion</p>
              <p className="mt-2 text-sm font-medium text-slate-200">
                {formatTimestamp(latestLiveSourceSuccess)}
              </p>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Source-backed records · Sentinel Atlas does not independently validate source observations.
              </p>
              <div className="mt-4 rounded-lg border border-ink-700/60 bg-ink-900/60 p-3 text-[11px] text-slate-500">
                {state === 'success'
                  ? 'Stored source records are now visible in the local dashboard layer.'
                  : state === 'empty'
                    ? 'No stored records are currently available for the active live source layer.'
                    : state === 'unconfigured'
                      ? 'The layer remains non-breaking and read-only while configuration is missing.'
                      : 'The live layer is temporarily unavailable while the stored data request is being retried.'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map + Intelligence Stream */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <SectionHeader title="Global Hazard Map" icon={MapPin} />
          <IncidentMapWorkspace
            incidents={commandMapIncidents}
            onMarkerClick={setDrawerIncident}
            className="h-[400px] lg:h-[480px]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {['critical', 'high', 'elevated', 'advisory'].map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${severityDot[s]}`} />
                <span className="text-xs text-slate-500 capitalize">{s}</span>
              </div>
            ))}
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-600">Real basemap · Live source records + prototype fixtures</span>
          </div>
        </div>

        {/* Recent priority incidents */}
        <div>
          <SectionHeader title="Recent Priority Incidents" icon={Radio} />
          <div className="panel h-[400px] overflow-y-auto p-3 lg:h-[480px]">
            {recentPriorityIncidents.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <CheckCircle2 className="mx-auto h-6 w-6 text-success-400" />
                  <p className="mt-2 text-sm text-slate-400">
                    No elevated, high, or critical records are currently visible.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Lower-severity advisory records may still appear on the map.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1 stagger-children">
                {recentPriorityIncidents.map((incident, idx) => (
                  <Link
                    key={incident.id}
                    to={`/incidents/${incident.id}`}
                    className="block rounded-lg border border-transparent p-3 transition-all hover:border-cyan-500/20 hover:bg-ink-800/40"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="relative mt-1 flex-shrink-0">
                        <span className={`h-2 w-2 rounded-full ${severityDot[incident.severity]}`} />
                        {idx === 0 ? (
                          <span className={`absolute inset-0 h-2 w-2 rounded-full ${severityDot[incident.severity]} animate-ping-slow`} />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={incident.severity} size="xs" />
                          <span className="text-[10px] text-slate-500">
                            {incident.dataMode === 'live_source' ? 'Live source' : 'Prototype fixture'}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-slate-200 leading-snug">
                          {incident.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          <span>{hazardTypeLabels[incident.hazardType]}</span>
                          <span>·</span>
                          <span>{incident.location}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {timeAgo(incident.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Source-backed and prototype records ordered by latest stored update.
          </p>
        </div>
      </div>

      {/* Priority Regions + Data Integrity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader title="Prototype Priority Regions" icon={Activity} />
          <div className="grid gap-3 sm:grid-cols-2 stagger-children">
            {mockPriorityRegions.map((region: PriorityRegion) => (
              <Link
                key={region.id}
                to="/global-map"
                className="panel panel-hover group p-4 transition-all"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                    {region.name}
                  </h3>
                  <SeverityBadge severity={region.topSeverity} size="xs" />
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {region.summary}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {region.incidentCount} active incident{region.incidentCount !== 1 ? 's' : ''}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Data Integrity" icon={Server} />
          <div className="panel p-4">
            <Link to="/data-trust" className="block">
              <DataIntegrityPanel variant="grid" />
            </Link>
            <p className="mt-3 text-[11px] text-slate-600">
              Every data point in Sentinel Atlas carries an integrity label.
            </p>
          </div>
        </div>
      </div>

      {/* Source Health */}
      <div className="mt-8">
        <LiveSourceHealthPanel
          state={state}
          sources={sources}
          records={records}
          onRefresh={() => { void refresh(true); }}
        />
      </div>

      {/* How this prototype works */}
      <div className="mt-8">
        <Link
          to="/data-trust"
          className="panel panel-hover group flex items-center gap-4 p-5 transition-all"
        >
          <div className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
            <Info className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
              How this prototype works
            </h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              This interface combines live source-backed records with clearly labeled prototype fixtures.
              Learn about integrity labels, ingestion health, and simulated context on the Data Trust page.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Incident preview drawer */}
      <IncidentDrawer
        incident={drawerIncident}
        onClose={() => setDrawerIncident(null)}
      />
    </div>
  );
}

export default CommandCentrePage;
