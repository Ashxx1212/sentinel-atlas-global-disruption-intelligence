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

export interface LiveUsgsFetchResult {
  state: LiveUsgsState;
  records: LiveUsgsIncidentRecord[];
  source: LiveUsgsSourceStatus | null;
  recordCount: number;
  errorMessage: string | null;
}
