begin;

-- Coalesce overlapping rule matches so one source incident produces at most
-- one private notification per user. Existing per-rule notification rows are
-- merged before the new unique index is created.

with duplicate_groups as (
  select
    notification.user_id,
    notification.incident_id,
    (array_agg(
      notification.id
      order by notification.created_at asc, notification.id asc
    ))[1] as keeper_notification_id,
    count(*)::integer as matched_rule_count,
    coalesce(
      string_agg(
        coalesce(format('"%s"', rule.name), '"a removed alert rule"'),
        '; '
        order by coalesce(rule.name, 'a removed alert rule'), notification.id
      ),
      '"a legacy alert rule"'
    ) as rule_name_summary
  from public.notifications as notification
  left join public.alert_rules as rule
    on rule.id = notification.alert_rule_id
  group by notification.user_id, notification.incident_id
  having count(*) > 1
),
normalized_duplicate_keepers as (
  update public.notifications as notification
  set
    alert_rule_id = null,
    body = format(
      'Matched %s alert rules: %s. This is a source-backed record and not an official emergency warning.',
      duplicate_group.matched_rule_count,
      duplicate_group.rule_name_summary
    ),
    matching_reason = format(
      'Previously matched %s alert rules: %s.',
      duplicate_group.matched_rule_count,
      duplicate_group.rule_name_summary
    )
  from duplicate_groups as duplicate_group
  where notification.id = duplicate_group.keeper_notification_id
  returning notification.id
)
delete from public.notifications as notification
using duplicate_groups as duplicate_group
where notification.user_id = duplicate_group.user_id
  and notification.incident_id = duplicate_group.incident_id
  and notification.id <> duplicate_group.keeper_notification_id;

drop index if exists public.notifications_user_incident_rule_unique_idx;

create unique index if not exists notifications_user_incident_unique_idx
on public.notifications (user_id, incident_id);

comment on index public.notifications_user_incident_unique_idx is
  'Enforces one private notification per user and source incident, even when multiple alert rules match.';

comment on column public.notifications.alert_rule_id is
  'Legacy single-rule reference. Coalesced evaluator notifications leave this NULL and snapshot all matching rule names in body and matching_reason.';

-- Evaluate only supplied source-backed candidates. Browser roles cannot execute
-- this function. Ingestion functions invoke it with service-role credentials
-- only after persistence succeeds.
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
      incident.id,
      incident.hazard_type,
      incident.severity,
      incident.integrity_status,
      incident.data_mode,
      incident.title,
      incident.latitude::double precision as latitude,
      incident.longitude::double precision as longitude
    from public.incidents as incident
    join candidate_ids as candidate
      on candidate.incident_id = incident.id
    where incident.is_active = true
      and incident.data_mode = 'live_source'
      and incident.latitude is not null
      and incident.longitude is not null
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
    from candidates as candidate
    join public.alert_rules as rule
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
    join public.watchlist_locations as location
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
    from rule_location_distances as distance
    where distance.distance_km <= distance.effective_radius_km
  ),
  nearest_matches as (
    select *
    from matching_rule_locations
    where proximity_rank = 1
  ),
  coalesced_matches as (
    select
      match.user_id,
      match.incident_id,
      match.severity,
      match.data_mode,
      match.integrity_status,
      match.incident_title,
      count(*)::integer as matched_rule_count,
      string_agg(
        format(
          '"%s" within %s km of %s',
          match.rule_name,
          to_char(round(match.distance_km)::numeric, 'FM999999990'),
          match.location_label
        ),
        '; '
        order by lower(match.rule_name), match.alert_rule_id
      ) as rule_match_summary
    from nearest_matches as match
    group by
      match.user_id,
      match.incident_id,
      match.severity,
      match.data_mode,
      match.integrity_status,
      match.incident_title
  ),
  notification_payloads as (
    select
      match.user_id,
      match.incident_id,
      left(
        format(
          '%s alert: %s',
          initcap(replace(match.severity, '_', ' ')),
          match.incident_title
        ),
        160
      ) as title,
      format(
        'Matched %s alert rule%s: %s. This is a source-backed record and not an official emergency warning.',
        match.matched_rule_count,
        case when match.matched_rule_count = 1 then '' else 's' end,
        match.rule_match_summary
      ) as body,
      match.severity,
      match.data_mode,
      match.integrity_status,
      format(
        'Matched %s alert rule%s: %s.',
        match.matched_rule_count,
        case when match.matched_rule_count = 1 then '' else 's' end,
        match.rule_match_summary
      ) as matching_reason
    from coalesced_matches as match
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
      payload.user_id,
      payload.incident_id,
      null::uuid,
      payload.title,
      payload.body,
      payload.severity,
      payload.data_mode,
      payload.integrity_status,
      payload.matching_reason,
      null
    from notification_payloads as payload
    on conflict (user_id, incident_id) do nothing
    returning id
  ),
  refreshed_existing_notifications as (
    update public.notifications as notification
    set
      alert_rule_id = null,
      title = payload.title,
      body = payload.body,
      severity = payload.severity,
      data_mode = payload.data_mode,
      integrity_status = payload.integrity_status,
      matching_reason = payload.matching_reason
    from notification_payloads as payload
    where notification.user_id = payload.user_id
      and notification.incident_id = payload.incident_id
    returning notification.id
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
  'Private service-role evaluator for supplied source-backed candidates. Coalesces all matching rules into one notification per user and incident.';

commit;
