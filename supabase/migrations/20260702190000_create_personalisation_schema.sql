-- ============================================================
-- Sentinel Atlas: Personalisation schema
-- Creates user-owned watchlists, alert rules, notifications,
-- and briefing data with RLS and service-role access.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. WATCHLISTS
-- ============================================================

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name text not null check (
    char_length(trim(name)) between 1 and 120
  ),

  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.watchlists is
  'User-owned watchlists that group places of interest for Sentinel Atlas alerting.';

create table public.watchlist_locations (
  id uuid primary key default gen_random_uuid(),

  watchlist_id uuid not null
    references public.watchlists(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  label text not null check (
    char_length(trim(label)) between 1 and 120
  ),

  place_name text not null check (
    char_length(trim(place_name)) between 1 and 180
  ),

  country_code text,
  region_name text,

  latitude numeric(9, 6) check (
    latitude is null
    or latitude between -90 and 90
  ),

  longitude numeric(9, 6) check (
    longitude is null
    or longitude between -180 and 180
  ),

  timezone text,

  radius_km numeric(8, 2) not null default 500 check (
    radius_km > 0
  ),

  provider text,
  provider_location_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.watchlist_locations is
  'Geographic locations attached to a user watchlist, including optional provider metadata.';

-- ============================================================
-- 2. ALERT RULES
-- ============================================================

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  watchlist_id uuid
    references public.watchlists(id)
    on delete cascade,

  name text not null check (
    char_length(trim(name)) between 1 and 120
  ),

  hazard_type text check (
    hazard_type is null
    or hazard_type in (
      'earthquake',
      'wildfire',
      'flood',
      'cyclone',
      'volcano',
      'severe-weather'
    )
  ),

  minimum_severity text not null check (
    minimum_severity in (
      'advisory',
      'elevated',
      'high',
      'critical'
    )
  ),

  maximum_distance_km numeric(8, 2) check (
    maximum_distance_km is null
    or maximum_distance_km > 0
  ),

  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.alert_rules is
  'User-defined conditions that match incidents against their watchlists and severity thresholds.';

-- ============================================================
-- 3. NOTIFICATIONS
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  incident_id uuid not null
    references public.incidents(id)
    on delete cascade,

  alert_rule_id uuid
    references public.alert_rules(id)
    on delete set null,

  title text not null check (
    char_length(trim(title)) between 1 and 160
  ),

  body text,

  severity text not null check (
    severity in (
      'advisory',
      'elevated',
      'high',
      'critical'
    )
  ),

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

  matching_reason text,
  read_at timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Personal alert notifications generated from a user alert rule and matched incident.';

create unique index notifications_user_incident_rule_unique_idx
on public.notifications (
  user_id,
  incident_id,
  coalesce(alert_rule_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- ============================================================
-- 4. BRIEFINGS
-- ============================================================

create table public.briefings (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  briefing_date date not null,

  title text not null check (
    char_length(trim(title)) between 1 and 180
  ),

  overall_posture text not null,
  summary text,

  generated_at timestamptz not null default now(),
  data_mode_summary jsonb not null default '{}'::jsonb,

  unique (user_id, briefing_date)
);

comment on table public.briefings is
  'Daily or scheduled personalised briefings generated for a user.';

create table public.briefing_items (
  id uuid primary key default gen_random_uuid(),

  briefing_id uuid not null
    references public.briefings(id)
    on delete cascade,

  incident_id uuid
    references public.incidents(id)
    on delete set null,

  section text not null,
  position integer not null check (position >= 1),

  title text not null check (
    char_length(trim(title)) between 1 and 180
  ),

  body text,

  data_mode text check (
    data_mode is null
    or data_mode in (
      'live_source',
      'prototype_fixture'
    )
  ),

  integrity_status text check (
    integrity_status is null
    or integrity_status in (
      'verified',
      'forecast',
      'pending',
      'unavailable'
    )
  ),

  created_at timestamptz not null default now()
);

comment on table public.briefing_items is
  'Structured content blocks that make up a personalised briefing.';

-- ============================================================
-- 5. UPDATED-AT TRIGGERS
-- ============================================================

create trigger watchlists_set_updated_at
before update on public.watchlists
for each row
execute function public.set_updated_at();

create trigger watchlist_locations_set_updated_at
before update on public.watchlist_locations
for each row
execute function public.set_updated_at();

create trigger alert_rules_set_updated_at
before update on public.alert_rules
for each row
execute function public.set_updated_at();

-- ============================================================
-- 6. INDEXES
-- ============================================================

create index watchlists_user_id_idx
on public.watchlists (user_id);

create index watchlists_is_default_idx
on public.watchlists (is_default);

create index watchlist_locations_watchlist_id_idx
on public.watchlist_locations (watchlist_id);

create index watchlist_locations_user_id_idx
on public.watchlist_locations (user_id);

create index watchlist_locations_coordinates_idx
on public.watchlist_locations (latitude, longitude);

create index alert_rules_user_id_idx
on public.alert_rules (user_id);

create index alert_rules_watchlist_id_idx
on public.alert_rules (watchlist_id);

create index alert_rules_enabled_idx
on public.alert_rules (enabled);

create index notifications_user_id_idx
on public.notifications (user_id);

create index notifications_incident_id_idx
on public.notifications (incident_id);

create index notifications_unread_idx
on public.notifications (user_id, read_at)
where read_at is null;

create index briefings_user_id_idx
on public.briefings (user_id);

create index briefings_briefing_date_idx
on public.briefings (briefing_date);

create index briefing_items_briefing_id_idx
on public.briefing_items (briefing_id);

create index briefing_items_incident_id_idx
on public.briefing_items (incident_id);

-- ============================================================
-- 7. SECURITY
-- ============================================================

alter table public.watchlists enable row level security;
alter table public.watchlist_locations enable row level security;
alter table public.alert_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.briefings enable row level security;
alter table public.briefing_items enable row level security;

revoke all on table public.watchlists from anon;
revoke all on table public.watchlists from authenticated;
revoke all on table public.watchlist_locations from anon;
revoke all on table public.watchlist_locations from authenticated;
revoke all on table public.alert_rules from anon;
revoke all on table public.alert_rules from authenticated;
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
revoke all on table public.briefings from anon;
revoke all on table public.briefings from authenticated;
revoke all on table public.briefing_items from anon;
revoke all on table public.briefing_items from authenticated;

grant select, insert, update, delete on table public.watchlists to authenticated;
grant select, insert, update, delete on table public.watchlist_locations to authenticated;
grant select, insert, update, delete on table public.alert_rules to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select on table public.briefings to authenticated;
grant select on table public.briefing_items to authenticated;

grant select, insert, update, delete on table public.watchlists to service_role;
grant select, insert, update, delete on table public.watchlist_locations to service_role;
grant select, insert, update, delete on table public.alert_rules to service_role;
grant select, insert, update, delete on table public.notifications to service_role;
grant select, insert, update, delete on table public.briefings to service_role;
grant select, insert, update, delete on table public.briefing_items to service_role;

create policy "Users can view their own watchlists"
on public.watchlists
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can manage their own watchlists"
on public.watchlists
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can view their own watchlist locations"
on public.watchlist_locations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can manage their own watchlist locations"
on public.watchlist_locations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can view their own alert rules"
on public.alert_rules
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can manage their own alert rules"
on public.alert_rules
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can view their own notifications"
on public.notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update only the read state of their notifications"
on public.notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can view their own briefings"
on public.briefings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can view their own briefing items"
on public.briefing_items
for select
to authenticated
using (
  exists (
    select 1
    from public.briefings b
    where b.id = briefing_items.briefing_id
      and b.user_id = (select auth.uid())
  )
);
