import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  DoorClosed,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { hazardTypeLabels } from '../data/mockIncidents';
import type { HazardType, Severity } from '../types';
import type { HybridIncidentDataMode } from '../types/hybridIntelligence';
import { useHybridIncidents } from '../hooks/useHybridIncidents';
import { IncidentCard } from '../components/IncidentCard';
import { EmptyState, PageHeader } from '../components/ui';

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

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  elevated: 2,
  advisory: 1,
};

function filterButtonClass(active: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
    active
      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
      : 'border-ink-700/60 bg-ink-850/40 text-slate-400 hover:border-ink-600 hover:text-slate-200'
  }`;
}

export function IncidentRoomsPage() {
  const [search, setSearch] = useState('');
  const [hazardFilter, setHazardFilter] = useState<HazardType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [dataModeFilter, setDataModeFilter] = useState<HybridIncidentDataMode | 'all'>('all');
  const { incidents, state, errorMessage, refresh } = useHybridIncidents();

  const counts = useMemo(() => {
    const liveCount = incidents.filter((incident) => incident.dataMode === 'live_source').length;
    const fixtureCount = incidents.filter((incident) => incident.dataMode === 'prototype_fixture').length;
    const priorityCount = incidents.filter(
      (incident) =>
        incident.severity === 'critical' ||
        incident.severity === 'high' ||
        incident.severity === 'elevated',
    ).length;

    return { liveCount, fixtureCount, priorityCount };
  }, [incidents]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents
      .filter((incident) => {
        if (dataModeFilter !== 'all' && incident.dataMode !== dataModeFilter) return false;
        if (hazardFilter !== 'all' && incident.hazardType !== hazardFilter) return false;
        if (severityFilter !== 'all' && incident.severity !== severityFilter) return false;

        if (query) {
          const searchable = [
            incident.title,
            incident.summary,
            incident.location,
            hazardTypeLabels[incident.hazardType],
            incident.source,
            incident.sourceName,
            incident.sourceLabel,
            incident.dataMode === 'live_source' ? 'live source record' : 'prototype fixture',
            incident.severity,
          ]
            .join(' ')
            .toLowerCase();

          if (!searchable.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const severityDelta = severityRank[b.severity] - severityRank[a.severity];
        if (severityDelta !== 0) return severityDelta;

        const liveDelta =
          Number(b.dataMode === 'live_source') - Number(a.dataMode === 'live_source');
        if (liveDelta !== 0) return liveDelta;

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [incidents, search, hazardFilter, severityFilter, dataModeFilter]);

  const isInitialLoading = state === 'loading' && incidents.length === 0;
  const hasFilters =
    search.trim().length > 0 ||
    hazardFilter !== 'all' ||
    severityFilter !== 'all' ||
    dataModeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setHazardFilter('all');
    setSeverityFilter('all');
    setDataModeFilter('all');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <PageHeader
        title="Incident Rooms"
        subtitle="Browse source-backed live incidents and clearly labeled prototype fixtures, then open the room for timelines, evidence, alerts, and trust context."
      >
        <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
          Hybrid incident index
        </span>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Live source records
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-cyan-300">
            {counts.liveCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">USGS, GDACS, and EONET-backed rows</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Prototype fixtures
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-warning-300">
            {counts.fixtureCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Demo context clearly labeled</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Priority records
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-cyan-300">
            {counts.priorityCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Elevated, high, or critical</p>
        </div>
      </div>

      {/* Filters */}
      <div className="panel mb-6 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search incidents by title, location, hazard, severity, source, or mode…"
                className="w-full rounded-lg border border-ink-700/60 bg-ink-850/60 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 transition-colors focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={state === 'loading'}
              className="btn-secondary justify-center"
            >
              <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
              {state === 'loading' ? 'Refreshing...' : 'Refresh records'}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Data mode
            </p>
            <div className="flex flex-wrap gap-2">
              {dataModeFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setDataModeFilter(filter.value)}
                  className={filterButtonClass(dataModeFilter === filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Hazard
            </p>
            <div className="flex flex-wrap gap-2">
              {hazardFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setHazardFilter(filter.value)}
                  className={filterButtonClass(hazardFilter === filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Severity
            </p>
            <div className="flex flex-wrap gap-2">
              {severityFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSeverityFilter(filter.value)}
                  className={filterButtonClass(severityFilter === filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/60 pt-3">
            <p className="text-sm text-slate-400">
              Showing <span className="font-mono text-cyan-300">{filtered.length}</span> of{' '}
              <span className="font-mono text-cyan-300">{incidents.length}</span> records
              <span className="ml-2 text-xs text-slate-600">
                ({counts.liveCount} live source / {counts.fixtureCount} fixture)
              </span>
            </p>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="panel p-6 text-sm text-slate-400">Loading hybrid incident rooms...</div>
      ) : null}

      {state === 'error' ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-200 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {errorMessage ?? 'Hybrid incident rooms could not be loaded.'}
          </span>
          <button
            type="button"
            onClick={() => void refresh(true)}
            className="btn-secondary justify-center"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : null}

      {/* Results */}
      {!isInitialLoading && filtered.length === 0 ? (
        <EmptyState
          icon={DoorClosed}
          title="No incident rooms found"
          message={
            incidents.length === 0
              ? 'No hybrid incident records are currently available.'
              : 'No incident rooms match your current filters. Try clearing search, data mode, hazard, or severity filters.'
          }
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
