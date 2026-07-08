import { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { latLngBounds, type LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight } from 'lucide-react';
import type { HybridIncident } from '../types/hybridIntelligence';
import { hazardTypeLabels } from '../data/mockIncidents';
import { SeverityBadge } from './SeverityBadge';
import { IntegrityBadge } from './StatusBadge';

const severityMarkerColor: Record<HybridIncident['severity'], string> = {
  critical: '#ef4444',
  high: '#f97316',
  elevated: '#eab308',
  advisory: '#22d3ee',
};

const hazardShortLabel: Record<HybridIncident['hazardType'], string> = {
  earthquake: 'EQ',
  wildfire: 'WF',
  flood: 'FL',
  cyclone: 'CY',
  volcano: 'VO',
  'severe-weather': 'SW',
};

interface MockMapWorkspaceProps {
  incidents: HybridIncident[];
  onMarkerClick?: (incident: HybridIncident) => void;
  selectedId?: string;
  className?: string;
  showLabels?: boolean;
  interactive?: boolean;
}

function isValidCoordinate(incident: HybridIncident): boolean {
  return (
    Number.isFinite(incident.coordinates.lat) &&
    Number.isFinite(incident.coordinates.lng) &&
    incident.coordinates.lat >= -90 &&
    incident.coordinates.lat <= 90 &&
    incident.coordinates.lng >= -180 &&
    incident.coordinates.lng <= 180
  );
}

function markerRadius(incident: HybridIncident, selected: boolean): number {
  if (selected) return 11;

  switch (incident.severity) {
    case 'critical':
      return 9;
    case 'high':
      return 8;
    case 'elevated':
      return 7;
    default:
      return 6;
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function FitMapToIncidents({
  incidents,
  selectedId,
}: {
  incidents: HybridIncident[];
  selectedId?: string;
}) {
  const map = useMap();

  useEffect(() => {
    const selectedIncident = selectedId
      ? incidents.find((incident) => incident.id === selectedId)
      : null;

    if (selectedIncident && isValidCoordinate(selectedIncident)) {
      map.closePopup();
      map.flyTo(
        [selectedIncident.coordinates.lat, selectedIncident.coordinates.lng],
        Math.max(map.getZoom(), 5),
        { duration: 0.8 },
      );
      return;
    }

    const validIncidents = incidents.filter(isValidCoordinate);

    if (validIncidents.length === 0) {
      map.setView([20, 0], 2);
      return;
    }

    if (validIncidents.length === 1) {
      const [incident] = validIncidents;
      map.setView([incident.coordinates.lat, incident.coordinates.lng], 4);
      return;
    }

    const bounds = latLngBounds(
      validIncidents.map((incident) => [
        incident.coordinates.lat,
        incident.coordinates.lng,
      ]),
    );

    map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 5,
      animate: true,
    });
  }, [incidents, map, selectedId]);

  return null;
}

function IncidentMarker({
  incident,
  selected,
  showLabels,
  interactive,
  onMarkerClick,
}: {
  incident: HybridIncident;
  selected: boolean;
  showLabels: boolean;
  interactive: boolean;
  onMarkerClick?: (incident: HybridIncident) => void;
}) {
  const map = useMap();
  const color = severityMarkerColor[incident.severity];
  const liveSource = incident.dataMode === 'live_source';

  const previewIncident = () => {
    if (!interactive) return;
    map.closePopup();
    onMarkerClick?.(incident);
  };

  return (
    <CircleMarker
      center={[incident.coordinates.lat, incident.coordinates.lng]}
      radius={markerRadius(incident, selected)}
      pathOptions={{
        color,
        fillColor: liveSource ? '#22d3ee' : color,
        fillOpacity: liveSource ? 0.78 : 0.64,
        opacity: selected ? 1 : 0.9,
        weight: selected ? 3 : 2,
      }}
      eventHandlers={{
        click: previewIncident,
      }}
    >
      {showLabels ? (
        <Tooltip
          direction="top"
          offset={[0, -8]}
          opacity={1}
          sticky
          permanent={selected}
          className="sentinel-map-tooltip"
        >
          <div className="text-xs">
            <strong>{incident.title}</strong>
            <div>{hazardShortLabel[incident.hazardType]} · {incident.location}</div>
          </div>
        </Tooltip>
      ) : null}

      <Popup className="sentinel-map-popup" closeButton>
        <div className="min-w-[220px]">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={incident.severity} size="xs" />
            <span className="rounded-full border border-slate-300/40 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              {hazardTypeLabels[incident.hazardType]}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-slate-900">
            {incident.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {incident.location}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
              {liveSource ? incident.sourceLabel : 'Prototype fixture'}
            </span>
            <IntegrityBadge status={incident.integrity} size="xs" />
          </div>

          {incident.magnitude !== null || incident.depthKm !== null ? (
            <p className="mt-2 text-[11px] text-slate-600">
              {incident.magnitude !== null ? `${incident.magnitude.toFixed(1)} M` : ''}
              {incident.magnitude !== null && incident.depthKm !== null ? ' · ' : ''}
              {incident.depthKm !== null ? `${incident.depthKm.toFixed(1)} km depth` : ''}
            </p>
          ) : null}

          <p className="mt-2 text-[11px] text-slate-500">
            Updated {formatTimestamp(incident.updatedAt)}
          </p>

          {interactive ? (
            <button
              type="button"
              onClick={previewIncident}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white"
            >
              Preview incident
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export function MockMapWorkspace({
  incidents,
  onMarkerClick,
  selectedId,
  className = '',
  showLabels = true,
  interactive = true,
}: MockMapWorkspaceProps) {
  const validIncidents = useMemo(
    () => incidents.filter(isValidCoordinate),
    [incidents],
  );
  const skippedCount = incidents.length - validIncidents.length;

  const initialBounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    if (validIncidents.length < 2) {
      return undefined;
    }

    return validIncidents.map((incident) => [
      incident.coordinates.lat,
      incident.coordinates.lng,
    ]);
  }, [validIncidents]);

  return (
    <div
      className={`relative z-0 isolate overflow-hidden rounded-xl border border-ink-700/60 bg-ink-950 ${className}`}
      aria-label="Interactive world map with source-backed incident markers"
    >
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        maxBounds={[
          [-90, -180],
          [90, 180],
        ]}
        maxBoundsViscosity={0.65}
        bounds={initialBounds}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
        className="relative z-0 h-full w-full bg-ink-950"
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FitMapToIncidents incidents={validIncidents} selectedId={selectedId} />

        {validIncidents.map((incident) => (
          <IncidentMarker
            key={incident.id}
            incident={incident}
            selected={selectedId === incident.id}
            showLabels={showLabels}
            interactive={interactive}
            onMarkerClick={onMarkerClick}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-16 top-3 z-[10] rounded-full border border-cyan-500/25 bg-ink-950/85 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-cyan-300 shadow-lg backdrop-blur">
        Dark geospatial basemap · {validIncidents.length} plotted
      </div>

      {skippedCount > 0 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[10] rounded-lg border border-warning-500/25 bg-warning-500/10 px-3 py-2 text-[10px] text-warning-200 shadow-lg backdrop-blur">
          {skippedCount} record{skippedCount === 1 ? '' : 's'} skipped because coordinates are unavailable.
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 right-3 z-[10] rounded-lg border border-ink-700/70 bg-ink-950/85 px-3 py-2 text-[10px] text-slate-400 shadow-lg backdrop-blur">
        Markers use stored latitude / longitude.
      </div>
    </div>
  );
}

export default MockMapWorkspace;
