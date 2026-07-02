import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Database,
  FileText,
  ExternalLink,
  CloudSun,
  Info,
  DoorClosed,
} from 'lucide-react';
import {
  getIncidentById,
  getRelatedIncidents,
  hazardTypeLabels,
} from '../data/mockIncidents';
import type { IncidentTab } from '../types';
import { SeverityBadge } from '../components/SeverityBadge';
import { IntegrityBadge, StatusBadge } from '../components/StatusBadge';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { IncidentCard } from '../components/IncidentCard';
import { MockMapWorkspace } from '../components/MockMapWorkspace';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { EmptyState } from '../components/ui';

const tabs: { value: IncidentTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'context', label: 'Context' },
];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}

export function IncidentRoomPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const [activeTab, setActiveTab] = useState<IncidentTab>('overview');

  const incident = incidentId ? getIncidentById(incidentId) : undefined;

  if (!incident) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Incident Rooms
        </Link>
        <div className="mt-8">
          <EmptyState
            icon={DoorClosed}
            title="Incident not found"
            message="This incident room does not exist or has been archived. This is a prototype state — no live data is available."
          />
        </div>
      </div>
    );
  }

  const related = getRelatedIncidents(incident);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      {/* Back link */}
      <Link
        to="/incidents"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-cyan-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Incident Rooms
      </Link>

      {/* Header */}
      <div className="mt-4 panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={incident.severity} withGlow />
              <StatusBadge status={incident.status} />
              <span className="text-xs text-slate-500">
                {hazardTypeLabels[incident.hazardType]}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-100 lg:text-3xl">
              {incident.title}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{incident.location}</p>
          </div>
          <div className="flex-shrink-0 space-y-2 lg:text-right">
            <div className="flex items-center gap-2 text-xs text-slate-400 lg:justify-end">
              <Database className="h-3.5 w-3.5 text-slate-500" />
              <span>Source: <span className="text-cyan-300">{incident.source}</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 lg:justify-end">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Updated {formatTimestamp(incident.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs lg:justify-end">
              <span className="text-slate-500">Integrity:</span>
              <IntegrityBadge status={incident.integrity} size="xs" />
            </div>
          </div>
        </div>

        {/* Freshness strip */}
        <div className="mt-4 flex items-center gap-3 border-t border-ink-700/60 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warning-500" />
            <span className="text-xs text-warning-400">Prototype fixture</span>
          </div>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-xs text-slate-500">
            Fixture refreshed {formatTimestamp(incident.updatedAt)}
          </span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-xs text-slate-500">
            {incident.coordinates.lat.toFixed(2)}°, {incident.coordinates.lng.toFixed(2)}°
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b border-ink-700/60">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`tab-button whitespace-nowrap ${
                activeTab === tab.value ? 'tab-button-active' : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content + related */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* Map thumbnail */}
              <div className="panel p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Location
                </h3>
                <MockMapWorkspace
                  incidents={[incident]}
                  interactive={false}
                  showLabels={false}
                  className="h-48"
                />
              </div>

              {/* Summary */}
              <div className="panel p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Summary
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">{incident.summary}</p>
              </div>

              {/* Meta */}
              <div className="panel p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Details
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-200">
                      <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                      {incident.location}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Coordinates</p>
                    <p className="mt-0.5 font-mono text-sm text-slate-200">
                      {incident.coordinates.lat.toFixed(2)}°, {incident.coordinates.lng.toFixed(2)}°
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Source</p>
                    <p className="mt-0.5 text-sm text-cyan-300">{incident.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Integrity</p>
                    <div className="mt-0.5">
                      <IntegrityBadge status={incident.integrity} size="xs" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="panel p-5 animate-fade-in">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Incident Timeline
              </h3>
              <IncidentTimeline entries={incident.timeline} />
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Source Records
              </h3>
              {incident.evidence.map((ev) => (
                <div key={ev.id} className="panel panel-hover p-4 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100">{ev.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{ev.summary}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                          <span>{ev.source}</span>
                          <span>·</span>
                          <span className="font-mono">{formatTimestamp(ev.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <IntegrityBadge status={ev.integrity} size="xs" />
                  </div>
                  <a
                    href={ev.url}
                    onClick={(e) => e.preventDefault()}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 transition-colors hover:text-cyan-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View source record (placeholder)
                  </a>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Environmental Context
              </h3>
              {incident.context.map((ctx) => (
                <div key={ctx.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CloudSun className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{ctx.label}</p>
                        <p className="mt-1 text-lg font-mono text-slate-100">{ctx.value}</p>
                        <p className="mt-1 text-xs text-slate-500">{ctx.note}</p>
                      </div>
                    </div>
                    <IntegrityBadge status={ctx.integrity} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data integrity explanation */}
          <div className="mt-6 panel p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Data Integrity Explanation
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  This incident room assembles data from simulated prototype fixtures. Each
                  field is labelled with its integrity status so you can distinguish
                  verified observations from forecasts, pending reconciliations, and
                  unavailable data. This interface uses local prototype fixtures — no live
                  public-source data is ingested in this build.
                </p>
                <div className="mt-3">
                  <DataIntegrityPanel variant="grid" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related incidents */}
        <div className="lg:col-span-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Related Incidents
          </h3>
          {related.length === 0 ? (
            <div className="panel p-4">
              <p className="text-xs text-slate-500">No related incidents linked.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {related.map((rel) => (
                <IncidentCard key={rel.id} incident={rel} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IncidentRoomPage;
