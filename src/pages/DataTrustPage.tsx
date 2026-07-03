import { ShieldCheck, Activity, Radio, Database } from 'lucide-react';
import { mockSources } from '../data/mockIncidents';
import { SourceHealthCard } from '../components/SourceHealthCard';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { PageHeader, PrototypeNotice, SectionHeader } from '../components/ui';

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

export function DataTrustPage() {
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mockSources.map((source) => (
            <SourceHealthCard key={source.id} source={source} />
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
