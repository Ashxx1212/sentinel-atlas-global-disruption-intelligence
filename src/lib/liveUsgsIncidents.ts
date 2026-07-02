import { supabase, isSupabaseConfigured } from './supabase';
import type { LiveUsgsFetchResult, LiveUsgsIncidentRecord, LiveUsgsIncidentDetailResult, LiveUsgsSourceStatus } from '../types/liveIntelligence';

let cachedLiveUsgsResult: LiveUsgsFetchResult | null = null;
let inFlightLiveUsgsRequest: Promise<LiveUsgsFetchResult> | null = null;

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

function normalizeIncident(row: Record<string, unknown>): LiveUsgsIncidentRecord {
  return {
    id: String(row.id ?? ''),
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
    const { data: sourceRows, error: sourceError } = await supabase
      .from('data_sources')
      .select('id, code, display_name, source_mode, ingestion_status, last_success_at')
      .eq('code', 'usgs')
      .maybeSingle();

    const source = normalizeSourceStatus(sourceRows as Record<string, unknown> | null);

    if (sourceError) {
      return {
        incident: null,
        source,
        sources: [],
        updates: [],
      };
    }

    const { data: incidentRows, error: incidentError } = await supabase
      .from('incidents')
      .select(
        'id, canonical_key, hazard_type, severity, status, integrity_status, data_mode, title, summary, place_name, latitude, longitude, event_time, source_updated_at, last_source_fetched_at, magnitude, depth_km, is_active',
      )
      .eq('id', incidentId)
      .maybeSingle();

    if (incidentError || !incidentRows) {
      return {
        incident: null,
        source,
        sources: [],
        updates: [],
      };
    }

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

    if (sourcesError || updatesError) {
      return {
        incident: normalizeIncident(incidentRows as Record<string, unknown>),
        source,
        sources: (sourceRowsData ?? []).map((row) => ({
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
        })),
        updates: (updateRowsData ?? []).map((row) => ({
          id: String(row.id ?? ''),
          update_type: typeof row.update_type === 'string' ? row.update_type : null,
          title: typeof row.title === 'string' ? row.title : null,
          body: typeof row.body === 'string' ? row.body : null,
          occurred_at: typeof row.occurred_at === 'string' ? row.occurred_at : null,
          data_mode: typeof row.data_mode === 'string' ? row.data_mode : null,
          integrity_status: typeof row.integrity_status === 'string' ? row.integrity_status : null,
        })),
      };
    }

    return {
      incident: normalizeIncident(incidentRows as Record<string, unknown>),
      source,
      sources: (sourceRowsData ?? []).map((row) => ({
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
      })),
      updates: (updateRowsData ?? []).map((row) => ({
        id: String(row.id ?? ''),
        update_type: typeof row.update_type === 'string' ? row.update_type : null,
        title: typeof row.title === 'string' ? row.title : null,
        body: typeof row.body === 'string' ? row.body : null,
        occurred_at: typeof row.occurred_at === 'string' ? row.occurred_at : null,
        data_mode: typeof row.data_mode === 'string' ? row.data_mode : null,
        integrity_status: typeof row.integrity_status === 'string' ? row.integrity_status : null,
      })),
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
    return {
      state: 'unconfigured',
      records: [],
      source: null,
      recordCount: 0,
      errorMessage: null,
    };
  }

  try {
    const { data: sourceRows, error: sourceError } = await supabase
      .from('data_sources')
      .select('id, code, display_name, source_mode, ingestion_status, last_success_at')
      .eq('code', 'usgs')
      .maybeSingle();

    if (sourceError) {
      return {
        state: 'error',
        records: [],
        source: null,
        recordCount: 0,
        errorMessage: sourceError.message,
      };
    }

    const source = normalizeSourceStatus(sourceRows as Record<string, unknown> | null);

    const { data: incidentRows, error: incidentsError } = await supabase
      .from('incidents')
      .select(
        'id, canonical_key, hazard_type, severity, status, integrity_status, data_mode, title, summary, place_name, latitude, longitude, event_time, source_updated_at, last_source_fetched_at, magnitude, depth_km, is_active',
      )
      .eq('data_mode', 'live_source')
      .eq('hazard_type', 'earthquake')
      .eq('is_active', true)
      .order('event_time', { ascending: false })
      .limit(100);

    if (incidentsError) {
      return {
        state: 'error',
        records: [],
        source,
        recordCount: 0,
        errorMessage: incidentsError.message,
      };
    }

    const records = (incidentRows ?? []).map((row) => normalizeIncident(row as Record<string, unknown>));

    if (records.length === 0) {
      return {
        state: 'empty',
        records: [],
        source,
        recordCount: 0,
        errorMessage: null,
      };
    }

    return {
      state: 'success',
      records,
      source,
      recordCount: records.length,
      errorMessage: null,
    };
  } catch {
    return {
      state: 'error',
      records: [],
      source: null,
      recordCount: 0,
      errorMessage: 'Unable to retrieve stored USGS records at this time.',
    };
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
