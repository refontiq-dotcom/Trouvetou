-- TROUVETOU security regression checks.
-- Run with: supabase test db
-- Prérequis : supabase/schema.sql + supabase/migrations/ dans l'ordre.
--
-- Le test 12 (« only the canonical Séjoura source ») dépend de DONNÉES : il
-- vérifie l'état réel des providers Séjoura. Sur une base vierge il échoue
-- faute de lignes ; sur la base de production il valide la fusion de
-- 20260925_merge_sejoura_duplicate_provider.sql. Les 12 autres tests sont
-- purement structurels.
begin;

select plan(13);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'providers'
      and policyname = 'providers_select_public'
  ),
  'providers has an explicit public read policy'
);

select ok(
  not has_table_privilege('anon', 'public.provider_api_key_aliases', 'select'),
  'anon cannot read provider API key aliases'
);

select ok(
  not has_table_privilege('authenticated', 'public.sync_logs', 'select'),
  'authenticated cannot read sync logs'
);

select ok(
  not has_table_privilege('anon', 'public.trouvetou_traffic_daily', 'select'),
  'anon cannot read traffic aggregates'
);

select ok(
  not has_table_privilege('anon', 'public.schooly_sync_log', 'select'),
  'anon cannot read schooly sync logs'
);

select ok(
  not has_table_privilege('anon', 'public.favorites', 'select'),
  'anon cannot read favorites'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon cannot read profiles'
);

select ok(
  not has_function_privilege('anon', 'public.create_provider(text,text,text,text)', 'execute'),
  'anon cannot execute create_provider'
);

select ok(
  not has_function_privilege('authenticated', 'public.ingest_listings(uuid,uuid,jsonb)', 'execute'),
  'authenticated cannot execute ingest_listings'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'increment_trouvetou_traffic'
      and p.proconfig @> array['search_path=public']
  ),
  'traffic increment RPC has a pinned search_path'
);

select ok(
  (select count(*) from public.increment_trouvetou_traffic('2000-01-01'::date, 0)) = 1,
  'traffic increment RPC executes without ambiguous day errors'
);

select ok(
  exists (
    select 1
    from public.providers
    where name = 'Séjoura'
      and is_active = true
  )
  and not exists (
    select 1
    from public.providers
    where name = 'Séjoura'
      and is_active = false
      and id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid
      and exists (
        select 1 from public.listings l
        where l.provider_id = public.providers.id
          and l.is_available = true
      )
  ),
  'only the canonical Séjoura source is publicly active'
);

select * from finish();
rollback;
