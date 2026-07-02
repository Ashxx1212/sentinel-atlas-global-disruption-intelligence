import { mockIncidents } from '../data/mockIncidents';
import { fetchLiveUsgsIntelligence } from './liveUsgsIncidents';
import type { HybridIncident } from '../types/hybridIntelligence';
import type { LiveUsgsIncidentRecord } from '../types/liveIntelligence';
import type { Incident, Severity, HazardType } from '../types';

function toDisplaySeverity(value: string | null): Severity {
  if (value === 'critical' || value === 'high' || value === 'elevated' || value === 'advisory') {
    return value;
  }
  return 'elevated';
}

function toDisplayHazard(value: string | null): HazardType {
  if (value === 'earthquake' || value === 'wildfire' || value === 'flood' || value === 'cyclone' || value === 'volcano' || value === 'severe-weather') {
    return value;
  }
  return 'earthquake';
}

function toDisplayIntegrity(value: string | null): 'verified' | 'forecast' | 'pending' | 'unavailable' {
  if (value === 'verified' || value === 'forecast' || value === 'pending' || value === 'unavailable') {
    return value;
  }
  return 'pending';
}

function toDisplayLocation(record: LiveUsgsIncidentRecord): string {
  return record.place_name?.trim() || 'Unavailable from current source record.';
}

function toDisplayTitle(record: LiveUsgsIncidentRecord): string {
  return record.title?.trim() || 'USGS source-backed earthquake record';
}

function toDisplaySummary(record: LiveUsgsIncidentRecord): string {
  return record.summary?.trim() || 'Stored source-backed earthquake record from the USGS Earthquake Catalog.';
}

function toDisplaySource(record: LiveUsgsIncidentRecord): string {
  return record.title?.trim() || 'USGS Earthquake Catalog';
}

function toDisplayCoordinates(record: LiveUsgsIncidentRecord): { lat: number; lng: number } {
  const lat = typeof record.latitude === 'number' ? record.latitude : 0;
  const lng = typeof record.longitude === 'number' ? record.longitude : 0;
  return { lat, lng };
}

function toDisplayMapPosition(record: LiveUsgsIncidentRecord): { mapX: number; mapY: number } {
  const lng = typeof record.longitude === 'number' ? record.longitude : 0;
  const lat = typeof record.latitude === 'number' ? record.latitude : 0;
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return {
    mapX: Math.min(100, Math.max(0, x)),
    mapY: Math.min(100, Math.max(0, y)),
  };
}

export function buildHybridIncidentFromLiveRecord(record: LiveUsgsIncidentRecord, sourceName: string, sourceCode: string): HybridIncident {
  const coordinates = toDisplayCoordinates(record);
  const mapPosition = toDisplayMapPosition(record);
  const sourceRecordUrl = null;

  return {
    id: record.id,
    title: toDisplayTitle(record),
    hazardType: toDisplayHazard(record.hazard_type),
    severity: toDisplaySeverity(record.severity),
    status: record.is_active ? 'active' : 'monitoring',
    summary: toDisplaySummary(record),
    location: toDisplayLocation(record),
    coordinates,
    source: toDisplaySource(record),
    sourceId: sourceCode,
    reportedAt: record.event_time ?? new Date(0).toISOString(),
    updatedAt: record.source_updated_at ?? record.last_source_fetched_at ?? record.event_time ?? new Date(0).toISOString(),
    integrity: toDisplayIntegrity(record.integrity_status),
    mapX: mapPosition.mapX,
    mapY: mapPosition.mapY,
    timeline: [],
    evidence: [],
    context: [],
    relatedIds: [],
    dataMode: 'live_source',
    sourceName,
    sourceCode,
    sourceRecordUrl,
    sourceFetchedAt: record.last_source_fetched_at,
    placeName: record.place_name ?? null,
    eventTime: record.event_time ?? null,
    magnitude: typeof record.magnitude === 'number' ? record.magnitude : null,
    depthKm: typeof record.depth_km === 'number' ? record.depth_km : null,
    latitude: typeof record.latitude === 'number' ? record.latitude : null,
    longitude: typeof record.longitude === 'number' ? record.longitude : null,
  };
}

export function buildHybridIncidentFromFixture(incident: Incident): HybridIncident {
  return {
    ...incident,
    dataMode: 'prototype_fixture',
    sourceName: incident.source,
    sourceCode: incident.sourceId,
    sourceRecordUrl: null,
    sourceFetchedAt: incident.updatedAt,
    placeName: incident.location,
    eventTime: incident.reportedAt,
    magnitude: null,
    depthKm: null,
    latitude: incident.coordinates.lat,
    longitude: incident.coordinates.lng,
  };
}

export async function getHybridIncidents(forceRefresh = false): Promise<HybridIncident[]> {
  const liveResult = await fetchLiveUsgsIntelligence({ forceRefresh });
  const liveIncidents = (liveResult.records ?? []).map((record) => buildHybridIncidentFromLiveRecord(record, liveResult.source?.display_name ?? 'USGS', liveResult.source?.code ?? 'usgs'));
  const fixtureIncidents = mockIncidents.map(buildHybridIncidentFromFixture);

  return [...fixtureIncidents, ...liveIncidents];
}

export async function getHybridIncidentById(id: string): Promise<HybridIncident | undefined> {
  const fixture = mockIncidents.find((incident) => incident.id === id);
  if (fixture) {
    return buildHybridIncidentFromFixture(fixture);
  }

  const liveResult = await fetchLiveUsgsIntelligence();
  const liveRecord = liveResult.records.find((record) => record.id === id);
  if (!liveRecord) {
    return undefined;
  }

  return buildHybridIncidentFromLiveRecord(liveRecord, liveResult.source?.display_name ?? 'USGS', liveResult.source?.code ?? 'usgs');
}
