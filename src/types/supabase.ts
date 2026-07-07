export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      data_sources: {
        Row: {
          id: string;
          code: string;
          display_name: string;
          source_url: string | null;
          source_mode: 'live_source' | 'prototype_fixture';
          ingestion_status: 'pending' | 'operational' | 'degraded' | 'fixture_only' | 'unavailable';
          last_success_at: string | null;
          last_error_at: string | null;
          last_error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          display_name: string;
          source_url?: string | null;
          source_mode: 'live_source' | 'prototype_fixture';
          ingestion_status: 'pending' | 'operational' | 'degraded' | 'fixture_only' | 'unavailable';
          last_success_at?: string | null;
          last_error_at?: string | null;
          last_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          display_name?: string;
          source_url?: string | null;
          source_mode?: 'live_source' | 'prototype_fixture';
          ingestion_status?: 'pending' | 'operational' | 'degraded' | 'fixture_only' | 'unavailable';
          last_success_at?: string | null;
          last_error_at?: string | null;
          last_error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      incidents: {
        Row: {
          id: string;
          canonical_key: string;
          primary_source_id: string;
          hazard_type: string;
          severity: 'advisory' | 'elevated' | 'high' | 'critical';
          status: 'active' | 'monitoring' | 'resolved' | 'archived';
          integrity_status: 'verified' | 'forecast' | 'pending' | 'unavailable';
          data_mode: 'live_source' | 'prototype_fixture';
          title: string;
          summary: string | null;
          place_name: string | null;
          latitude: number | null;
          longitude: number | null;
          event_time: string | null;
          event_end_time: string | null;
          source_updated_at: string | null;
          last_source_fetched_at: string | null;
          magnitude: number | null;
          depth_km: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          canonical_key: string;
          primary_source_id: string;
          hazard_type: string;
          severity: 'advisory' | 'elevated' | 'high' | 'critical';
          status?: 'active' | 'monitoring' | 'resolved' | 'archived';
          integrity_status?: 'verified' | 'forecast' | 'pending' | 'unavailable';
          data_mode: 'live_source' | 'prototype_fixture';
          title: string;
          summary?: string | null;
          place_name?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          event_time?: string | null;
          event_end_time?: string | null;
          source_updated_at?: string | null;
          last_source_fetched_at?: string | null;
          magnitude?: number | null;
          depth_km?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          canonical_key?: string;
          primary_source_id?: string;
          hazard_type?: string;
          severity?: 'advisory' | 'elevated' | 'high' | 'critical';
          status?: 'active' | 'monitoring' | 'resolved' | 'archived';
          integrity_status?: 'verified' | 'forecast' | 'pending' | 'unavailable';
          data_mode?: 'live_source' | 'prototype_fixture';
          title?: string;
          summary?: string | null;
          place_name?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          event_time?: string | null;
          event_end_time?: string | null;
          source_updated_at?: string | null;
          last_source_fetched_at?: string | null;
          magnitude?: number | null;
          depth_km?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      watchlists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      watchlist_locations: {
        Row: {
          id: string;
          watchlist_id: string;
          user_id: string;
          label: string;
          place_name: string;
          country_code: string | null;
          region_name: string | null;
          latitude: number | null;
          longitude: number | null;
          timezone: string | null;
          radius_km: number;
          provider: string | null;
          provider_location_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          watchlist_id: string;
          user_id: string;
          label: string;
          place_name: string;
          country_code?: string | null;
          region_name?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string | null;
          radius_km?: number;
          provider?: string | null;
          provider_location_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          watchlist_id?: string;
          user_id?: string;
          label?: string;
          place_name?: string;
          country_code?: string | null;
          region_name?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string | null;
          radius_km?: number;
          provider?: string | null;
          provider_location_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      alert_rules: {
        Row: {
          id: string;
          user_id: string;
          watchlist_id: string | null;
          watchlist_location_id: string | null;
          name: string;
          hazard_type: string | null;
          minimum_severity: 'advisory' | 'elevated' | 'high' | 'critical';
          maximum_distance_km: number | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          watchlist_id?: string | null;
          watchlist_location_id?: string | null;
          name: string;
          hazard_type?: string | null;
          minimum_severity: 'advisory' | 'elevated' | 'high' | 'critical';
          maximum_distance_km?: number | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          watchlist_id?: string | null;
          watchlist_location_id?: string | null;
          name?: string;
          hazard_type?: string | null;
          minimum_severity?: 'advisory' | 'elevated' | 'high' | 'critical';
          maximum_distance_km?: number | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          incident_id: string;
          alert_rule_id: string | null;
          title: string;
          body: string | null;
          severity: 'advisory' | 'elevated' | 'high' | 'critical';
          data_mode: 'live_source' | 'prototype_fixture';
          integrity_status: 'verified' | 'forecast' | 'pending' | 'unavailable';
          matching_reason: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          incident_id: string;
          alert_rule_id?: string | null;
          title: string;
          body?: string | null;
          severity: 'advisory' | 'elevated' | 'high' | 'critical';
          data_mode: 'live_source' | 'prototype_fixture';
          integrity_status: 'verified' | 'forecast' | 'pending' | 'unavailable';
          matching_reason?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          incident_id?: string;
          alert_rule_id?: string | null;
          title?: string;
          body?: string | null;
          severity?: 'advisory' | 'elevated' | 'high' | 'critical';
          data_mode?: 'live_source' | 'prototype_fixture';
          integrity_status?: 'verified' | 'forecast' | 'pending' | 'unavailable';
          matching_reason?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
      };
      briefings: {
        Row: {
          id: string;
          user_id: string;
          briefing_date: string;
          title: string;
          overall_posture: string;
          summary: string | null;
          generated_at: string;
          data_mode_summary: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          briefing_date: string;
          title: string;
          overall_posture: string;
          summary?: string | null;
          generated_at?: string;
          data_mode_summary?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          briefing_date?: string;
          title?: string;
          overall_posture?: string;
          summary?: string | null;
          generated_at?: string;
          data_mode_summary?: Json;
        };
      };
      briefing_items: {
        Row: {
          id: string;
          briefing_id: string;
          incident_id: string | null;
          section: string;
          position: number;
          title: string;
          body: string | null;
          data_mode: 'live_source' | 'prototype_fixture' | null;
          integrity_status: 'verified' | 'forecast' | 'pending' | 'unavailable' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          briefing_id: string;
          incident_id?: string | null;
          section: string;
          position: number;
          title: string;
          body?: string | null;
          data_mode?: 'live_source' | 'prototype_fixture' | null;
          integrity_status?: 'verified' | 'forecast' | 'pending' | 'unavailable' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          briefing_id?: string;
          incident_id?: string | null;
          section?: string;
          position?: number;
          title?: string;
          body?: string | null;
          data_mode?: 'live_source' | 'prototype_fixture' | null;
          integrity_status?: 'verified' | 'forecast' | 'pending' | 'unavailable' | null;
          created_at?: string;
        };
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
