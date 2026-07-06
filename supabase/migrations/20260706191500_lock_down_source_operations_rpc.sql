-- ============================================================================
-- Sentinel Atlas: lock down Source Operations RPC execution privileges
-- ============================================================================

begin;

revoke all on function public.get_source_operations_recent_runs(integer) from public;
revoke all on function public.get_source_operations_recent_runs(integer) from anon;
revoke all on function public.get_source_operations_recent_runs(integer) from authenticated;
revoke all on function public.get_source_operations_recent_runs(integer) from service_role;

grant execute on function public.get_source_operations_recent_runs(integer) to authenticated;

commit;
