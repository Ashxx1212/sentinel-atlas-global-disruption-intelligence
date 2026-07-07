begin;

-- Alert rules can optionally target one saved location instead of every
-- location in their watchlist. Existing rows retain NULL, meaning
-- "all saved locations" for backwards-compatible matching.
alter table public.alert_rules
add column if not exists watchlist_location_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'alert_rules_watchlist_location_id_fkey'
      and conrelid = 'public.alert_rules'::regclass
  ) then
    alter table public.alert_rules
    add constraint alert_rules_watchlist_location_id_fkey
    foreign key (watchlist_location_id)
    references public.watchlist_locations(id)
    on delete no action;
  end if;
end
$$;

create index if not exists alert_rules_enabled_scope_idx
on public.alert_rules (user_id, watchlist_id, watchlist_location_id)
where enabled;

-- A location-scoped rule must refer to a location owned by the same user
-- and in the exact watchlist referenced by the rule. This is enforced below
-- the browser/RLS layer so service-role writes remain safe as well.
create or replace function public.validate_alert_rule_location_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_user_id uuid;
  v_location_watchlist_id uuid;
begin
  if new.watchlist_location_id is null then
    return new;
  end if;

  select
    location.user_id,
    location.watchlist_id
  into
    v_location_user_id,
    v_location_watchlist_id
  from public.watchlist_locations as location
  where location.id = new.watchlist_location_id;

  if not found then
    raise exception 'Alert rule target location was not found.'
      using errcode = '23503';
  end if;

  if new.user_id is distinct from v_location_user_id then
    raise exception 'Alert rule target location must belong to the same user.'
      using errcode = '23514';
  end if;

  if new.watchlist_id is distinct from v_location_watchlist_id then
    raise exception 'Alert rule target location must belong to the rule watchlist.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_alert_rule_location_scope_trigger
on public.alert_rules;

create trigger validate_alert_rule_location_scope_trigger
before insert or update of user_id, watchlist_id, watchlist_location_id
on public.alert_rules
for each row
execute function public.validate_alert_rule_location_scope();

-- Keep RLS checks clear and fail early for browser writes. The trigger above
-- repeats the invariant for trusted server-side writes.
drop policy if exists "Users can manage their own alert rules"
on public.alert_rules;

create policy "Users can manage their own alert rules"
on public.alert_rules
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    watchlist_id is null
    or exists (
      select 1
      from public.watchlists as watchlist
      where watchlist.id = alert_rules.watchlist_id
        and watchlist.user_id = (select auth.uid())
    )
  )
  and (
    watchlist_location_id is null
    or exists (
      select 1
      from public.watchlist_locations as location
      where location.id = alert_rules.watchlist_location_id
        and location.user_id = (select auth.uid())
        and location.watchlist_id = alert_rules.watchlist_id
    )
  )
);

comment on column public.alert_rules.watchlist_location_id is
  'Optional single saved-location target. NULL means the rule applies to all locations in its watchlist.';

comment on function public.validate_alert_rule_location_scope() is
  'Enforces same-user and same-watchlist ownership for location-scoped alert rules.';

-- Preserve all existing candidate, severity, distance and notification-dedupe
-- semantics while narrowing location-scoped rules to their selected location.
-- Evaluates only explicitly supplied, source-backed incident candidates.
-- Browser roles cannot execute this function. Ingestion functions call it
-- with service-role credentials after their own persistence succeeds.
create or replace function public.evaluate_alert_candidates(
  p_incident_ids uuid[]
)
returns table (
  candidate_incident_count integer,
  matching_rule_location_count integer,
  notifications_inserted integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_incident_count integer := 0;
  v_matching_rule_location_count integer := 0;
  v_notifications_inserted integer := 0;
begin
  if p_incident_ids is null or cardinality(p_incident_ids) = 0 then
    return query
    select
      0::integer,
      0::integer,
      0::integer;
    return;
  end if;

  with candidate_ids as (
    select distinct unnest(p_incident_ids) as incident_id
  ),
  candidates as (
    select
      i.id,
      i.hazard_type,
      i.severity,
      i.integrity_status,
      i.data_mode,
      i.title,
      i.latitude::double precision as latitude,
      i.longitude::double precision as longitude
    from public.incidents i
    join candidate_ids candidate
      on candidate.incident_id = i.id
    where i.is_active = true
      and i.data_mode = 'live_source'
      and i.latitude is not null
      and i.longitude is not null
  ),
  rule_location_distances as (
    select
      candidate.id as incident_id,
      candidate.hazard_type,
      candidate.severity,
      candidate.integrity_status,
      candidate.data_mode,
      candidate.title as incident_title,
      rule.id as alert_rule_id,
      rule.user_id,
      rule.name as rule_name,
      location.id as location_id,
      location.label as location_label,
      least(
        location.radius_km::double precision,
        coalesce(
          rule.maximum_distance_km::double precision,
          location.radius_km::double precision
        )
      ) as effective_radius_km,
      6371.0088::double precision * 2 * asin(
        sqrt(
          least(
            1.0::double precision,
            greatest(
              0.0::double precision,
              power(
                sin(
                  radians(
                    (candidate.latitude - location.latitude::double precision)
                    / 2
                  )
                ),
                2
              )
              + cos(radians(candidate.latitude))
                * cos(radians(location.latitude::double precision))
                * power(
                  sin(
                    radians(
                      (candidate.longitude - location.longitude::double precision)
                      / 2
                    )
                  ),
                  2
                )
            )
          )
        )
      ) as distance_km
    from candidates candidate
    join public.alert_rules rule
      on rule.enabled = true
      and (rule.hazard_type is null or rule.hazard_type = candidate.hazard_type)
      and (
        case candidate.severity
          when 'advisory' then 1
          when 'elevated' then 2
          when 'high' then 3
          when 'critical' then 4
          else 0
        end
      ) >= (
        case rule.minimum_severity
          when 'advisory' then 1
          when 'elevated' then 2
          when 'high' then 3
          when 'critical' then 4
          else 5
        end
      )
    join public.watchlist_locations location
      on location.user_id = rule.user_id
      and (
        rule.watchlist_id is null
        or location.watchlist_id = rule.watchlist_id
      )
      and (
        rule.watchlist_location_id is null
        or location.id = rule.watchlist_location_id
      )
      and location.latitude is not null
      and location.longitude is not null
  ),
  matching_rule_locations as (
    select
      distance.*,
      row_number() over (
        partition by distance.user_id, distance.incident_id, distance.alert_rule_id
        order by distance.distance_km asc, distance.location_id
      ) as proximity_rank
    from rule_location_distances distance
    where distance.distance_km <= distance.effective_radius_km
  ),
  nearest_matches as (
    select *
    from matching_rule_locations
    where proximity_rank = 1
  ),
  inserted_notifications as (
    insert into public.notifications (
      user_id,
      incident_id,
      alert_rule_id,
      title,
      body,
      severity,
      data_mode,
      integrity_status,
      matching_reason,
      read_at
    )
    select
      match.user_id,
      match.incident_id,
      match.alert_rule_id,
      left(
        format(
          '%s alert: %s',
          initcap(replace(match.severity, '_', ' ')),
          match.incident_title
        ),
        160
      ),
      left(
        format(
          'Matched rule "%s" within %s km of %s. This is a source-backed record and not an official emergency warning.',
          match.rule_name,
          to_char(round(match.distance_km)::numeric, 'FM999999990'),
          match.location_label
        ),
        800
      ),
      match.severity,
      match.data_mode,
      match.integrity_status,
      left(
        format(
          'Rule "%s" matched %s km from %s.',
          match.rule_name,
          to_char(round(match.distance_km)::numeric, 'FM999999990'),
          match.location_label
        ),
        500
      ),
      null
    from nearest_matches match
    on conflict do nothing
    returning id
  )
  select
    (select count(*)::integer from candidates),
    (select count(*)::integer from nearest_matches),
    (select count(*)::integer from inserted_notifications)
  into
    v_candidate_incident_count,
    v_matching_rule_location_count,
    v_notifications_inserted;

  return query
  select
    v_candidate_incident_count,
    v_matching_rule_location_count,
    v_notifications_inserted;
end;
$$;

revoke all on function public.evaluate_alert_candidates(uuid[]) from public;
revoke all on function public.evaluate_alert_candidates(uuid[]) from anon;
revoke all on function public.evaluate_alert_candidates(uuid[]) from authenticated;
revoke all on function public.evaluate_alert_candidates(uuid[]) from service_role;
grant execute on function public.evaluate_alert_candidates(uuid[]) to service_role;

comment on function public.evaluate_alert_candidates(uuid[]) is
  'Private server-side evaluator for supplied source-backed incident candidates. Matches enabled user rules and saved locations, then inserts deduplicated private notifications.';

commit;
