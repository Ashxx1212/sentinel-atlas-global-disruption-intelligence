-- ============================================================================
-- Sentinel Atlas: authenticated source-operations read model
-- Purpose: expose a narrow, safe, read-only operational history view without
-- granting browser access to public.ingestion_runs or raw ingestion metadata.
-- ============================================================================

begin;

create or replace function public.get_source_operations_recent_runs(
  p_limit integer default 20
)
returns table (
  source_code text,
  display_name text,
  started_at timestamptz,
  completed_at timestamptz,
  status text,
  duration_ms bigint,
  records_received integer,
  records_created integer,
  records_updated integer,
  final_provider_outcome text,
  retry_count integer,
  retryable_failure_count integer,
  successful_response_count integer,
  failure_summary_count integer,
  retained_stored_records boolean,
  failure_summaries jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  with bounded_limit as (
    select least(greatest(coalesce(p_limit, 20), 1), 50) as value
  )
  select
    sources.code as source_code,
    sources.display_name,
    runs.started_at,
    runs.completed_at,
    runs.status,
    case
      when runs.completed_at is null then null
      else greatest(
        0,
        floor(extract(epoch from (runs.completed_at - runs.started_at)) * 1000)
      )::bigint
    end as duration_ms,
    runs.records_received,
    runs.records_created,
    runs.records_updated,
    nullif(runs.metadata ->> 'final_provider_outcome', '') as final_provider_outcome,
    case
      when coalesce(runs.metadata ->> 'retry_count', '') ~ '^[0-9]+$'
        then (runs.metadata ->> 'retry_count')::integer
      else 0
    end as retry_count,
    case
      when coalesce(runs.metadata ->> 'retryable_failure_count', '') ~ '^[0-9]+$'
        then (runs.metadata ->> 'retryable_failure_count')::integer
      else 0
    end as retryable_failure_count,
    case
      when coalesce(runs.metadata -> 'provider_status' ->> 'http_200', '') ~ '^[0-9]+$'
        then (runs.metadata -> 'provider_status' ->> 'http_200')::integer
      else 0
    end as successful_response_count,
    case
      when jsonb_typeof(runs.metadata -> 'provider_failure_summaries') = 'array'
        then jsonb_array_length(runs.metadata -> 'provider_failure_summaries')
      else 0
    end as failure_summary_count,
    lower(coalesce(runs.metadata ->> 'retained_stored_records', '')) = 'true'
      as retained_stored_records,
    coalesce(
      (
        select jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'category', summary.item ->> 'category',
              'partition', summary.item ->> 'partition',
              'status', summary.item ->> 'status',
              'attempts',
                case
                  when coalesce(summary.item ->> 'attempts', '') ~ '^[0-9]+$'
                    then (summary.item ->> 'attempts')::integer
                  else null
                end,
              'outcome', summary.item ->> 'outcome'
            )
          )
        )
        from jsonb_array_elements(
          case
            when jsonb_typeof(runs.metadata -> 'provider_failure_summaries') = 'array'
              then runs.metadata -> 'provider_failure_summaries'
            else '[]'::jsonb
          end
        ) as summary(item)
      ),
      '[]'::jsonb
    ) as failure_summaries
  from public.ingestion_runs as runs
  join public.data_sources as sources
    on sources.id = runs.source_id
  order by runs.started_at desc
  limit (select value from bounded_limit);
$function$;

revoke all on function public.get_source_operations_recent_runs(integer) from public;
grant execute on function public.get_source_operations_recent_runs(integer) to authenticated;

comment on function public.get_source_operations_recent_runs(integer) is
  'Authenticated, read-only, sanitized operational history for Sentinel Atlas source ingestion.';

commit;
