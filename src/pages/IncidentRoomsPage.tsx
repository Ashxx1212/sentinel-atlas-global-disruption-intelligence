import { useState, useMemo } from 'react';
import { DoorClosed, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { hazardTypeLabels } from '../data/mockIncidents';
import type { HazardType, Severity } from '../types';
import type { HybridIncidentDataMode } from '../types/hybridIntelligence';
import { useHybridIncidents } from '../hooks/useHybridIncidents';
import { IncidentCard } from '../components/IncidentCard';
import { PageHeader, PrototypeNotice, EmptyState } from '../components/ui';

const hazardFilters: { value: HazardType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'earthquake', label: 'Earthquakes' },
  { value: 'wildfire', label: 'Wildfires' },
  { value: 'flood', label: 'Floods' },
  { value: 'cyclone', label: 'Cyclones' },
  { value: 'volcano', label: 'Volcanoes' },
  { value: 'severe-weather', label: 'Severe Weather' },
];

const severityFilters: { value: Severity | 'all'; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'advisory', label: 'Advisory' },
];

const dataModeFilters: { value: HybridIncidentDataMode | 'all'; label: string }[] = [
  { value: 'all', label: 'All records' },
  { value: 'live_source', label: 'Live source records' },
  { value: 'prototype_fixture', label: 'Prototype fixtures' },
];

export function IncidentRoomsPage() {
  const [search, setSearch] = useState('');
  const [hazardFilter, setHazardFilter] = useState<HazardType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [dataModeFilter, setDataModeFilter] = useState<HybridIncidentDataMode | 'all'>('all');
  const { incidents, state, errorMessage, refresh } = useHybridIncidents();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents.filter((i) => {
      if (dataModeFilter !== 'all' && i.dataMode !== dataModeFilter) return false;
      if (query) {
        const matches =
          i.title.toLowerCase().includes(query) ||
          i.location.toLowerCase().includes(query) ||
          hazardTypeLabels[i.hazardType].toLowerCase().includes(query) ||
          i.source.toLowerCase().includes(query) ||
          i.sourceName.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (hazardFilter !== 'all' && i.hazardType !== hazardFilter) return false;
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      return true;
    });
  }, [incidents, search, hazardFilter, severityFilter, dataModeFilter]);

  const isInitialLoading = state === 'loading' && incidents.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Incident Rooms"
        subtitle="Detailed rooms for every tracked disruption, with timelines, evidence, and context. Uses prototype fixture data."
      >
        <PrototypeNotice />
      </PageHeader>

      {/* Filters */}
      <div className="panel mb-6 p-4">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents by title, location, hazard, or source…"
              className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 transition-colors focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {dataModeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setDataModeFilter(f.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  dataModeFilter === f.value
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                    : 'border-ink-700/60 bg-ink-850/40 text-slate-400 hover:border-ink-600 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
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
      </div>

      {/* Result count */}
      <div className="mb-4 text-sm text-slate-400">
        Showing <span className="font-mono text-cyan-300">{filtered.length}</span> of <span className="font-mono text-cyan-300">{incidents.length}</span> records
      </div>

      {isInitialLoading && (
        <div className="panel p-6 text-sm text-slate-400">Loading incident rooms...</div>
      )}

      {state === 'error' && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-200 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {errorMessage ?? 'Incident rooms could not be loaded.'}
          </span>
          <button type="button" onClick={() => void refresh(true)} className="btn-secondary justify-center">
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {!isInitialLoading && filtered.length === 0 ? (
        <EmptyState
          icon={DoorClosed}
          title="No incidents found"
          message="No prototype incidents match your current filters. Try adjusting your search or filter criteria."
        />
      ) : !isInitialLoading ? (
        <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default IncidentRoomsPage;
