// Core domain types for Sentinel Atlas

export type Severity = 'advisory' | 'elevated' | 'high' | 'critical';

export type HazardType =
  | 'earthquake'
  | 'wildfire'
  | 'flood'
  | 'cyclone'
  | 'volcano'
  | 'severe-weather';

export type DataIntegrityStatus = 'verified' | 'forecast' | 'pending' | 'unavailable';

export type IncidentStatus = 'active' | 'monitoring' | 'contained' | 'resolved';

export type IncidentTab = 'overview' | 'timeline' | 'evidence' | 'context';

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface Source {
  id: string;
  name: string;
  shortName: string;
  description: string;
  coverage: string;
  lastSync: string; // ISO timestamp
  dataUseRole: string;
  health: 'operational' | 'degraded' | 'offline';
  integrityStatus: DataIntegrityStatus;
}

export interface TimelineEntry {
  id: string;
  timestamp: string; // ISO
  title: string;
  description: string;
  integrity: DataIntegrityStatus;
  source: string;
}

export interface EvidenceRecord {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: string;
  integrity: DataIntegrityStatus;
  summary: string;
}

export interface ContextRecord {
  id: string;
  label: string;
  value: string;
  integrity: DataIntegrityStatus;
  note: string;
}

export interface Incident {
  id: string;
  title: string;
  hazardType: HazardType;
  severity: Severity;
  status: IncidentStatus;
  summary: string;
  location: string;
  coordinates: GeoCoordinates;
  source: string;
  sourceId: string;
  reportedAt: string; // ISO
  updatedAt: string; // ISO
  integrity: DataIntegrityStatus;
  // SVG map position in percentages (0-100) for the mock world map
  mapX: number;
  mapY: number;
  timeline: TimelineEntry[];
  evidence: EvidenceRecord[];
  context: ContextRecord[];
  relatedIds: string[];
}

export interface AlertEntry {
  id: string;
  incidentId: string;
  title: string;
  severity: Severity;
  hazardType: HazardType;
  message: string;
  timestamp: string;
  read: boolean;
  rule: string;
  location: string;
}

export interface WatchlistLocation {
  id: string;
  name: string;
  country: string;
  coordinates: GeoCoordinates;
  alertRules: HazardType[];
  addedAt: string;
}

export interface BriefingItem {
  id: string;
  section: BriefingSection;
  title: string;
  detail: string;
  integrity: DataIntegrityStatus;
  relatedIncidentId?: string;
}

export type BriefingSection =
  | 'overnight-changes'
  | 'watchlist-exposure'
  | 'priority-incidents'
  | 'weather-context'
  | 'data-availability';

export interface PriorityRegion {
  id: string;
  name: string;
  incidentCount: number;
  topSeverity: Severity;
  summary: string;
}

export interface IntelligenceStreamEntry {
  id: string;
  incidentId: string;
  timestamp: string;
  title: string;
  severity: Severity;
  hazardType: HazardType;
}
