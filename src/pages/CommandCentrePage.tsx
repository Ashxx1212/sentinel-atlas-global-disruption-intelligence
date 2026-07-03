import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  Heart,
  Server,
  Radio,
  ArrowRight,
  Clock,
  MapPin,
  Info,
} from 'lucide-react';
import {
  mockIncidents,
  mockSources,
  mockPriorityRegions,
  mockIntelligenceStream,
  hazardTypeLabels,
} from '../data/mockIncidents';
import type { IntelligenceStreamEntry, PriorityRegion, Incident } from '../types';
import { MetricCard } from '../components/MetricCard';
import { SeverityBadge } from '../components/SeverityBadge';
import { SourceHealthCard } from '../components/SourceHealthCard';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { MockMapWorkspace } from '../components/MockMapWorkspace';
import { IncidentDrawer } from '../components/IncidentDrawer';
import { PageHeader, PrototypeNotice, SectionHeader } from '../components/ui';
import { useState } from 'react';

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

export function CommandCentrePage() {
  const navigate = useNavigate();
  const [drawerIncident, setDrawerIncident] = useState<Incident | null>(null);

  const activeCount = mockIncidents.filter((i) => i.status === 'active').length;
  const criticalCount = mockIncidents.filter((i) => i.severity === 'critical').length;
  const watchedAffected = 3;
  const operationalSources = mockSources.filter((s) => s.health === 'operational').length;

  const sortedStream = [...mockIntelligenceStream].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Global Disruption Overview"
        subtitle="Illustrative synthesis of active hazards, source health, and intelligence stream from prototype fixtures."
      >
        <PrototypeNotice />
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
            sublabel="Currently being tracked"
          />
        </button>
        <button
          onClick={() => navigate('/incidents?severity=critical')}
          className="text-left"
          aria-label="View critical incidents"
        >
          <MetricCard
            label="Critical Incidents"
            value={criticalCount}
            icon={AlertOctagon}
            accent="critical"
            sublabel="Requiring immediate attention"
          />
        </button>
        <button
          onClick={() => navigate('/my-world')}
          className="text-left"
          aria-label="View watched locations"
        >
          <MetricCard
            label="Watched Locations Affected"
            value={watchedAffected}
            icon={Heart}
            accent="elevated"
            sublabel="Of 3 watched locations"
          />
        </button>
        <button
          onClick={() => navigate('/data-trust')}
          className="text-left"
          aria-label="View source health"
        >
          <MetricCard
            label="Source Health"
            value={`${operationalSources}/${mockSources.length}`}
            icon={Server}
            accent="high"
            sublabel="Sources operational"
            trend="1 source degraded"
          />
        </button>
      </div>

      {/* Map + Intelligence Stream */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <SectionHeader title="Global Hazard Map" icon={MapPin} />
          <MockMapWorkspace
            incidents={mockIncidents}
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
            <span className="text-xs text-slate-600">Mock map · Prototype Fixture</span>
          </div>
        </div>

        {/* Intelligence Stream */}
        <div>
          <SectionHeader title="Intelligence Stream" icon={Radio} />
          <div className="panel h-[400px] overflow-y-auto p-3 lg:h-[480px]">
            <div className="space-y-1 stagger-children">
              {sortedStream.map((entry: IntelligenceStreamEntry, idx) => (
                <Link
                  key={entry.id}
                  to={`/incidents/${entry.incidentId}`}
                  className="block rounded-lg border border-transparent p-3 transition-all hover:border-cyan-500/20 hover:bg-ink-800/40"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative mt-1 flex-shrink-0">
                      <span className={`h-2 w-2 rounded-full ${severityDot[entry.severity]}`} />
                      {idx === 0 && (
                        <span className={`absolute inset-0 h-2 w-2 rounded-full ${severityDot[entry.severity]} animate-ping-slow`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-200 leading-snug">
                        {entry.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{hazardTypeLabels[entry.hazardType]}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Illustrative fixture activity — no live feed connected.
          </p>
        </div>
      </div>

      {/* Priority Regions + Data Integrity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader title="Priority Regions" icon={Activity} />
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
        <SectionHeader title="Source Health" icon={Server} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          {mockSources.map((source) => (
            <SourceHealthCard key={source.id} source={source} />
          ))}
        </div>
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
              This interface uses local prototype fixtures. No live public-source data is ingested.
              Learn about integrity labels and simulated source data on the Data Trust page.
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
