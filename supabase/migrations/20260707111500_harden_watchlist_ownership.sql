begin;

-- Keep exactly one default watchlist per user. If an older version allowed
-- duplicate defaults, retain the oldest and make the rest non-default before
-- creating the partial unique index.
with ranked_default_watchlists as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at asc, id asc
    ) as default_rank
  from public.watchlists
  where is_default = true
)
update public.watchlists as watchlist
set is_default = false
from ranked_default_watchlists as ranked
where watchlist.id = ranked.id
  and ranked.default_rank > 1;

create unique index if not exists watchlists_one_default_per_user_idx
on public.watchlists (user_id)
where is_default = true;

-- User-owned child rows must point only to watchlists owned by the same
-- authenticated account. The existing user_id checks remain in place; this
-- adds relational ownership validation for insert and update paths.
drop policy if exists "Users can manage their own watchlist locations"
on public.watchlist_locations;

create policy "Users can manage their own watchlist locations"
on public.watchlist_locations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.watchlists as watchlist
    where watchlist.id = watchlist_locations.watchlist_id
      and watchlist.user_id = (select auth.uid())
  )
);

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
);

comment on index public.watchlists_one_default_per_user_idx is
  'Ensures each user has at most one default Sentinel Atlas watchlist.';

commit;
