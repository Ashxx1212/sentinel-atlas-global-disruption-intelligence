import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { HazardType, Severity } from '../types';
import type { HybridIncident } from '../types/hybridIntelligence';
import { hazardTypeLabels } from '../data/mockIncidents';
import { severityColor, severityText } from './SeverityBadge';

const hazardIconPaths: Record<HazardType, string> = {
  earthquake: 'M3 12h2l2-6 4 12 2-6h4',
  wildfire: 'M12 3c-1 3-4 4-4 7a4 4 0 0 0 8 0c0-3-3-4-4-7z',
  flood: 'M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2',
  cyclone: 'M12 4a8 8 0 0 0-8 8 6 6 0 0 0 12 0 4 4 0 0 0-8 0 2 2 0 0 0 4 0',
  volcano: 'M4 18l4-8 4 4 4-6 4 10z',
  'severe-weather': 'M7 16a4 4 0 0 1 0-8 5 5 0 0 1 10 0 3 3 0 0 1 0 6H7z',
};

const severityPulse: Record<Severity, string> = {
  critical: 'animate-ping-slow',
  high: 'animate-ping-slow',
  elevated: 'animate-pulse-marker',
  advisory: 'animate-pulse-marker',
};

const severityRingSize: Record<Severity, string> = {
  critical: 'h-8 w-8',
  high: 'h-7 w-7',
  elevated: 'h-6 w-6',
  advisory: 'h-5 w-5',
};

interface MockMapWorkspaceProps {
  incidents: HybridIncident[];
  onMarkerClick?: (incident: HybridIncident) => void;
  selectedId?: string;
  className?: string;
  showLabels?: boolean;
  interactive?: boolean;
}

export function MockMapWorkspace({
  incidents,
  onMarkerClick,
  selectedId,
  className = '',
  showLabels = true,
  interactive = true,
}: MockMapWorkspaceProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (hovered && !incidents.some((incident) => incident.id === hovered)) {
      setHovered(null);
    }
  }, [hovered, incidents]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900 ${className}`}
      role="img"
      aria-label="Illustrative world map with simulated incident markers in Prototype Mode"
    >
      {/* Grid texture */}
      <div className="absolute inset-0 grid-texture opacity-60" />
      {/* Scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-scan-line" />
      </div>

      {/* SVG world map placeholder */}
      <svg
        viewBox="0 0 100 60"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#0d1320" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#070a12" stopOpacity="1" />
          </radialGradient>
          <pattern id="dotPattern" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.3" fill="#1c2740" />
          </pattern>
        </defs>

        <rect width="100" height="60" fill="url(#mapGlow)" />

        {/* Stylised continent shapes */}
        <g fill="url(#dotPattern)" stroke="#1c2740" strokeWidth="0.15" opacity="0.7">
          <path d="M8,18 Q12,14 18,15 L24,18 L26,24 L22,30 L16,32 L12,28 L8,24 Z" />
          <path d="M22,34 L26,33 L28,38 L27,46 L24,50 L22,48 L21,42 Z" />
          <path d="M46,20 L52,18 L54,22 L52,26 L48,27 L46,24 Z" />
          <path d="M48,28 L54,28 L56,34 L54,42 L50,46 L47,44 L46,36 Z" />
          <path d="M56,18 L68,16 L76,20 L78,26 L74,30 L68,32 L62,30 L58,26 L56,22 Z" />
          <path d="M72,32 L78,34 L80,38 L76,40 L72,38 Z" />
          <path d="M78,42 L86,41 L88,46 L84,50 L78,48 Z" />
        </g>

        {/* Coordinate lines */}
        <g stroke="#1c2740" strokeWidth="0.08" opacity="0.5">
          <line x1="0" y1="30" x2="100" y2="30" strokeDasharray="0.5,0.5" />
          <line x1="0" y1="24" x2="100" y2="24" strokeDasharray="0.3,0.5" opacity="0.3" />
          <line x1="0" y1="36" x2="100" y2="36" strokeDasharray="0.3,0.5" opacity="0.3" />
          <line x1="25" y1="0" x2="25" y2="60" strokeDasharray="0.5,0.5" opacity="0.3" />
          <line x1="50" y1="0" x2="50" y2="60" strokeDasharray="0.5,0.5" opacity="0.3" />
          <line x1="75" y1="0" x2="75" y2="60" strokeDasharray="0.5,0.5" opacity="0.3" />
        </g>
      </svg>

      {/* Markers overlay */}
      <div className="absolute inset-0">
        {incidents.map((incident) => {
          const isSelected = selectedId === incident.id;
          const isHovered = hovered === incident.id;
          const color = severityColor(incident.severity);
          const textCls = severityText(incident.severity);
          const path = hazardIconPaths[incident.hazardType];
          const isLiveSource = incident.dataMode === 'live_source';

          return (
            <button
              key={incident.id}
              onClick={() => interactive && onMarkerClick?.(incident)}
              onMouseEnter={() => setHovered(incident.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={`${incident.title} — ${hazardTypeLabels[incident.hazardType]}, severity ${incident.severity}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 group"
              style={{
                left: `${incident.mapX}%`,
                top: `${incident.mapY}%`,
              }}
              disabled={!interactive}
            >
              {/* Selected halo ring */}
              {isSelected && (
                <span
                  className={`absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${color} opacity-40 animate-halo-pulse`}
                />
              )}

              {/* Pulse ring */}
              <span
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${isLiveSource ? 'bg-cyan-400/30 border border-cyan-400/40' : color + ' opacity-20'} ${severityRingSize[incident.severity]} ${severityPulse[incident.severity]}`}
              />

              {/* Marker dot */}
              <span
                className={`relative flex h-4 w-4 items-center justify-center rounded-full ${isLiveSource ? 'bg-cyan-400' : color} border-2 border-ink-950 shadow-lg transition-transform duration-200 ${
                  isSelected || isHovered ? 'scale-125' : 'group-hover:scale-110'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-ink-950" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d={path} />
                </svg>
              </span>

              {/* Label tooltip */}
              {showLabels && (isHovered || isSelected) && (
                <div className="absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 animate-fade-in">
                  <div className="panel border-cyan-500/20 p-3 text-left">
                    <p className={`text-xs font-semibold ${textCls}`}>
                      {incident.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {hazardTypeLabels[incident.hazardType]} · {incident.location}
                    </p>
                    <p className={`mt-1 text-[10px] ${isLiveSource ? 'text-cyan-300' : 'text-slate-600'}`}>
                      {isLiveSource ? 'USGS source-backed record' : `Fixture status · ${incident.integrity}`}
                    </p>
                    {isLiveSource && incident.sourceName && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {incident.sourceName} · {incident.magnitude ? `${incident.magnitude.toFixed(1)} M` : 'Magnitude unavailable'}
                      </p>
                    )}
                    {interactive && (
                      <span className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-cyan-400">
                        Open Incident Room
                        <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Corner coordinate overlay */}
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-slate-600">
        LAT -90° / LNG -180°
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 font-mono text-[10px] text-slate-600">
        LAT 90° / LNG 180°
      </div>
      <div className="pointer-events-none absolute top-2 left-3 font-mono text-[10px] text-cyan-500/40">
        MOCK MAP · PROTOTYPE
      </div>
    </div>
  );
}

export default MockMapWorkspace;
