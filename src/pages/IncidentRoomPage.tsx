import { useState, useEffect, useMemo } from 'react';
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
  Crosshair,
  ShieldAlert,
  Ruler,
  Bell,
  Globe,
  Server,
} from 'lucide-react';
import {
  getIncidentById,
  getRelatedIncidents,
  hazardTypeLabels,
  mockAlerts,
  mockWatchlist,
  mockSources,
} from '../data/mockIncidents';
import { buildHybridIncidentFromFixture, getHybridIncidentById } from '../lib/hybridIncidents';
import type { HybridIncident } from '../types/hybridIntelligence';
import type { IncidentTab, Incident, HazardType } from '../types';
import { SeverityBadge, severityColor, severityText } from '../components/SeverityBadge';
import { IntegrityBadge, StatusBadge } from '../components/StatusBadge';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { IncidentCard } from '../components/IncidentCard';
import { DataIntegrityPanel } from '../components/DataIntegrityPanel';
import { EmptyState } from '../components/ui';

const tabs: { value: IncidentTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'context', label: 'Context' },
];

const hazardIconPaths: Record<HazardType, string> = {
  earthquake: 'M3 12h2l2-6 4 12 2-6h4',
  wildfire: 'M12 3c-1 3-4 4-4 7a4 4 0 0 0 8 0c0-3-3-4-4-7z',
  flood: 'M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2',
  cyclone: 'M12 4a8 8 0 0 0-8 8 6 6 0 0 0 12 0 4 4 0 0 0-8 0 2 2 0 0 0 4 0',
  volcano: 'M4 18l4-8 4 4 4-6 4 10z',
  'severe-weather': 'M7 16a4 4 0 0 1 0-8 5 5 0 0 1 10 0 3 3 0 0 1 0 6H7z',
};

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

// ── Right-rail relevance helpers ────────────────────────────

function findMatchingAlerts(incident: Incident) {
  return mockAlerts.filter((a) => a.incidentId === incident.id);
}

function findMatchingWatchlist(incident: Incident) {
  return mockWatchlist.filter((loc) =>
    loc.alertRules.includes(incident.hazardType)
  );
}

function getSourceById(sourceId: string) {
  return mockSources.find((s) => s.id === sourceId);
}

function getGdacsLiveSourceRole(incident: HybridIncident) {
  return incident.dataMode === 'live_source' && incident.sourceCode === 'gdacs'
    ? 'GDACS awareness and coordination metadata'
    : null;
}

// ── Cinematic incident visual ───────────────────────────────

function IncidentVisual({ incident }: { incident: HybridIncident }) {
  const color = severityColor(incident.severity);
  const textCls = severityText(incident.severity);
  const path = hazardIconPaths[incident.hazardType];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900 h-56 sm:h-64"
      role="img"
      aria-label={`Illustrative location frame for ${incident.title}`}
    >
      {/* Grid texture */}
      <div className="absolute inset-0 grid-texture opacity-60" />

      {/* Scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-scan-line" />
      </div>

      {/* SVG map */}
      <svg
        viewBox="0 0 100 60"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="locGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d1320" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#070a12" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect width="100" height="60" fill="url(#locGlow)" />

        {/* Coordinate grid */}
        <g stroke="#1c2740" strokeWidth="0.08" opacity="0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} strokeDasharray="0.5,0.5" />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="60" strokeDasharray="0.5,0.5" />
          ))}
        </g>

        {/* Crosshair on incident position */}
        <g opacity="0.3" stroke={textCls.includes('error') ? '#ef4444' : textCls.includes('orange') ? '#fb923c' : textCls.includes('yellow') ? '#eab308' : '#94a3b8'} strokeWidth="0.12">
          <line x1={incident.mapX - 8} y1={incident.mapY} x2={incident.mapX + 8} y2={incident.mapY} strokeDasharray="1,0.5" />
          <line x1={incident.mapX} y1={incident.mapY - 8} x2={incident.mapX} y2={incident.mapY + 8} strokeDasharray="1,0.5" />
        </g>
      </svg>

      {/* Marker with pulsing halo */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${incident.mapX}%`, top: `${incident.mapY}%` }}
      >
        {/* Outer halo */}
        <span className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full ${color} opacity-20 animate-halo-pulse`} />
        {/* Pulse ring */}
        <span className={`absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full ${color} opacity-30 animate-ping-slow`} />
        {/* Marker dot */}
        <span className={`relative flex h-5 w-5 items-center justify-center rounded-full ${color} border-2 border-ink-950 shadow-lg`}>
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-ink-950" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d={path} />
          </svg>
        </span>
      </div>

      {/* Corner labels */}
      <div className="pointer-events-none absolute top-2 left-3 font-mono text-[10px] text-cyan-500/40">
        {incident.dataMode === 'live_source'
          ? 'SOURCE LOCATION FRAME · STORED COORDINATES'
          : 'ILLUSTRATIVE LOCATION FRAME · PROTOTYPE MODE'}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-slate-600">
        {incident.coordinates.lat.toFixed(2)}°, {incident.coordinates.lng.toFixed(2)}°
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 font-mono text-[10px] text-slate-600">
        LOC LOCK · {incident.mapX.toFixed(1)}, {incident.mapY.toFixed(1)}
      </div>
    </div>
  );
}

// ── Key facts grid ───────────────────────────────────────────

function KeyFactsGrid({ incident }: { incident: HybridIncident }) {
  const source = getSourceById(incident.sourceId);
  const gdacsLiveSourceRole = getGdacsLiveSourceRole(incident);
  const facts = [
    { label: 'Severity', value: incident.severity, badge: true, badgeType: 'severity' },
    { label: 'Hazard Type', value: hazardTypeLabels[incident.hazardType] },
    { label: 'Location', value: incident.location, icon: MapPin },
    { label: 'Coordinates', value: `${incident.coordinates.lat.toFixed(2)}°, ${incident.coordinates.lng.toFixed(2)}°`, mono: true },
    { label: incident.dataMode === 'live_source' ? 'Source Update' : 'Fixture Freshness', value: formatTimestamp(incident.updatedAt), icon: Clock },
    { label: 'Integrity State', value: incident.integrity, badge: true, badgeType: 'integrity' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
          <p className="text-xs text-slate-500">{fact.label}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {fact.icon && <fact.icon className="h-3.5 w-3.5 text-cyan-400" />}
            {fact.badge && fact.badgeType === 'severity' && (
              <SeverityBadge severity={incident.severity} size="xs" />
            )}
            {fact.badge && fact.badgeType === 'integrity' && (
              <IntegrityBadge status={incident.integrity} size="xs" />
            )}
            {!fact.badge && (
              <p className={`text-sm text-slate-200 ${fact.mono ? 'font-mono' : ''}`}>
                {fact.value}
              </p>
            )}
          </div>
        </div>
      ))}
      {gdacsLiveSourceRole ? (
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
          <p className="text-xs text-slate-500">Source Role</p>
          <p className="mt-1 text-sm text-slate-200">{gdacsLiveSourceRole}</p>
        </div>
      ) : source ? (
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
          <p className="text-xs text-slate-500">Source Role</p>
          <p className="mt-1 text-sm text-slate-200">{source.dataUseRole}</p>
        </div>
      ) : null}
      {incident.dataMode === 'live_source' && !source && !gdacsLiveSourceRole && (
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-3">
          <p className="text-xs text-slate-500">Source Role</p>
          <p className="mt-1 text-sm text-slate-200">Source-backed event metadata</p>
        </div>
      )}
    </div>
  );
}

// ── Evidence ledger ──────────────────────────────────────────

function EvidenceLedger({ incident }: { incident: HybridIncident }) {
  return (
    <div className="space-y-3">
      {incident.evidence.map((ev) => {
        const source = mockSources.find((s) => s.shortName === ev.source);
        const gdacsLiveSourceRole = getGdacsLiveSourceRole(incident);
        const sourceRole = gdacsLiveSourceRole ?? source?.dataUseRole;
        const hasSourceUrl = ev.url.trim().length > 0;
        return (
          <div key={ev.id} className="panel panel-hover p-4 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2">
                  <FileText className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{ev.title}</p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{ev.summary}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      {ev.source}
                    </span>
                    {sourceRole && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span>{sourceRole}</span>
                      </>
                    )}
                    <span className="text-slate-600">·</span>
                    <span className="font-mono">{formatTimestamp(ev.timestamp)}</span>
                  </div>
                </div>
              </div>
              <IntegrityBadge status={ev.integrity} size="xs" />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-ink-700/60 pt-3">
              <span className="text-[10px] text-slate-600">
                {incident.dataMode === 'live_source'
                  ? 'Source-backed evidence record'
                  : 'Illustrative source record · Prototype source trace'}
              </span>
              {hasSourceUrl ? (
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[10px] text-cyan-300 transition-colors hover:text-cyan-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  View source URL
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <ExternalLink className="h-3 w-3" />
                  Source URL unavailable
                </span>
              )}
            </div>
          </div>
        );
      })}
      {incident.evidence.length === 0 && (
        <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4 text-sm text-slate-500">
          No source evidence records are stored for this incident yet.
        </div>
      )}
    </div>
  );
}

// ── Context cards ────────────────────────────────────────────

function ContextCards({ incident }: { incident: HybridIncident }) {
  return (
    <div className="space-y-3">
      {incident.context.map((ctx) => (
        <div key={ctx.id} className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2">
                <CloudSun className="h-4 w-4 text-cyan-300" />
              </div>
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
      {/* Data availability panel */}
      <div className="panel p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Data Availability</h4>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              This prototype does not represent population impact estimates, casualty figures,
              infrastructure damage assessments, evacuation orders, or emergency response actions.
              All context fields are drawn from local fixture data. In the full platform, these
              cards would integrate live weather, air quality, and impact-context feeds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Right-side intelligence rail ─────────────────────────────

function IntelligenceRail({ incident }: { incident: HybridIncident }) {
  const related = useMemo(() => getRelatedIncidents(incident).map(buildHybridIncidentFromFixture), [incident]);
  const matchingAlerts = useMemo(() => findMatchingAlerts(incident), [incident]);
  const matchingWatchlist = useMemo(() => findMatchingWatchlist(incident), [incident]);

  return (
    <div className="space-y-4">
      {/* Severity / integrity state */}
      <div className="panel p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          State Summary
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Severity</span>
            <SeverityBadge severity={incident.severity} size="xs" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Integrity</span>
            <IntegrityBadge status={incident.integrity} size="xs" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Status</span>
            <StatusBadge status={incident.status} />
          </div>
        </div>
      </div>

      {/* Related incidents */}
      <div className="panel p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Related Incidents
        </h3>
        {related.length === 0 ? (
          <p className="text-xs text-slate-500">No related incidents linked.</p>
        ) : (
          <div className="space-y-2">
            {related.map((rel) => (
              <IncidentCard key={rel.id} incident={rel} compact />
            ))}
          </div>
        )}
      </div>

      {/* Matching alert-rule explanation */}
      <div className="panel p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Alert Rule Match
        </h3>
        {matchingAlerts.length === 0 ? (
          <p className="text-xs text-slate-500">
            No prototype alert rules matched this incident.
          </p>
        ) : (
          <div className="space-y-2">
            {matchingAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Bell className="h-3 w-3 text-cyan-400" />
                  <span className="text-xs font-medium text-slate-200">{alert.rule}</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Watched-location relevance */}
      <div className="panel p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Watchlist Relevance
        </h3>
        {matchingWatchlist.length === 0 ? (
          <p className="text-xs text-slate-500">
            This incident does not match any watched-location alert rules in the prototype.
          </p>
        ) : (
          <div className="space-y-2">
            {matchingWatchlist.map((loc) => (
              <div key={loc.id} className="flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5">
                <Ruler className="h-3 w-3 text-cyan-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200">{loc.name}</p>
                  <p className="text-[10px] text-slate-500">
                    Matches {hazardTypeLabels[incident.hazardType]} rule
                  </p>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Relevance is calculated from local prototype fixture rules. It is not a live proximity calculation.
            </p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <Link
          to="/global-map"
          className="btn-secondary flex w-full items-center justify-center gap-2"
        >
          <Globe className="h-4 w-4" />
          Open Global Map
        </Link>
        <Link
          to="/data-trust"
          className="btn-secondary flex w-full items-center justify-center gap-2"
        >
          <Server className="h-4 w-4" />
          View Data Trust
        </Link>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export function IncidentRoomPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const [activeTab, setActiveTab] = useState<IncidentTab>('overview');
  const [incident, setIncident] = useState<HybridIncident | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const relatedIncidents = useMemo(
    () => incident ? getRelatedIncidents(incident).map(buildHybridIncidentFromFixture) : [],
    [incident],
  );

  useEffect(() => {
    let mounted = true;

    async function loadIncident() {
      if (mounted) {
        setLoading(true);
        setLoadError(null);
        setActiveTab('overview');
      }

      if (!incidentId) {
        if (mounted) {
          setIncident(undefined);
          setLoading(false);
        }
        return;
      }

      const fixtureIncident = getIncidentById(incidentId);
      if (fixtureIncident) {
        if (mounted) {
          setIncident(buildHybridIncidentFromFixture(fixtureIncident));
          setLoading(false);
        }
        return;
      }

      try {
        const hybridLiveIncident = await getHybridIncidentById(incidentId);
        if (mounted) {
          setIncident(hybridLiveIncident);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setIncident(undefined);
          setLoadError('This Incident Room could not be loaded right now.');
          setLoading(false);
        }
      }
    }

    void loadIncident();

    return () => {
      mounted = false;
    };
  }, [incidentId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <div className="panel p-6 text-sm text-slate-400">Loading incident room…</div>
      </div>
    );
  }

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
            title="Incident Room unavailable"
            message={loadError ?? 'This incident record could not be found.'}
          />
          <div className="mt-4 text-center">
            <Link to="/incidents" className="btn-primary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Incident Rooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const path = hazardIconPaths[incident.hazardType];

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

      {/* ── 1. INCIDENT COMMAND HEADER ── */}
      <div className="mt-4 panel ambient-sweep-bg relative overflow-hidden p-5 animate-reveal-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={incident.severity} withGlow />
              <StatusBadge status={incident.status} />
              <span className="chip border-ink-600/60 bg-ink-800/60 text-slate-400">
                {hazardTypeLabels[incident.hazardType]}
              </span>
              <IntegrityBadge status={incident.integrity} size="xs" />
              <span className={`chip ${incident.dataMode === 'live_source' ? 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400' : 'border-warning-500/20 bg-warning-500/5 text-warning-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${incident.dataMode === 'live_source' ? 'bg-cyan-400' : 'bg-warning-500'}`} />
                {incident.dataMode === 'live_source' ? incident.sourceLabel : 'PROTOTYPE FIXTURE'}
              </span>
            </div>

            {/* Title with hazard icon */}
            <div className="mt-3 flex items-start gap-3">
              <div className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={path} />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100 lg:text-3xl">
                {incident.title}
              </h1>
            </div>

            {/* Location */}
            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              {incident.location}
              <span className="text-slate-600">·</span>
              <span className="font-mono text-xs text-slate-500">
                {incident.coordinates.lat.toFixed(2)}°, {incident.coordinates.lng.toFixed(2)}°
              </span>
            </div>
          </div>

          {/* Right meta */}
          <div className="flex-shrink-0 space-y-2 lg:text-right">
            <div className="flex items-center gap-2 text-xs text-slate-400 lg:justify-end">
              <Database className="h-3.5 w-3.5 text-slate-500" />
              <span>Source: <span className="text-cyan-300">{incident.source}</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 lg:justify-end">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Event: {formatTimestamp(incident.reportedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 lg:justify-end">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>{incident.dataMode === 'live_source' ? 'Source update' : 'Fixture refresh'}: {formatTimestamp(incident.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Prototype disclaimer */}
        <div className={`mt-4 flex items-start gap-2 rounded-lg border p-3 ${incident.dataMode === 'live_source' ? 'border-cyan-500/15 bg-cyan-500/5' : 'border-warning-500/15 bg-warning-500/5'}`}>
          <Info className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${incident.dataMode === 'live_source' ? 'text-cyan-400' : 'text-warning-400'}`} />
          <p className="text-xs text-slate-400 leading-relaxed">
            {incident.dataMode === 'live_source'
              ? `${incident.sourceName} source-backed event metadata. Sentinel Atlas has not independently validated this source observation.`
              : 'This Incident Room uses local prototype fixture data. It is not an operational warning or live-risk assessment.'}
          </p>
        </div>
      </div>

      {/* ── 2. CINEMATIC INCIDENT VISUAL ── */}
      <div className="mt-4 animate-reveal-up" style={{ animationDelay: '60ms' }}>
        <IncidentVisual incident={incident} />
      </div>

      {/* ── 3. TABBED INTELLIGENCE WORKSPACE ── */}
      <div className="mt-4 border-b border-ink-700/60">
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              role="tab"
              aria-selected={activeTab === tab.value}
              className={`tab-button whitespace-nowrap ${
                activeTab === tab.value ? 'tab-button-active' : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content + right rail */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* Summary */}
              <div className="panel p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Summary
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">{incident.summary}</p>
              </div>

              {/* Key facts */}
              <div className="panel p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Key Facts
                </h3>
                <KeyFactsGrid incident={incident} />
              </div>

              {/* Why this is shown */}
              <div className="panel p-4">
                <div className="flex items-start gap-3">
                  <Crosshair className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Why this is shown</h3>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {incident.dataMode === 'live_source'
                        ? `This incident appears because it is an active source-backed record from ${incident.sourceName}. Sentinel Atlas preserves the source metadata and does not convert it into an operational warning.`
                        : 'This incident appears in the Sentinel Atlas prototype because it matches the current hazard filters and exists in the local fixture dataset. In the full platform, incidents would be surfaced based on your watchlist proximity, alert rules, and severity thresholds. Map position and incident context are illustrative in this prototype.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Related incidents */}
              <div className="panel p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Related Incidents
                </h3>
                {relatedIncidents.length === 0 ? (
                  <p className="text-xs text-slate-500">No related incidents linked.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {relatedIncidents.map((rel) => (
                      <IncidentCard key={rel.id} incident={rel} compact />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="panel p-5 animate-fade-in">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Incident Timeline
                </h3>
                <span className="text-[10px] text-slate-600">
                  {incident.dataMode === 'live_source' ? 'Source-backed updates' : 'Prototype fixture updates'}
                </span>
              </div>
              {incident.timeline.length > 0 ? (
                <IncidentTimeline entries={incident.timeline} />
              ) : (
                <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-4 text-sm text-slate-500">
                  No source timeline updates are stored for this incident yet.
                </div>
              )}
              <div className={`mt-4 flex items-start gap-2 rounded-lg border p-3 ${incident.dataMode === 'live_source' ? 'border-cyan-500/15 bg-cyan-500/5' : 'border-warning-500/15 bg-warning-500/5'}`}>
                <Info className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${incident.dataMode === 'live_source' ? 'text-cyan-400' : 'text-warning-400'}`} />
                <p className="text-xs text-slate-500 leading-relaxed">
                  {incident.dataMode === 'live_source'
                    ? 'Timeline entries are source-backed metadata updates. They do not represent emergency orders, confirmed damage, or response actions.'
                    : 'All timeline entries are prototype fixture updates. They do not represent official evacuations, injuries, emergency orders, confirmed damage, or response actions.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Source Evidence Ledger
                </h3>
                <span className="text-[10px] text-slate-600">
                  {incident.dataMode === 'live_source' ? incident.sourceLabel : 'Illustrative source records'}
                </span>
              </div>
              <EvidenceLedger incident={incident} />

              {/* Integrity explanation */}
              <div className="panel p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0 text-cyan-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Integrity Labels Explained
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      Each source record carries an integrity label indicating its data state
                      in the future full platform:
                    </p>
                    <div className="mt-3">
                      <DataIntegrityPanel variant="grid" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Environmental Context
                </h3>
                <span className="text-[10px] text-slate-600">
                  Forecast · Pending · Unavailable
                </span>
              </div>
              <ContextCards incident={incident} />
            </div>
          )}
        </div>

        {/* ── 4. RIGHT-SIDE INTELLIGENCE RAIL ── */}
        <div className="lg:col-span-1">
          <IntelligenceRail incident={incident} />
        </div>
      </div>
    </div>
  );
}

export default IncidentRoomPage;
