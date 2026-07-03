import { supabase, isSupabaseConfigured } from './supabase';
import type {
  LiveUsgsFetchResult,
  LiveUsgsIncidentDetailResult,
  LiveUsgsIncidentRecord,
  LiveUsgsIncidentSourceSummary,
  LiveUsgsIncidentUpdateSummary,
  LiveUsgsSourceStatus,
} from '../types/liveIntelligence';

const LIVE_SOURCE_CODES = ['usgs', 'eonet'] as const;

let cachedLiveUsgsResult: LiveUsgsFetchResult | null = null;
let inFlightLiveUsgsRequest: Promise<LiveUsgsFetchResult> | null = null;

function emptyResult(state: LiveUsgsFetchResult['state'], errorMessage: string | null = null): LiveUsgsFetchResult {
  return {
    state,
    records: [],
    source: null,
    sources: [],
    recordCount: 0,
    errorMessage,
  };
}

function normalizeSourceStatus(row: Record<string, unknown> | null): LiveUsgsSourceStatus | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id ?? ''),
    code: String(row.code ?? ''),
    display_name: typeof row.display_name === 'string' ? row.display_name : '',
    source_mode: typeof row.source_mode === 'string' ? row.source_mode : null,
    ingestion_status: typeof row.ingestion_status === 'string' ? row.ingestion_status : null,
    last_success_at: typeof row.last_success_at === 'string' ? row.last_success_at : null,
  };
}

function buildSourcesById(sources: LiveUsgsSourceStatus[]): Map<string, LiveUsgsSourceStatus> {
  return new Map(sources.map((source) => [source.id, source]));
}

function normalizeIncident(
  row: Record<string, unknown>,
  sourcesById: Map<string, LiveUsgsSourceStatus> = new Map(),
): LiveUsgsIncidentRecord {
  const primarySourceId = typeof row.primary_source_id === 'string' ? row.primary_source_id : null;
  const source = primarySourceId ? sourcesById.get(primarySourceId) : null;

  return {
    id: String(row.id ?? ''),
    primary_source_id: primarySourceId,
    source_code: source?.code ?? null,
    source_display_name: source?.display_name ?? null,
    canonical_key: typeof row.canonical_key === 'string' ? row.canonical_key : null,
    hazard_type: typeof row.hazard_type === 'string' ? row.hazard_type : null,
    severity: typeof row.severity === 'string' ? row.severity : null,
    status: typeof row.status === 'string' ? row.status : null,
    integrity_status: typeof row.integrity_status === 'string' ? row.integrity_status : null,
    data_mode: typeof row.data_mode === 'string' ? row.data_mode : null,
    title: typeof row.title === 'string' ? row.title : null,
    summary: typeof row.summary === 'string' ? row.summary : null,
    place_name: typeof row.place_name === 'string' ? row.place_name : null,
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    event_time: typeof row.event_time === 'string' ? row.event_time : null,
    source_updated_at: typeof row.source_updated_at === 'string' ? row.source_updated_at : null,
    last_source_fetched_at: typeof row.last_source_fetched_at === 'string' ? row.last_source_fetched_at : null,
    magnitude: typeof row.magnitude === 'number' ? row.magnitude : null,
    depth_km: typeof row.depth_km === 'number' ? row.depth_km : null,
    is_active: typeof row.is_active === 'boolean' ? row.is_active : null,
  };
}

function normalizeIncidentSource(row: Record<string, unknown>): LiveUsgsIncidentSourceSummary {
  return {
    id: String(row.id ?? ''),
    source_id: typeof row.source_id === 'string' ? row.source_id : null,
    source_record_url: typeof row.source_record_url === 'string' ? row.source_record_url : null,
    source_record_title: typeof row.source_record_title === 'string' ? row.source_record_title : null,
    record_state: typeof row.record_state === 'string' ? row.record_state : null,
    integrity_status: typeof row.integrity_status === 'string' ? row.integrity_status : null,
    data_mode: typeof row.data_mode === 'string' ? row.data_mode : null,
    source_event_time: typeof row.source_event_time === 'string' ? row.source_event_time : null,
    source_updated_at: typeof row.source_updated_at === 'string' ? row.source_updated_at : null,
    fetched_at: typeof row.fetched_at === 'string' ? row.fetched_at : null,
  };
}

function normalizeIncidentUpdate(row: Record<string, unknown>): LiveUsgsIncidentUpdateSummary {
  return {
    id: String(row.id ?? ''),
    update_type: typeof row.update_type === 'string' ? row.update_type : null,
    title: typeof row.title === 'string' ? row.title : null,
    body: typeof row.body === 'string' ? row.body : null,
    occurred_at: typeof row.occurred_at === 'string' ? row.occurred_at : null,
    data_mode: typeof row.data_mode === 'string' ? row.data_mode : null,
    integrity_status: typeof row.integrity_status === 'string' ? row.integrity_status : null,
  };
}

async function fetchConfiguredLiveSources(): Promise<LiveUsgsSourceStatus[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('data_sources')
    .select('id, code, display_name, source_mode, ingestion_status, last_success_at')
    .in('code', [...LIVE_SOURCE_CODES]);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => normalizeSourceStatus(row as Record<string, unknown>))
    .filter((source): source is LiveUsgsSourceStatus => source !== null);
}

export async function fetchLiveUsgsIncidentDetail(incidentId: string): Promise<LiveUsgsIncidentDetailResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      incident: null,
      source: null,
      sources: [],
      updates: [],
    };
  }

  try {
    const { data: incidentRow, error: incidentError } = await supabase
      .from('incidents')
      .select(
        'id, primary_source_id, canonical_key, hazard_type, severity, status, integrity_status, data_mode, title, summary, place_name, latitude, longitude, event_time, source_updated_at, last_source_fetched_at, magnitude, depth_km, is_active',
      )
      .eq('id', incidentId)
      .maybeSingle();

    if (incidentError || !incidentRow) {
      return {
        incident: null,
        source: null,
        sources: [],
        updates: [],
      };
    }

    const primarySourceId =
      typeof incidentRow.primary_source_id === 'string' ? incidentRow.primary_source_id : null;

    const { data: sourceRow, error: sourceError } = primarySourceId
      ? await supabase
        .from('data_sources')
        .select('id, code, display_name, source_mode, ingestion_status, last_success_at')
        .eq('id', primarySourceId)
        .maybeSingle()
      : { data: null, error: null };

    const source = sourceError ? null : normalizeSourceStatus(sourceRow as Record<string, unknown> | null);
    const sourcesById = source ? buildSourcesById([source]) : new Map<string, LiveUsgsSourceStatus>();

    const { data: sourceRowsData, error: sourcesError } = await supabase
      .from('incident_sources')
      .select('id, source_id, source_record_url, source_record_title, record_state, integrity_status, data_mode, source_event_time, source_updated_at, fetched_at')
      .eq('incident_id', incidentId)
      .order('fetched_at', { ascending: false });

    const { data: updateRowsData, error: updatesError } = await supabase
      .from('incident_updates')
      .select('id, update_type, title, body, occurred_at, data_mode, integrity_status')
      .eq('incident_id', incidentId)
      .order('occurred_at', { ascending: false });

    return {
      incident: normalizeIncident(incidentRow as Record<string, unknown>, sourcesById),
      source,
      sources: sourcesError ? [] : (sourceRowsData ?? []).map((row) => normalizeIncidentSource(row as Record<string, unknown>)),
      updates: updatesError ? [] : (updateRowsData ?? []).map((row) => normalizeIncidentUpdate(row as Record<string, unknown>)),
    };
  } catch {
    return {
      incident: null,
      source: null,
      sources: [],
      updates: [],
    };
  }
}

async function fetchLiveUsgsIntelligenceFromSupabase(): Promise<LiveUsgsFetchResult> {
  if (!isSupabaseConfigured || !supabase) {
    return emptyResult('unconfigured');
  }

  try {
    const sources = await fetchConfiguredLiveSources();
    const sourcesById = buildSourcesById(sources);
    const source = sources.find((sourceItem) => sourceItem.code === 'usgs') ?? sources[0] ?? null;
    const sourceIds = sources.map((sourceItem) => sourceItem.id);

    if (sourceIds.length === 0) {
      return {
        state: 'empty',
        records: [],
        source: null,
        sources: [],
        recordCount: 0,
        errorMessage: null,
      };
    }

    const { data: incidentRows, error: incidentsError } = await supabase
      .from('incidents')
      .select(
        'id, primary_source_id, canonical_key, hazard_type, severity, status, integrity_status, data_mode, title, summary, place_name, latitude, longitude, event_time, source_updated_at, last_source_fetched_at, magnitude, depth_km, is_active',
      )
      .eq('data_mode', 'live_source')
      .in('primary_source_id', sourceIds)
      .eq('is_active', true)
      .order('event_time', { ascending: false })
      .limit(250);

    if (incidentsError) {
      return {
        state: 'error',
        records: [],
        source,
        sources,
        recordCount: 0,
        errorMessage: 'Stored live source records could not be loaded.',
      };
    }

    const records = (incidentRows ?? []).map((row) =>
      normalizeIncident(row as Record<string, unknown>, sourcesById),
    );

    if (records.length === 0) {
      return {
        state: 'empty',
        records: [],
        source,
        sources,
        recordCount: 0,
        errorMessage: null,
      };
    }

    return {
      state: 'success',
      records,
      source,
      sources,
      recordCount: records.length,
      errorMessage: null,
    };
  } catch {
    return emptyResult('error', 'Unable to retrieve stored live source records at this time.');
  }
}

export async function fetchLiveUsgsIntelligence({
  forceRefresh = false,
}: {
  forceRefresh?: boolean;
} = {}): Promise<LiveUsgsFetchResult> {
  if (!forceRefresh && cachedLiveUsgsResult) {
    return cachedLiveUsgsResult;
  }

  if (inFlightLiveUsgsRequest) {
    return inFlightLiveUsgsRequest;
  }

  inFlightLiveUsgsRequest = fetchLiveUsgsIntelligenceFromSupabase()
    .then((result) => {
      cachedLiveUsgsResult = result;
      return result;
    })
    .finally(() => {
      inFlightLiveUsgsRequest = null;
    });

  return inFlightLiveUsgsRequest;
}
