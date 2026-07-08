import { Link } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { X, MapPin, Clock, ArrowRight, Info, Link2, Database, Layers3, Server } from 'lucide-react';
import type { HybridIncident } from '../types/hybridIntelligence';
import { SeverityBadge } from './SeverityBadge';
import { IntegrityBadge } from './StatusBadge';
import { hazardTypeLabels, getRelatedIncidents } from '../data/mockIncidents';

interface IncidentDrawerProps {
  incident: HybridIncident | null;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}

export function IncidentDrawer({ incident, onClose }: IncidentDrawerProps) {
  const relatedIncidents = useMemo(() => incident ? getRelatedIncidents(incident) : [], [incident]);

  useEffect(() => {
    if (!incident) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [incident, onClose]);

  if (!incident) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md animate-slide-in-right">
        <div className="flex h-full flex-col border-l border-ink-700/60 bg-ink-900 shadow-panel">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-ink-700/60 p-5">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={incident.severity} size="xs" />
                <span className="text-xs text-slate-500">
                  {hazardTypeLabels[incident.hazardType]}
                </span>
                <span className={`chip text-[10px] ${incident.dataMode === 'live_source' ? 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300' : 'border-warning-500/20 bg-warning-500/5 text-warning-400'}`}>
                  {incident.dataMode === 'live_source' ? incident.sourceLabel : 'PROTOTYPE FIXTURE'}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold text-slate-100">
                {incident.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close incident preview"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-ink-700/40 hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Meta strip */}
            <div className="space-y-2.5 border-b border-ink-700/60 pb-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>{incident.location}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Reported {formatTimestamp(incident.reportedAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-slate-500">Source:</span>
                <span className="text-cyan-300">{incident.sourceName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Integrity:</span>
                <IntegrityBadge status={incident.integrity} size="xs" />
              </div>
              <div className="font-mono text-xs text-slate-500">
                {incident.coordinates.lat.toFixed(2)}°, {incident.coordinates.lng.toFixed(2)}°
              </div>
            </div>

            {incident.dataMode === 'live_source' && (
              <div className="mt-4 grid gap-3 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{incident.sourceLabel}</span>
                </div>
                {incident.magnitude !== null && (
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Magnitude: {incident.magnitude.toFixed(1)} M</span>
                  </div>
                )}
                {incident.depthKm !== null && (
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Depth: {incident.depthKm.toFixed(1)} km</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Event time: {incident.eventTime ? formatTimestamp(incident.eventTime) : 'Unavailable'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Fetch time: {incident.sourceFetchedAt ? formatTimestamp(incident.sourceFetchedAt) : 'Unavailable'}</span>
                </div>
                {incident.sourceRecordUrl && (
                  <a href={incident.sourceRecordUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300">
                    View source URL
                    <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Summary
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {incident.summary}
              </p>
            </div>

            {/* Why this is shown */}
            <div className="mt-4 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-300">Why this is shown</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                    {incident.dataMode === 'live_source'
                      ? `${incident.sourceName} source-backed event metadata. Sentinel Atlas has not independently validated this source observation.`
                      : 'This prototype fixture appears because it matches the current map filters. Incident context is illustrative and clearly labeled.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mini map placeholder */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Location
              </h3>
              <div className="mt-2 relative h-32 overflow-hidden rounded-lg border border-ink-700/60 bg-ink-850 grid-texture">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <span className={`absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 animate-ping-slow`} style={{ backgroundColor: 'currentColor' }} />
                    <span className="relative block h-3 w-3 rounded-full bg-cyan-400 border-2 border-ink-950" />
                  </div>
                </div>
                <div className="absolute bottom-1.5 left-2 font-mono text-[9px] text-slate-600">
                  LOCATION PREVIEW
                </div>
              </div>
            </div>

            {/* Related incidents */}
            {relatedIncidents.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Related Incidents
                </h3>
                <div className="mt-2 space-y-1.5">
                  {relatedIncidents.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/incidents/${rel.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5 transition-colors hover:border-cyan-500/20 hover:bg-ink-800/40"
                    >
                      <Link2 className="h-3 w-3 flex-shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-200 truncate">{rel.title}</p>
                        <p className="text-[10px] text-slate-500">{hazardTypeLabels[rel.hazardType]}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-600" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Prototype note */}
            <div className="mt-4 rounded-lg border border-warning-500/15 bg-warning-500/5 p-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {incident.dataMode === 'live_source'
                  ? 'Source-backed positions use stored source coordinates. Open the Global Map for the full geospatial basemap.'
                  : 'Prototype fixture context is illustrative and clearly labeled. Open the Global Map for the full geospatial basemap.'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-ink-700/60 p-5">
            <Link
              to={`/incidents/${incident.id}`}
              className="btn-primary w-full"
              onClick={onClose}
            >
              Open Incident Room
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default IncidentDrawer;
