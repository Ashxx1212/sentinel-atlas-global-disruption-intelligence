-- ============================================================
-- Sentinel Atlas: Scheduled live-source refreshes
-- Schedules server-side source ingestion through Supabase Cron,
-- pg_net, and Vault-backed custom ingestion-token headers.
--
-- This migration does not expose ingestion paths to browser roles.
-- ============================================================

-- pg_net is the Supabase-supported async HTTP extension used by Cron.
-- pg_net creates and uses its own internal `net` schema.
create extension if not exists pg_net;

-- Supabase Cron is installed in pg_catalog and creates the `cron` schema.
create extension if not exists pg_cron
with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Fail before scheduling jobs unless the required Vault secret names exist.
-- This checks Vault metadata only; it does not read or expose secret values.
do $$
begin
  if pg_catalog.to_regclass('vault.secrets') is null then
    raise exception 'Supabase Vault metadata table vault.secrets is not available. Create the required Vault secrets before applying scheduled refreshes.';
  end if;

  if not exists (
    select 1
    from vault.secrets
    where name = 'sentinel_atlas_project_url'
  ) then
    raise exception 'Required Vault secret sentinel_atlas_project_url is missing. Create it before applying scheduled refreshes.';
  end if;

  if not exists (
    select 1
    from vault.secrets
    where name = 'sentinel_ingestion_token'
  ) then
    raise exception 'Required Vault secret sentinel_ingestion_token is missing. Create it before applying scheduled refreshes.';
  end if;
end;
$$;

create schema if not exists sentinel_internal;

revoke all on schema sentinel_internal from public, anon, authenticated;

create or replace function sentinel_internal.enqueue_ingestion_sync(
  p_source_code text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_slug text;
  v_source_id uuid;
  v_project_url text;
  v_ingestion_token text;
  v_request_id bigint;
begin
  v_function_slug := case p_source_code
    when 'usgs' then 'sync-usgs-earthquakes'
    when 'eonet' then 'sync-eonet-events'
    when 'gdacs' then 'sync-gdacs-events'
    else null
  end;

  if v_function_slug is null then
    raise exception 'Unsupported Sentinel Atlas scheduled source code: %', p_source_code
      using errcode = '22023';
  end if;

  select data_sources.id
  into v_source_id
  from public.data_sources
  where data_sources.code = p_source_code;

  if v_source_id is null then
    raise exception 'Sentinel Atlas source registry record was not found for source code: %', p_source_code
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.ingestion_runs
    where ingestion_runs.source_id = v_source_id
      and ingestion_runs.status = 'running'
      and ingestion_runs.started_at >= pg_catalog.now() - interval '20 minutes'
  ) then
    return null;
  end if;

  select decrypted_secrets.decrypted_secret
  into v_project_url
  from vault.decrypted_secrets
  where decrypted_secrets.name = 'sentinel_atlas_project_url';

  if v_project_url is null or pg_catalog.btrim(v_project_url) = '' then
    raise exception 'Required Vault secret sentinel_atlas_project_url is missing or empty.'
      using errcode = '22023';
  end if;

  select decrypted_secrets.decrypted_secret
  into v_ingestion_token
  from vault.decrypted_secrets
  where decrypted_secrets.name = 'sentinel_ingestion_token';

  if v_ingestion_token is null or pg_catalog.btrim(v_ingestion_token) = '' then
    raise exception 'Required Vault secret sentinel_ingestion_token is missing or empty.'
      using errcode = '22023';
  end if;

  select net.http_post(
    url := pg_catalog.rtrim(v_project_url, '/') || '/functions/v1/' || v_function_slug,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sentinel-ingestion-token', v_ingestion_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function sentinel_internal.enqueue_ingestion_sync(text) from public, anon, authenticated;

-- The migration owner/scheduler retains execution rights through ownership.
-- Granting postgres keeps hosted Supabase Cron execution explicit without
-- opening the helper to browser roles.
grant usage on schema sentinel_internal to postgres;
grant execute on function sentinel_internal.enqueue_ingestion_sync(text) to postgres;

select cron.schedule(
  'sentinel-sync-usgs-earthquakes',
  '3,18,33,48 * * * *',
  $$select sentinel_internal.enqueue_ingestion_sync('usgs');$$
);

select cron.schedule(
  'sentinel-sync-gdacs-cyclones',
  '11 */2 * * *',
  $$select sentinel_internal.enqueue_ingestion_sync('gdacs');$$
);

select cron.schedule(
  'sentinel-sync-eonet-events',
  '27 */4 * * *',
  $$select sentinel_internal.enqueue_ingestion_sync('eonet');$$
);

-- Operational notes:
--
-- To deactivate jobs without deleting run history:
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'sentinel-sync-usgs-earthquakes'), active := false);
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'sentinel-sync-gdacs-cyclones'), active := false);
-- select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'sentinel-sync-eonet-events'), active := false);
--
-- To unschedule jobs:
-- select cron.unschedule('sentinel-sync-usgs-earthquakes');
-- select cron.unschedule('sentinel-sync-gdacs-cyclones');
-- select cron.unschedule('sentinel-sync-eonet-events');
--
-- To inspect recent Cron runs:
-- select *
-- from cron.job_run_details
-- where jobid in (
--   select jobid
--   from cron.job
--   where jobname in (
--     'sentinel-sync-usgs-earthquakes',
--     'sentinel-sync-gdacs-cyclones',
--     'sentinel-sync-eonet-events'
--   )
-- )
-- order by start_time desc
-- limit 50;
--
-- To inspect failed pg_net responses:
-- select id, status_code, error_msg, created
-- from net._http_response
-- where status_code >= 400
--    or error_msg is not null
--    or timed_out is true
-- order by created desc
-- limit 50;
--
-- To check durable ingestion status:
-- select code, display_name, ingestion_status, last_success_at, last_error_at, last_error_message
-- from public.data_sources
-- where code in ('usgs', 'eonet', 'gdacs')
-- order by code;
--
-- select runs.id, sources.code, runs.status, runs.started_at, runs.completed_at,
--        runs.records_received, runs.records_created, runs.records_updated, runs.error_message
-- from public.ingestion_runs as runs
-- join public.data_sources as sources on sources.id = runs.source_id
-- where sources.code in ('usgs', 'eonet', 'gdacs')
-- order by runs.started_at desc
-- limit 50;
