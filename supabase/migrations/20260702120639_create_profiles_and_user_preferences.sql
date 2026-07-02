-- ============================================================
-- Sentinel Atlas: User profile foundation
-- Creates a secure public profile for each Supabase Auth user.
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (
    display_name is null
    or char_length(trim(display_name)) between 1 and 80
  ),
  avatar_url text,
  timezone text not null default 'UTC',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Sentinel Atlas user profile and personalisation settings.';

comment on column public.profiles.timezone is
  'IANA timezone selected by the user, such as Asia/Kolkata.';

-- Reusable function: keeps updated_at accurate on profile updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Automatically creates a matching public profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ============================================================
-- Security: profiles are private to their owner.
-- ============================================================

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

create policy "Users can view their own Sentinel Atlas profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own Sentinel Atlas profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);