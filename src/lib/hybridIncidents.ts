import { mockIncidents } from '../data/mockIncidents';
import { fetchLiveUsgsIncidentDetail, fetchLiveUsgsIntelligence } from './liveUsgsIncidents';
import type { HybridIncident } from '../types/hybridIntelligence';
import type {
  LiveUsgsIncidentRecord,
  LiveUsgsIncidentSourceSummary,
  LiveUsgsIncidentUpdateSummary,
} from '../types/liveIntelligence';
import type {
  DataIntegrityStatus,
  EvidenceRecord,
  HazardType,
  Incident,
  IncidentStatus,
  Severity,
  TimelineEntry,
} from '../types';

const FALLBACK_TIMESTAMP = new Date(0).toISOString();

function toDisplaySeverity(value: string | null): Severity {
  if (value === 'critical' || value === 'high' || value === 'elevated' || value === 'advisory') {
    return value;
  }
  return 'advisory';
}

function toDisplayHazard(value: string | null, sourceCode: string | null): HazardType {
  if (value === 'earthquake' || value === 'wildfire' || value === 'flood' || value === 'cyclone' || value === 'volcano' || value === 'severe-weather') {
    return value;
  }
  if (sourceCode === 'gdacs') {
    return 'cyclone';
  }
  return sourceCode === 'usgs' ? 'earthquake' : 'severe-weather';
}

function toDisplayIntegrity(value: string | null): DataIntegrityStatus {
  if (value === 'verified' || value === 'forecast' || value === 'pending' || value === 'unavailable') {
    return value;
  }
  return 'pending';
}

function toDisplayStatus(value: string | null, isActive: boolean | null): IncidentStatus {
  if (value === 'active' || value === 'monitoring' || value === 'contained' || value === 'resolved') {
    return value;
  }
  return isActive ? 'active' : 'monitoring';
}

function toDisplayLocation(record: LiveUsgsIncidentRecord): string {
  return record.place_name?.trim() || 'Unavailable from current source record.';
}

function toDisplayTitle(record: LiveUsgsIncidentRecord, sourceName: string): string {
  return record.title?.trim() || `${sourceName} source-backed record`;
}

function toDisplaySummary(record: LiveUsgsIncidentRecord, sourceName: string): string {
  return record.summary?.trim() || `Stored source-backed event metadata from ${sourceName}.`;
}

function toDisplaySource(sourceName: string, sourceCode: string): string {
  return sourceName.trim() || sourceCode.toUpperCase() || 'Live source record';
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

export function toLiveSourceRecordLabel(sourceCode: string | null, sourceName: string | null): string {
  if (sourceCode === 'usgs') {
    return 'SOURCE-BACKED · USGS EARTHQUAKE CATALOG';
  }

  if (sourceCode === 'eonet') {
    return 'SOURCE-BACKED · NASA EONET';
  }

  if (sourceCode === 'gdacs') {
    return 'SOURCE-BACKED · GDACS';
  }

  const normalizedSourceName = sourceName?.trim();
  return normalizedSourceName
    ? `SOURCE-BACKED · ${normalizedSourceName.toUpperCase()}`
    : 'SOURCE-BACKED · LIVE SOURCE RECORD';
}

function buildTimelineFromLiveUpdates(
  updates: LiveUsgsIncidentUpdateSummary[],
  sourceName: string,
): TimelineEntry[] {
  return updates.map((update) => ({
    id: update.id,
    timestamp: update.occurred_at ?? FALLBACK_TIMESTAMP,
    title: update.title?.trim() || 'Source metadata update',
    description: update.body?.trim() || 'Source-backed event metadata was stored in Sentinel Atlas.',
    integrity: toDisplayIntegrity(update.integrity_status),
    source: sourceName,
  }));
}

function buildEvidenceFromLiveSources(
  sources: LiveUsgsIncidentSourceSummary[],
  sourceName: string,
): EvidenceRecord[] {
  return sources.map((source) => ({
    id: source.id,
    title: source.source_record_title?.trim() || `${sourceName} source record`,
    source: sourceName,
    url: source.source_record_url ?? '',
    timestamp: source.fetched_at ?? source.source_updated_at ?? source.source_event_time ?? FALLBACK_TIMESTAMP,
    integrity: toDisplayIntegrity(source.integrity_status),
    summary: `Source record state: ${source.record_state ?? 'available'}.`,
  }));
}

interface LiveRecordBuildOptions {
  sourceRecordUrl?: string | null;
  timeline?: TimelineEntry[];
  evidence?: EvidenceRecord[];
}

export function buildHybridIncidentFromLiveRecord(
  record: LiveUsgsIncidentRecord,
  fallbackSourceName = 'Live source record',
  fallbackSourceCode = 'live-source',
  options: LiveRecordBuildOptions = {},
): HybridIncident {
  const sourceName = record.source_display_name ?? fallbackSourceName;
  const sourceCode = record.source_code ?? fallbackSourceCode;
  const coordinates = toDisplayCoordinates(record);
  const mapPosition = toDisplayMapPosition(record);

  return {
    id: record.id,
    title: toDisplayTitle(record, sourceName),
    hazardType: toDisplayHazard(record.hazard_type, sourceCode),
    severity: toDisplaySeverity(record.severity),
    status: toDisplayStatus(record.status, record.is_active),
    summary: toDisplaySummary(record, sourceName),
    location: toDisplayLocation(record),
    coordinates,
    source: toDisplaySource(sourceName, sourceCode),
    sourceId: sourceCode,
    reportedAt: record.event_time ?? FALLBACK_TIMESTAMP,
    updatedAt: record.source_updated_at ?? record.last_source_fetched_at ?? record.event_time ?? FALLBACK_TIMESTAMP,
    integrity: toDisplayIntegrity(record.integrity_status),
    mapX: mapPosition.mapX,
    mapY: mapPosition.mapY,
    timeline: options.timeline ?? [],
    evidence: options.evidence ?? [],
    context: [],
    relatedIds: [],
    dataMode: 'live_source',
    sourceName,
    sourceCode,
    sourceLabel: toLiveSourceRecordLabel(sourceCode, sourceName),
    sourceRecordUrl: options.sourceRecordUrl ?? null,
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
    sourceLabel: 'PROTOTYPE FIXTURE',
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
  const liveIncidents = (liveResult.records ?? []).map((record) =>
    buildHybridIncidentFromLiveRecord(
      record,
      record.source_display_name ?? liveResult.source?.display_name ?? 'Live source record',
      record.source_code ?? liveResult.source?.code ?? 'live-source',
    ),
  );
  const fixtureIncidents = mockIncidents.map(buildHybridIncidentFromFixture);

  return [...fixtureIncidents, ...liveIncidents];
}

export async function getHybridIncidentById(id: string): Promise<HybridIncident | undefined> {
  const fixture = mockIncidents.find((incident) => incident.id === id);
  if (fixture) {
    return buildHybridIncidentFromFixture(fixture);
  }

  const detail = await fetchLiveUsgsIncidentDetail(id);
  if (detail.incident) {
    const sourceName = detail.source?.display_name ?? detail.incident.source_display_name ?? 'Live source record';
    const sourceCode = detail.source?.code ?? detail.incident.source_code ?? 'live-source';
    const primarySourceRecord =
      detail.sources.find((source) => source.source_id === detail.source?.id) ?? detail.sources[0];

    return buildHybridIncidentFromLiveRecord(detail.incident, sourceName, sourceCode, {
      sourceRecordUrl: primarySourceRecord?.source_record_url ?? null,
      timeline: buildTimelineFromLiveUpdates(detail.updates, sourceName),
      evidence: buildEvidenceFromLiveSources(detail.sources, sourceName),
    });
  }

  const liveResult = await fetchLiveUsgsIntelligence();
  const liveRecord = liveResult.records.find((record) => record.id === id);
  if (!liveRecord) {
    return undefined;
  }

  return buildHybridIncidentFromLiveRecord(
    liveRecord,
    liveRecord.source_display_name ?? liveResult.source?.display_name ?? 'Live source record',
    liveRecord.source_code ?? liveResult.source?.code ?? 'live-source',
  );
}
