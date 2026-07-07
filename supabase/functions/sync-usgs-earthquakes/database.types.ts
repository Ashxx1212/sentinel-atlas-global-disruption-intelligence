export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          created_at: string
          enabled: boolean
          hazard_type: string | null
          id: string
          maximum_distance_km: number | null
          minimum_severity: string
          name: string
          updated_at: string
          user_id: string
          watchlist_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          hazard_type?: string | null
          id?: string
          maximum_distance_km?: number | null
          minimum_severity: string
          name: string
          updated_at?: string
          user_id: string
          watchlist_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          hazard_type?: string | null
          id?: string
          maximum_distance_km?: number | null
          minimum_severity?: string
          name?: string
          updated_at?: string
          user_id?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_items: {
        Row: {
          body: string | null
          briefing_id: string
          created_at: string
          data_mode: string | null
          id: string
          incident_id: string | null
          integrity_status: string | null
          position: number
          section: string
          title: string
        }
        Insert: {
          body?: string | null
          briefing_id: string
          created_at?: string
          data_mode?: string | null
          id?: string
          incident_id?: string | null
          integrity_status?: string | null
          position: number
          section: string
          title: string
        }
        Update: {
          body?: string | null
          briefing_id?: string
          created_at?: string
          data_mode?: string | null
          id?: string
          incident_id?: string | null
          integrity_status?: string | null
          position?: number
          section?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_items_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_items_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          briefing_date: string
          data_mode_summary: Json
          generated_at: string
          id: string
          overall_posture: string
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          briefing_date: string
          data_mode_summary?: Json
          generated_at?: string
          id?: string
          overall_posture: string
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          briefing_date?: string
          data_mode_summary?: Json
          generated_at?: string
          id?: string
          overall_posture?: string
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          ingestion_status: string
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          source_mode: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          ingestion_status: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          source_mode: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          ingestion_status?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          source_mode?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incident_sources: {
        Row: {
          created_at: string
          data_mode: string
          fetched_at: string
          id: string
          incident_id: string
          integrity_status: string
          record_state: string
          source_event_id: string
          source_event_time: string | null
          source_id: string
          source_record_title: string | null
          source_record_url: string | null
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_mode: string
          fetched_at?: string
          id?: string
          incident_id: string
          integrity_status?: string
          record_state?: string
          source_event_id: string
          source_event_time?: string | null
          source_id: string
          source_record_title?: string | null
          source_record_url?: string | null
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_mode?: string
          fetched_at?: string
          id?: string
          incident_id?: string
          integrity_status?: string
          record_state?: string
          source_event_id?: string
          source_event_time?: string | null
          source_id?: string
          source_record_title?: string | null
          source_record_url?: string | null
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_sources_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          body: string | null
          created_at: string
          data_mode: string
          id: string
          incident_id: string
          integrity_status: string
          occurred_at: string
          source_id: string | null
          title: string
          update_type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data_mode: string
          id?: string
          incident_id: string
          integrity_status: string
          occurred_at?: string
          source_id?: string | null
          title: string
          update_type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data_mode?: string
          id?: string
          incident_id?: string
          integrity_status?: string
          occurred_at?: string
          source_id?: string | null
          title?: string
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          canonical_key: string
          created_at: string
          data_mode: string
          depth_km: number | null
          event_end_time: string | null
          event_time: string | null
          hazard_type: string
          id: string
          integrity_status: string
          is_active: boolean
          last_source_fetched_at: string | null
          latitude: number | null
          longitude: number | null
          magnitude: number | null
          place_name: string | null
          primary_source_id: string
          severity: string
          source_updated_at: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          data_mode: string
          depth_km?: number | null
          event_end_time?: string | null
          event_time?: string | null
          hazard_type: string
          id?: string
          integrity_status?: string
          is_active?: boolean
          last_source_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          magnitude?: number | null
          place_name?: string | null
          primary_source_id: string
          severity: string
          source_updated_at?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          data_mode?: string
          depth_km?: number | null
          event_end_time?: string | null
          event_time?: string | null
          hazard_type?: string
          id?: string
          integrity_status?: string
          is_active?: boolean
          last_source_fetched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          magnitude?: number | null
          place_name?: string | null
          primary_source_id?: string
          severity?: string
          source_updated_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_primary_source_id_fkey"
            columns: ["primary_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          records_created: number
          records_received: number
          records_updated: number
          source_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          records_created?: number
          records_received?: number
          records_updated?: number
          source_id: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          records_created?: number
          records_received?: number
          records_updated?: number
          source_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          alert_rule_id: string | null
          body: string | null
          created_at: string
          data_mode: string
          id: string
          incident_id: string
          integrity_status: string
          matching_reason: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          alert_rule_id?: string | null
          body?: string | null
          created_at?: string
          data_mode: string
          id?: string
          incident_id: string
          integrity_status: string
          matching_reason?: string | null
          read_at?: string | null
          severity: string
          title: string
          user_id: string
        }
        Update: {
          alert_rule_id?: string | null
          body?: string | null
          created_at?: string
          data_mode?: string
          id?: string
          incident_id?: string
          integrity_status?: string
          matching_reason?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      source_events: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          ingestion_run_id: string | null
          payload: Json
          source_event_id: string
          source_id: string
          source_updated_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          ingestion_run_id?: string | null
          payload: Json
          source_event_id: string
          source_id: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          ingestion_run_id?: string | null
          payload?: Json
          source_event_id?: string
          source_id?: string
          source_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_events_ingestion_run_id_fkey"
            columns: ["ingestion_run_id"]
            isOneToOne: false
            referencedRelation: "ingestion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_locations: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          label: string
          latitude: number | null
          longitude: number | null
          place_name: string
          provider: string | null
          provider_location_id: string | null
          radius_km: number
          region_name: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          watchlist_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          label: string
          latitude?: number | null
          longitude?: number | null
          place_name: string
          provider?: string | null
          provider_location_id?: string | null
          radius_km?: number
          region_name?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          watchlist_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
          place_name?: string
          provider?: string | null
          provider_location_id?: string | null
          radius_km?: number
          region_name?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_locations_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
