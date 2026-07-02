import { useState, useMemo } from 'react';
import { Filter, X, Layers, SearchX } from 'lucide-react';
import {
  mockIncidents,
  hazardTypeLabels,
} from '../data/mockIncidents';
import type { Incident, HazardType, Severity } from '../types';
import { MockMapWorkspace } from '../components/MockMapWorkspace';
import { IncidentDrawer } from '../components/IncidentDrawer';
import { SeverityBadge } from '../components/SeverityBadge';
import { PageHeader, PrototypeNotice } from '../components/ui';

const hazardFilters: { value: HazardType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Hazards' },
  { value: 'earthquake', label: 'Earthquakes' },
  { value: 'wildfire', label: 'Wildfires' },
  { value: 'flood', label: 'Floods' },
  { value: 'cyclone', label: 'Cyclones' },
  { value: 'volcano', label: 'Volcanoes' },
  { value: 'severe-weather', label: 'Severe Weather' },
];

const severityFilters: { value: Severity | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function GlobalMapPage() {
  const [hazardFilter, setHazardFilter] = useState<HazardType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const filteredIncidents = useMemo(() => {
    return mockIncidents.filter((i) => {
      if (hazardFilter !== 'all' && i.hazardType !== hazardFilter) return false;
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      return true;
    });
  }, [hazardFilter, severityFilter]);

  const hasFilters = hazardFilter !== 'all' || severityFilter !== 'all';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Global Map"
        subtitle="Full-page hazard workspace with severity and hazard-type filtering. Map positions are illustrative in Prototype Mode."
      >
        <PrototypeNotice />
      </PageHeader>

      {/* Filter bar */}
      <div className="panel mb-4 p-4">
        <div className="flex flex-col gap-4">
          {/* Hazard type filters */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Hazard Type
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {hazardFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setHazardFilter(f.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    hazardFilter === f.value
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-ink-700/60 bg-ink-850/40 text-slate-400 hover:border-ink-600 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity filters */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Severity
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {severityFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setSeverityFilter(f.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    severityFilter === f.value
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-ink-700/60 bg-ink-850/40 text-slate-400 hover:border-ink-600 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter summary */}
          <div className="flex items-center justify-between border-t border-ink-700/60 pt-3">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-mono text-cyan-300 transition-all duration-300">
                {filteredIncidents.length}
              </span>{' '}
              of{' '}
              <span className="font-mono text-slate-400">{mockIncidents.length}</span>{' '}
              prototype incidents
            </p>
            {hasFilters && (
              <button
                onClick={() => {
                  setHazardFilter('all');
                  setSeverityFilter('all');
                }}
                className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-cyan-300"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map workspace */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <MockMapWorkspace
            incidents={filteredIncidents}
            onMarkerClick={setSelectedIncident}
            selectedId={selectedIncident?.id}
            className="h-[400px] sm:h-[500px] lg:h-[600px]"
          />
          <p className="mt-2 text-xs text-slate-500">
            Map positions are illustrative in Prototype Mode.
          </p>
        </div>

        {/* Incident list sidebar */}
        <div className="lg:col-span-1">
          <div className="panel h-[400px] overflow-y-auto p-3 sm:h-[500px] lg:h-[600px]">
            <h3 className="px-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Incidents ({filteredIncidents.length})
            </h3>
            {filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <SearchX className="h-6 w-6 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No prototype incidents match these filters.</p>
                <p className="mt-1 text-xs text-slate-600">Try clearing a hazard or severity filter.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredIncidents.map((incident) => (
                  <button
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident)}
                    className={`block w-full rounded-lg border p-3 text-left transition-all ${
                      selectedIncident?.id === incident.id
                        ? 'border-cyan-500/40 bg-cyan-500/5'
                        : 'border-ink-700/60 bg-ink-850/40 hover:border-ink-600 hover:bg-ink-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} size="xs" />
                      <span className="text-[10px] text-slate-500">
                        {hazardTypeLabels[incident.hazardType]}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-slate-200 leading-snug">
                      {incident.title}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{incident.location}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer */}
      <IncidentDrawer
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
}

export default GlobalMapPage;
