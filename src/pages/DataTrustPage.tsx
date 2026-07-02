import { ShieldCheck, Activity, Radio, Database, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { mockSources } from '../data/mockIncidents';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { PageHeader, PrototypeNotice, SectionHeader } from '../components/ui';
import { useLiveUsgsIncidents } from '../hooks/useLiveUsgsIncidents';

// Ingestion health timeline data (mock)
const timelineEvents = [
  { time: '06:45Z', label: 'Open-Meteo fixture refreshed', status: 'operational' },
  { time: '06:42Z', label: 'USGS fixture refreshed', status: 'operational' },
  { time: '06:38Z', label: 'NASA EONET fixture refreshed', status: 'operational' },
  { time: '06:30Z', label: 'GDACS fixture refreshed (degraded)', status: 'degraded' },
  { time: '05:30Z', label: 'GDACS simulated partial timeout', status: 'degraded' },
  { time: '04:12Z', label: 'USGS simulated seismic event', status: 'operational' },
  { time: '03:40Z', label: 'Open-Meteo simulated forecast update', status: 'operational' },
  { time: '02:00Z', label: 'Open-Meteo simulated weather event', status: 'operational' },
];

const statusConfig = {
  operational: { dot: 'bg-success-500', text: 'text-success-400' },
  degraded: { dot: 'bg-warning-500', text: 'text-warning-400' },
  offline: { dot: 'bg-error-500', text: 'text-error-400' },
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

function PrototypeSourceCard({ source }: { source: (typeof mockSources)[number] }) {
  return (
    <div className="panel panel-hover p-4 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{source.shortName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{source.name}</p>
        </div>
        <span className="chip border-warning-500/20 bg-warning-500/10 text-warning-300">
          Prototype fixture · live ingestion planned
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-400 leading-relaxed">{source.description}</p>
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
          <span className="text-slate-500">Last refresh</span>
          <span className="font-mono text-cyan-300">{formatTimestamp(source.lastSync)}</span>
        </div>
      </div>
    </div>
  );
}

export function DataTrustPage() {
  const { state, source, recordCount, errorMessage, refresh } = useLiveUsgsIncidents();
  const fixtureSources = mockSources.filter((sourceItem) => sourceItem.id !== 'usgs');

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Data Trust"
        subtitle="How Sentinel Atlas labels, sources, and verifies intelligence data. This interface uses local prototype fixtures."
      >
        <PrototypeNotice />
      </PageHeader>

      {/* Integrity labels explanation */}
      <div className="mb-8">
        <SectionHeader title="Integrity Labels" icon={ShieldCheck} />
        <div className="panel p-5">
          <p className="mb-4 text-sm text-slate-400 leading-relaxed">
            Every data point in Sentinel Atlas carries one of four integrity labels.
            These labels help you distinguish confirmed observations from model
            projections, pending verifications, and unavailable data — so you always
            know what you can rely on.
          </p>
          <DataIntegrityPanel variant="list" />
        </div>
      </div>

      {/* Source cards */}
      <div className="mb-8">
        <SectionHeader title="Data Sources" icon={Database} />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="panel ambient-sweep-bg relative overflow-hidden p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{source?.display_name ?? 'USGS'}</h3>
                <p className="mt-0.5 text-xs text-slate-500">U.S. Geological Survey</p>
              </div>
              <button
                type="button"
                onClick={() => { void refresh(true); }}
                className="btn-ghost"
                aria-label="Refresh stored USGS layer"
                disabled={state === 'loading'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {state === 'loading' ? (
              <div className="mt-4 space-y-3">
                <div className="h-3 w-2/3 rounded-full skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded-full skeleton-shimmer" />
                <div className="h-3 w-3/4 rounded-full skeleton-shimmer" />
              </div>
            ) : state === 'success' ? (
              <>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-success-400" />
                  <span>{source?.source_mode === 'live_source' && source?.ingestion_status === 'operational' ? 'Live source connected' : 'Stored source layer available'}</span>
                </div>
                <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                  Latest successful ingestion: {formatTimestamp(source?.last_success_at ?? null)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className="chip border-cyan-500/20 bg-cyan-500/10 text-cyan-300">{recordCount} active stored records</span>
                  <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">{source?.ingestion_status ?? 'status unavailable'}</span>
                </div>
                <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                  Source-backed records stored in Sentinel Atlas.
                </p>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Sentinel Atlas does not independently validate USGS observations.
                </p>
              </>
            ) : state === 'empty' ? (
              <div className="mt-4 rounded-lg border border-ink-700/60 bg-ink-900/60 p-3 text-sm text-slate-400">
                No active stored USGS earthquake records are currently available.
              </div>
            ) : state === 'unconfigured' ? (
              <div className="mt-4 rounded-lg border border-warning-500/20 bg-warning-500/10 p-3 text-sm text-warning-300">
                The live source layer is unavailable because Supabase configuration is missing in this browser session.
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-error-500/20 bg-error-500/10 p-3 text-sm text-error-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Stored source data is temporarily unavailable.</span>
                </div>
                <p className="mt-2 text-xs text-error-200/90">{errorMessage ?? 'The source query failed.'}</p>
              </div>
            )}
          </div>

          {fixtureSources.map((sourceItem) => (
            <PrototypeSourceCard key={sourceItem.id} source={sourceItem} />
          ))}
        </div>
      </div>

      {/* Ingestion health timeline */}
      <div className="mb-8">
        <SectionHeader title="Fixture Refresh Timeline" icon={Activity} />
        <div className="panel p-5">
          <p className="mb-4 text-xs text-slate-500">
            Simulated fixture refresh events over the last 12 hours. All timestamps are UTC. No live data is ingested.
          </p>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/40 via-ink-600 to-transparent" />
            <div className="space-y-3">
              {timelineEvents.map((event, idx) => {
                const c = statusConfig[event.status as keyof typeof statusConfig];
                return (
                  <div
                    key={idx}
                    className="relative flex items-center gap-4 animate-slide-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="relative z-10 flex-shrink-0">
                      <div className={`h-3.5 w-3.5 rounded-full border-2 border-ink-900 ${c.dot}`} />
                    </div>
                    <div className="flex flex-1 items-center justify-between">
                      <span className="text-sm text-slate-300">{event.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                        <span className="font-mono text-xs text-slate-500">{event.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Trust commitment */}
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <Radio className="h-5 w-5 flex-shrink-0 text-cyan-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Our Data Commitment</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              This interface currently uses local prototype fixtures. No live public-source
              data is ingested in this build. Every record is clearly labelled with its
              integrity status. When the full platform launches, all source data will be
              traceable back to its origin record.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['No fabricated data', 'Full source traceability', 'Clear integrity labelling', 'No implied verification'].map((commit) => (
                <span key={commit} className="chip border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
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
