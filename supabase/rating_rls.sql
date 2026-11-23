-- public.rating: one row per (authUID, placeOsmId, feature)
-- Place labels/coords live in the app AsyncStorage cache (Nominatim), not in DB.

alter table public.rating
  drop constraint if exists "rating_placeOsmId_fkey";

alter table public.rating
  add column if not exists "authUID" uuid references public.users ("authUID") on delete cascade;

delete from public.rating where "authUID" is null;

alter table public.rating
  alter column "authUID" set not null;

drop index if exists rating_authuid_place_feature_uidx;

alter table public.rating
  drop constraint if exists rating_authuid_place_feature_key;

alter table public.rating
  add constraint rating_authuid_place_feature_key
  unique ("authUID", "placeOsmId", feature);

alter table public.rating enable row level security;

drop policy if exists "rating_select_authenticated" on public.rating;
drop policy if exists "rating_insert_own" on public.rating;
drop policy if exists "rating_update_own" on public.rating;
drop policy if exists "rating_delete_own" on public.rating;

create policy "rating_select_authenticated"
  on public.rating
  for select
  to authenticated
  using (true);

create policy "rating_insert_own"
  on public.rating
  for insert
  to authenticated
  with check ("authUID" = auth.uid());

create policy "rating_update_own"
  on public.rating
  for update
  to authenticated
  using ("authUID" = auth.uid())
  with check ("authUID" = auth.uid());

create policy "rating_delete_own"
  on public.rating
  for delete
  to authenticated
  using ("authUID" = auth.uid());
