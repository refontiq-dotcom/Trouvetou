-- ============================================================================
-- TROUVETOU — Diagnostic de l'état des migrations (LECTURE SEULE)
--
-- À coller dans : Supabase Dashboard → projet Trouvetou → SQL Editor → New query
-- Ne modifie RIEN (aucun DDL/DML) : uniquement des SELECT.
--
-- But : dire quelles migrations de supabase/migrations/ sont DÉJÀ appliquées
-- sur la base de production et lesquelles restent à passer, sans avoir accès
-- à l'historique supabase_migrations (les migrations ayant été exécutées
-- « à la main » dans le SQL Editor, cet historique est souvent vide).
-- ============================================================================

with checks(ordre, migration, attendu, etat) as (
  values
    -- 1. Durcissement colonne listings.attributes
    (1, '20260828_fix_listings_attributes_leak',
        'anon ne peut pas lire listings.attributes',
        case when not coalesce(
             has_column_privilege('anon', to_regclass('public.listings'), 'attributes', 'select'), true)
             then 'OK' else 'NON APPLIQUE' end),

    -- 2. Table de trafic agrégé
    (2, '20260919_trouvetou_traffic_daily',
        'table trouvetou_traffic_daily presente + RLS',
        case
          when to_regclass('public.trouvetou_traffic_daily') is null then 'NON APPLIQUE'
          when not coalesce(
                 (select relrowsecurity from pg_class
                   where oid = to_regclass('public.trouvetou_traffic_daily')), false)
               then 'PARTIEL (RLS desactivee)'
          when has_table_privilege('anon', to_regclass('public.trouvetou_traffic_daily'), 'select')
               then 'PARTIEL (anon peut lire)'
          else 'OK'
        end),

    -- 3. RPC de comptage du trafic : version FINALE attendue =
    --    ON CONFLICT ON CONSTRAINT + search_path epingle
    (3, '20260920 + 20260925_fix_traffic_rpc_constraint_target',
        'RPC increment_trouvetou_traffic en version finale',
        case
          when to_regprocedure('public.increment_trouvetou_traffic(date,bigint)') is null
            then 'NON APPLIQUE'
          when not exists (
            select 1 from pg_proc p
            where p.oid = to_regprocedure('public.increment_trouvetou_traffic(date,bigint)')
              and p.proconfig @> array['search_path=public'])
            then 'PARTIEL (search_path non epingle)'
          when not exists (
            select 1 from pg_proc p
            where p.oid = to_regprocedure('public.increment_trouvetou_traffic(date,bigint)')
              and p.prosrc like '%on conflict on constraint trouvetou_traffic_daily_pkey%')
            then 'PARTIEL (version intermediaire, colonne day ambigue)'
          else 'OK'
        end),

    -- 4. Drift reconstitue (connecteur Schooly, favoris, profils)
    (4, '20260924_reconstitute_missing_schema',
        'tables schooly_*, favorites, profiles + RPC schooly_sync_school',
        case
          when to_regclass('public.schooly_schools') is null then 'NON APPLIQUE (drift non versionne)'
          when to_regclass('public.schooly_grade_levels') is null then 'PARTIEL (schooly_grade_levels absent)'
          when to_regclass('public.schooly_sync_log') is null then 'PARTIEL (schooly_sync_log absent)'
          when to_regclass('public.favorites') is null then 'PARTIEL (favorites absent)'
          when to_regclass('public.profiles') is null then 'PARTIEL (profiles absent)'
          when to_regprocedure('public.schooly_sync_school(jsonb,jsonb)') is null then 'PARTIEL (RPC absent)'
          else 'OK'
        end),

    -- 5. Fusion du doublon provider Sejourra
    (5, '20260925_merge_sejoura_duplicate_provider',
        'table alias presente + ancien provider 7a358385 supprime',
        case
          when to_regclass('public.provider_api_key_aliases') is null then 'NON APPLIQUE'
          when exists (select 1 from public.providers
                        where id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid)
            then 'PARTIEL (ancien provider encore present)'
          else 'OK'
        end),

    -- 6. Durcissement production
    (6, '20260925_production_audit_hardening',
        'policies deny + privileges retires + search_path epingle',
        case
          when not exists (select 1 from pg_policies
                            where schemaname = 'public' and tablename = 'providers'
                              and policyname = 'providers_select_public')
            then 'NON APPLIQUE'
          when has_table_privilege('anon', to_regclass('public.provider_api_key_aliases'), 'select')
            then 'PARTIEL (anon lit les alias de cles)'
          when has_table_privilege('anon', to_regclass('public.schooly_sync_log'), 'select')
            then 'PARTIEL (anon lit schooly_sync_log)'
          when has_function_privilege('anon', to_regprocedure('public.create_provider(text,text,text,text)'), 'execute')
            then 'PARTIEL (anon execute create_provider)'
          when to_regprocedure('public.schooly_sync_school(jsonb,jsonb)') is not null
               and not exists (
                 select 1 from pg_proc p
                 where p.oid = to_regprocedure('public.schooly_sync_school(jsonb,jsonb)')
                   and p.proconfig @> array['search_path=public'])
            then 'PARTIEL (schooly_sync_school non epingle)'
          else 'OK'
        end),

    -- 7. Index sur la FK canonique
    (7, '20260925_provider_alias_canonical_index',
        'index idx_provider_api_key_aliases_canonical',
        case
          when to_regclass('public.provider_api_key_aliases') is null then 'NON APPLIQUE (table absente)'
          when to_regclass('public.idx_provider_api_key_aliases_canonical') is null then 'NON APPLIQUE'
          else 'OK'
        end)
)
select ordre,
       migration,
       case etat when 'OK' then 'OK - APPLIQUE' else 'ACTION - ' || etat end as statut,
       attendu
from checks
order by ordre;

-- ----------------------------------------------------------------------------
-- Historique CLI : normal qu'il soit vide si vous appliquez les migrations
-- via le SQL Editor plutôt qu'avec `supabase db push`.
-- ----------------------------------------------------------------------------
select case
         when to_regclass('supabase_migrations.schema_migrations') is null
           then 'Pas de table supabase_migrations.schema_migrations : les migrations n''ont PAS été poussées via la CLI (normal avec le SQL Editor).'
         else 'Historique CLI présent : les migrations ont été poussées avec `supabase db push`.'
       end as historique_cli;

-- ----------------------------------------------------------------------------
-- Volumétrie (tables du schéma de base)
-- ----------------------------------------------------------------------------
select 'providers' as objet, count(*)::text as lignes from public.providers
union all select 'listings', count(*)::text from public.listings
union all select 'categories', count(*)::text from public.categories
union all select 'sync_logs', count(*)::text from public.sync_logs
order by 1;

-- ----------------------------------------------------------------------------
-- Volumétrie des tables optionnelles.
-- Le SQL est construit à la volée (EXECUTE) et exécuté seulement si la table
-- existe : ce bloc n'échoue donc jamais sur une base incomplète. Les
-- résultats apparaissent dans les messages (NOTICE) du SQL Editor.
-- ----------------------------------------------------------------------------
do $diag$
declare
  v_table text;
  v_count bigint;
begin
  foreach v_table in array array[
    'favorites', 'profiles', 'schooly_schools', 'schooly_grade_levels',
    'schooly_sync_log', 'trouvetou_traffic_daily', 'provider_api_key_aliases'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      raise notice '% : % lignes', rpad(v_table, 32), v_count;
    else
      raise notice '% : ABSENTE', rpad(v_table, 32);
    end if;
  end loop;
end;
$diag$;
