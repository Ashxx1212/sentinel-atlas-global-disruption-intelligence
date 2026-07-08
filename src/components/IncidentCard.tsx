import { Link } from 'react-router-dom';
import {
  Waves,
  Flame,
  CloudRain,
  Tornado,
  Mountain,
  CloudLightning,
  ChevronRight,
  Clock,
  MapPin,
  Database,
} from 'lucide-react';
import type { HazardType } from '../types';
import type { HybridIncident } from '../types/hybridIntelligence';
import { SeverityBadge } from './SeverityBadge';
import { IntegrityBadge } from './StatusBadge';
import { hazardTypeLabels } from '../data/mockIncidents';

const hazardIcons: Record<HazardType, typeof Waves> = {
  earthquake: Waves,
  wildfire: Flame,
  flood: CloudRain,
  cyclone: Tornado,
  volcano: Mountain,
  'severe-weather': CloudLightning,
};

const hazardColors: Record<HazardType, string> = {
  earthquake: 'text-cyan-400 bg-cyan-500/10',
  wildfire: 'text-error-400 bg-error-500/10',
  flood: 'text-electric-400 bg-electric-500/10',
  cyclone: 'text-purple-300 bg-purple-500/10',
  volcano: 'text-orange-400 bg-orange-500/10',
  'severe-weather': 'text-slate-300 bg-slate-500/10',
};

function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) {
    return 'Time unavailable';
  }

  const diff = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diff / 60000);

  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  return `${Math.floor(hrs / 24)}d ago`;
}

interface IncidentCardProps {
  incident: HybridIncident;
  compact?: boolean;
}

export function IncidentCard({ incident, compact = false }: IncidentCardProps) {
  const Icon = hazardIcons[incident.hazardType];
  const colorClass = hazardColors[incident.hazardType];
  const liveSource = incident.dataMode === 'live_source';

  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="panel panel-hover group block p-4 transition-all duration-300"
      aria-label={`Open incident room for ${incident.title}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2.5 ${colorClass} flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={incident.severity} size="xs" />
            <span className="text-xs text-slate-500">
              {hazardTypeLabels[incident.hazardType]}
            </span>
            <span
              className={`chip text-[10px] ${
                liveSource
                  ? 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300'
                  : 'border-warning-500/20 bg-warning-500/5 text-warning-400'
              }`}
            >
              <Database className="h-3 w-3" />
              {liveSource ? incident.sourceLabel : 'Prototype fixture'}
            </span>
          </div>

          <h3 className="mt-1.5 text-sm font-semibold text-slate-100 transition-colors group-hover:text-cyan-300">
            {incident.title}
          </h3>

          {!compact ? (
            <p className="mt-1 text-xs text-slate-400 line-clamp-2">
              {incident.summary}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{incident.location}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(incident.updatedAt)}
            </span>
          </div>

          {!compact ? (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <IntegrityBadge status={incident.integrity} size="xs" />
                <span className="text-[10px] text-slate-600">
                  {liveSource
                    ? 'Source-backed metadata'
                    : 'Illustrative context'}
                </span>
              </div>
              <span className="flex items-center gap-0.5 text-xs text-slate-500 transition-colors group-hover:text-cyan-300">
                Open room
                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default IncidentCard;
