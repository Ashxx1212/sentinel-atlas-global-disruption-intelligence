-- Keep the authenticated user's private Notification Centre up to date
-- while the application is open. Realtime still respects the existing
-- notifications SELECT RLS policy, so a subscriber can receive only rows
-- the signed-in user is already allowed to read.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
