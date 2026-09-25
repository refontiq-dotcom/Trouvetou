-- TROUVETOU — Audit production hardening
-- 2026-09-25
--
-- Goals:
-- 1. Restore a single public identity for Séjoura: the canonical provider.
-- 2. Keep the current legacy Séjoura API key working through the alias table,
--    but route its ingestion into the canonical provider.
-- 3. Hide inactive-provider listings from the public catalog.
-- 4. Remove Data API access to internal tables/functions.
-- 5. Pin SECURITY DEFINER search_path configuration.

begin;

-- ---------------------------------------------------------------------------
-- 1. Séjoura provider identity
-- ---------------------------------------------------------------------------

-- The legacy/current production key belongs to this provider. Keep its hash
-- as an alias, but make the canonical provider the only active public source.
insert into public.provider_api_key_aliases (
  legacy_provider_id,
  canonical_provider_id,
  api_key_hash,
  is_active
)
select
  '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid,
  'a5101284-2d97-46e0-a0f2-fa6a008588f2'::uuid,
  p.api_key_hash,
  true
from public.providers p
where p.id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid
on conflict (legacy_provider_id) do update
set canonical_provider_id = excluded.canonical_provider_id,
    api_key_hash = excluded.api_key_hash,
    is_active = true;

update public.providers
set is_active = true
where id = 'a5101284-2d97-46e0-a0f2-fa6a008588f2'::uuid;

update public.providers
set is_active = false
where id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid;

-- The legacy rows remain for audit/history but must not be publicly visible.
update public.listings
set is_available = false
where provider_id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid;

-- ---------------------------------------------------------------------------
-- 2. Public catalog access
-- ---------------------------------------------------------------------------

-- Providers are public identity metadata only. Sensitive columns remain
-- inaccessible to anon/authenticated.
alter table public.providers enable row level security;
drop policy if exists providers_select_public on public.providers;
create policy providers_select_public
  on public.providers
  for select
  to anon, authenticated
  using (is_active = true);

revoke all on public.providers from anon, authenticated;
grant select (id, name, category_id, is_active, created_at, updated_at)
  on public.providers to anon, authenticated;

-- The public API route uses service_role, but direct public access to listings
-- should still respect the provider's active state.
drop policy if exists listings_select_public on public.listings;
create policy listings_select_public
  on public.listings
  for select
  to anon, authenticated
  using (
    is_available = true
    and exists (
      select 1
      from public.providers p
      where p.id = listings.provider_id
        and p.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Lock internal tables down to service_role
-- ---------------------------------------------------------------------------

revoke all on public.provider_api_key_aliases from anon, authenticated;
revoke all on public.sync_logs from anon, authenticated;
revoke all on public.schooly_sync_log from anon, authenticated;
revoke all on public.trouvetou_traffic_daily from anon, authenticated;

-- Explicit deny policies document the intended access model and silence the
-- "RLS enabled with no policy" ambiguity without granting any access.
drop policy if exists provider_api_key_aliases_no_public_access on public.provider_api_key_aliases;
create policy provider_api_key_aliases_no_public_access
  on public.provider_api_key_aliases
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists sync_logs_no_public_access on public.sync_logs;
create policy sync_logs_no_public_access
  on public.sync_logs
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists schooly_sync_log_no_public_access on public.schooly_sync_log;
create policy schooly_sync_log_no_public_access
  on public.schooly_sync_log
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists trouvetou_traffic_daily_no_public_access on public.trouvetou_traffic_daily;
create policy trouvetou_traffic_daily_no_public_access
  on public.trouvetou_traffic_daily
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 4. SECURITY DEFINER hardening
-- ---------------------------------------------------------------------------

-- These functions are server-only. Their EXECUTE privilege must never be
-- available through the public Data API.
revoke all on function public.create_provider(text, text, text, text) from public, anon, authenticated;
revoke all on function public.purge_provider_listings(uuid) from public, anon, authenticated;
revoke all on function public.ingest_listings(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.schooly_sync_school(jsonb, jsonb) from public, anon, authenticated;

-- Keep the traffic increment callable only by the server-side service role.
revoke all on function public.increment_trouvetou_traffic(date, bigint) from public, anon, authenticated;
grant execute on function public.increment_trouvetou_traffic(date, bigint) to service_role;

-- Pin the function resolution path. "public" is fixed and contains the
-- application tables/functions referenced by these routines.
alter function public.create_provider(text, text, text, text) set search_path = public;
alter function public.purge_provider_listings(uuid) set search_path = public;
alter function public.ingest_listings(uuid, uuid, jsonb) set search_path = public;
alter function public.rls_auto_enable() set search_path = public;
alter function public.schooly_sync_school(jsonb, jsonb) set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
alter function public.set_trouvetou_traffic_daily_updated_at() set search_path = public;
alter function public.increment_trouvetou_traffic(date, bigint) set search_path = public;

commit;
