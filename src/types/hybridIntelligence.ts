import type { Incident, Severity, HazardType, IncidentStatus, DataIntegrityStatus, GeoCoordinates, TimelineEntry, EvidenceRecord, ContextRecord } from '../types';

export type HybridIncidentDataMode = 'prototype_fixture' | 'live_source';

export interface HybridIncident extends Incident {
  dataMode: HybridIncidentDataMode;
  sourceName: string;
  sourceCode: string;
  sourceLabel: string;
  sourceRecordUrl: string | null;
  sourceFetchedAt: string | null;
  placeName: string | null;
  eventTime: string | null;
  magnitude: number | null;
  depthKm: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface HybridIncidentSummary {
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
  reportedAt: string;
  updatedAt: string;
  integrity: DataIntegrityStatus;
  mapX: number;
  mapY: number;
  timeline: TimelineEntry[];
  evidence: EvidenceRecord[];
  context: ContextRecord[];
  relatedIds: string[];
  dataMode: HybridIncidentDataMode;
  sourceName: string;
  sourceCode: string;
  sourceLabel: string;
  sourceRecordUrl: string | null;
  sourceFetchedAt: string | null;
  placeName: string | null;
  eventTime: string | null;
  magnitude: number | null;
  depthKm: number | null;
  latitude: number | null;
  longitude: number | null;
}
