export type LiveUsgsState = 'loading' | 'success' | 'empty' | 'unconfigured' | 'error';

export interface LiveUsgsSourceStatus {
  id: string;
  code: string;
  display_name: string;
  source_mode: string | null;
  ingestion_status: string | null;
  last_success_at: string | null;
}

export interface LiveUsgsIncidentRecord {
  id: string;
  primary_source_id: string | null;
  source_code: string | null;
  source_display_name: string | null;
  canonical_key: string | null;
  hazard_type: string | null;
  severity: string | null;
  status: string | null;
  integrity_status: string | null;
  data_mode: string | null;
  title: string | null;
  summary: string | null;
  place_name: string | null;
  latitude: number | null;
  longitude: number | null;
  event_time: string | null;
  source_updated_at: string | null;
  last_source_fetched_at: string | null;
  magnitude: number | null;
  depth_km: number | null;
  is_active: boolean | null;
}

export interface LiveUsgsIncidentSourceSummary {
  id: string;
  source_id: string | null;
  source_record_url: string | null;
  source_record_title: string | null;
  record_state: string | null;
  integrity_status: string | null;
  data_mode: string | null;
  source_event_time: string | null;
  source_updated_at: string | null;
  fetched_at: string | null;
}

export interface LiveUsgsIncidentUpdateSummary {
  id: string;
  update_type: string | null;
  title: string | null;
  body: string | null;
  occurred_at: string | null;
  data_mode: string | null;
  integrity_status: string | null;
}

export interface LiveUsgsIncidentDetailResult {
  incident: LiveUsgsIncidentRecord | null;
  source: LiveUsgsSourceStatus | null;
  sources: LiveUsgsIncidentSourceSummary[];
  updates: LiveUsgsIncidentUpdateSummary[];
}

export interface LiveUsgsFetchResult {
  state: LiveUsgsState;
  records: LiveUsgsIncidentRecord[];
  source: LiveUsgsSourceStatus | null;
  sources: LiveUsgsSourceStatus[];
  recordCount: number;
  errorMessage: string | null;
}
