-- Sentinel Atlas: allow authenticated users to create only their own profile.
-- Required because frontend onboarding uses an upsert against public.profiles.

grant insert on table public.profiles to authenticated;

drop policy if exists "Users can create their own Sentinel Atlas profile"
on public.profiles;

create policy "Users can create their own Sentinel Atlas profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);