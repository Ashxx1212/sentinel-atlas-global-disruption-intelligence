-- ============================================================
-- Sentinel Atlas: Shared intelligence data foundation
-- Creates source registry, canonical incidents, evidence records,
-- incident timelines, and private ingestion/audit tables.
--
-- No destructive operations are included in this migration.
-- ============================================================

-- ============================================================
-- 1. SOURCE REGISTRY
-- ============================================================

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  display_name text not null,
  source_url text,

  source_mode text not null check (
    source_mode in (
      'live_source',
      'prototype_fixture'
    )
  ),

  ingestion_status text not null check (
    ingestion_status in (
      'pending',
      'operational',
      'degraded',
      'fixture_only',
      'unavailable'
    )
  ),

  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.data_sources is
  'Registry of intelligence data sources used by Sentinel Atlas.';

comment on column public.data_sources.source_mode is
  'Whether a source is currently ingested as a live source or represented by prototype fixture data.';

comment on column public.data_sources.ingestion_status is
  'Operational state of the source ingestion pipeline.';

-- ============================================================
-- 2. PRIVATE INGESTION-RUN AUDIT TABLE
-- ============================================================

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null
    references public.data_sources(id)
    on delete restrict,

  status text not null check (
    status in (
      'running',
      'succeeded',
      'partial',
      'failed'
    )
  ),

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  records_received integer not null default 0 check (records_received >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),

  error_message text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.ingestion_runs is
  'Private audit history for server-side source ingestion attempts.';

-- ============================================================
-- 3. CANONICAL INCIDENTS
-- ============================================================

create table public.incidents (
  id uuid primary key default gen_random_uuid(),

  -- Stable identity used for idempotent ingestion.
  -- Example future value: usgs:us7000abcd
  canonical_key text not null unique,

  primary_source_id uuid not null
    references public.data_sources(id)
    on delete restrict,

  hazard_type text not null,

  severity text not null check (
    severity in (
      'advisory',
      'elevated',
      'high',
      'critical'
    )
  ),

  status text not null default 'active' check (
    status in (
      'active',
      'monitoring',
      'resolved',
      'archived'
    )
  ),

  integrity_status text not null default 'pending' check (
    integrity_status in (
      'verified',
      'forecast',
      'pending',
      'unavailable'
    )
  ),

  data_mode text not null check (
    data_mode in (
      'live_source',
      'prototype_fixture'
    )
  ),

  title text not null,
  summary text,

  place_name text,

  latitude numeric(9, 6) check (
    latitude is null
    or latitude between -90 and 90
  ),

  longitude numeric(9, 6) check (
    longitude is null
    or longitude between -180 and 180
  ),

  event_time timestamptz,
  event_end_time timestamptz,

  source_updated_at timestamptz,
  last_source_fetched_at timestamptz,

  magnitude numeric(6, 2),
  depth_km numeric(8, 2),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.incidents is
  'Canonical Sentinel Atlas incidents displayed in maps, feeds, alert rules, and Incident Rooms.';

comment on column public.incidents.canonical_key is
  'Stable source-aware key used to safely upsert future source records.';

comment on column public.incidents.integrity_status is
  'Data confidence label. Verified means sourced from a named record, not independently validated by Sentinel Atlas.';

-- ============================================================
-- 4. INCIDENT SOURCE EVIDENCE LEDGER
-- ============================================================

create table public.incident_sources (
  id uuid primary key default gen_random_uuid(),

  incident_id uuid not null
    references public.incidents(id)
    on delete cascade,

  source_id uuid not null
    references public.data_sources(id)
    on delete restrict,

  source_event_id text not null,
  source_record_url text,

  source_record_title text,

  record_state text not null default 'active' check (
    record_state in (
      'active',
      'updated',
      'archived',
      'unavailable'
    )
  ),

  integrity_status text not null default 'pending' check (
    integrity_status in (
      'verified',
      'forecast',
      'pending',
      'unavailable'
    )
  ),

  data_mode text not null check (
    data_mode in (
      'live_source',
      'prototype_fixture'
    )
  ),

  source_event_time timestamptz,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_id, source_event_id)
);

comment on table public.incident_sources is
  'Public-safe evidence ledger linking canonical incidents to named source records.';

-- ============================================================
-- 5. INCIDENT TIMELINE UPDATES
-- ============================================================

create table public.incident_updates (
  id uuid primary key default gen_random_uuid(),

  incident_id uuid not null
    references public.incidents(id)
    on delete cascade,

  source_id uuid
    references public.data_sources(id)
    on delete set null,

  update_type text not null,

  title text not null,
  body text,

  occurred_at timestamptz not null default now(),

  data_mode text not null check (
    data_mode in (
      'live_source',
      'prototype_fixture'
    )
  ),

  integrity_status text not null check (
    integrity_status in (
      'verified',
      'forecast',
      'pending',
      'unavailable'
    )
  ),

  created_at timestamptz not null default now()
);

comment on table public.incident_updates is
  'Timeline records shown inside Sentinel Atlas Incident Rooms.';

-- ============================================================
-- 6. PRIVATE RAW-SOURCE RECORD CACHE / AUDIT TABLE
-- ============================================================

create table public.source_events (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null
    references public.data_sources(id)
    on delete restrict,

  ingestion_run_id uuid
    references public.ingestion_runs(id)
    on delete set null,

  source_event_id text not null,

  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),

  payload jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_id, source_event_id)
);

comment on table public.source_events is
  'Private latest raw-source payload cache for debugging, reconciliation, and ingestion traceability.';

-- ============================================================
-- 7. UPDATED-AT TRIGGERS
-- Reuses public.set_updated_at() from the profiles migration.
-- ============================================================

create trigger data_sources_set_updated_at
before update on public.data_sources
for each row
execute function public.set_updated_at();

create trigger incidents_set_updated_at
before update on public.incidents
for each row
execute function public.set_updated_at();

create trigger incident_sources_set_updated_at
before update on public.incident_sources
for each row
execute function public.set_updated_at();

create trigger source_events_set_updated_at
before update on public.source_events
for each row
execute function public.set_updated_at();

-- ============================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================

create index incidents_active_event_time_idx
on public.incidents (is_active, event_time desc);

create index incidents_data_mode_idx
on public.incidents (data_mode);

create index incidents_hazard_severity_idx
on public.incidents (hazard_type, severity);

create index incidents_primary_source_idx
on public.incidents (primary_source_id);

create index incident_sources_incident_idx
on public.incident_sources (incident_id);

create index incident_updates_incident_time_idx
on public.incident_updates (incident_id, occurred_at desc);

create index ingestion_runs_source_started_idx
on public.ingestion_runs (source_id, started_at desc);

create index source_events_source_event_idx
on public.source_events (source_id, source_event_id);

-- ============================================================
-- 9. INITIAL SOURCE REGISTRY RECORDS
-- ============================================================

insert into public.data_sources (
  code,
  display_name,
  source_url,
  source_mode,
  ingestion_status
)
values
  (
    'usgs',
    'USGS Earthquake Catalog',
    'https://earthquake.usgs.gov/',
    'live_source',
    'pending'
  ),
  (
    'eonet',
    'NASA EONET',
    'https://eonet.gsfc.nasa.gov/',
    'prototype_fixture',
    'fixture_only'
  ),
  (
    'gdacs',
    'GDACS',
    'https://www.gdacs.org/',
    'prototype_fixture',
    'fixture_only'
  ),
  (
    'open_meteo',
    'Open-Meteo',
    'https://open-meteo.com/',
    'prototype_fixture',
    'fixture_only'
  )
on conflict (code) do update
set
  display_name = excluded.display_name,
  source_url = excluded.source_url,
  source_mode = excluded.source_mode,
  ingestion_status = excluded.ingestion_status,
  updated_at = now();

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- Public browsing is read-only.
-- Ingestion and raw audit records remain backend-only.
-- ============================================================

alter table public.data_sources enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_sources enable row level security;
alter table public.incident_updates enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.source_events enable row level security;

-- Remove default browser-access privileges before adding only
-- the narrowly required public read permissions.

revoke all on table public.data_sources from anon, authenticated;
revoke all on table public.incidents from anon, authenticated;
revoke all on table public.incident_sources from anon, authenticated;
revoke all on table public.incident_updates from anon, authenticated;
revoke all on table public.ingestion_runs from anon, authenticated;
revoke all on table public.source_events from anon, authenticated;

-- Public-safe read access for the map, list views, Incident Rooms,
-- source trust displays, and timeline records.

grant select on table public.data_sources to anon, authenticated;
grant select on table public.incidents to anon, authenticated;
grant select on table public.incident_sources to anon, authenticated;
grant select on table public.incident_updates to anon, authenticated;

-- Future Edge Functions use secure server-side credentials only.
-- Browser clients never receive write access.

grant all on table public.data_sources to service_role;
grant all on table public.incidents to service_role;
grant all on table public.incident_sources to service_role;
grant all on table public.incident_updates to service_role;
grant all on table public.ingestion_runs to service_role;
grant all on table public.source_events to service_role;

create policy "Public can read Sentinel Atlas data sources"
on public.data_sources
for select
to anon, authenticated
using (true);

create policy "Public can read Sentinel Atlas incidents"
on public.incidents
for select
to anon, authenticated
using (true);

create policy "Public can read Sentinel Atlas incident source ledger"
on public.incident_sources
for select
to anon, authenticated
using (true);

create policy "Public can read Sentinel Atlas incident timeline"
on public.incident_updates
for select
to anon, authenticated
using (true);