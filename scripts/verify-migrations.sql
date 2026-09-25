-- ============================================================================
-- TROUVETOU — Vérification APRÈS application des migrations (LECTURE SEULE)
--
-- À coller dans : Supabase Dashboard → projet Trouvetou → SQL Editor → New query
-- Ne modifie AUCUNE donnée (la seule écriture est annulée par un ROLLBACK).
--
-- Deux résultats :
--   1. le tableau des contrôles (une ligne = un contrôle, OK / ÉCHEC)
--   2. le verdict global : 'TOUT EST OK' ou le nombre de contrôles en échec
-- ============================================================================

with checks(ordre, categorie, libelle, ok) as (
  values
    -- ---------------------------------------------------------------- SÉCURITÉ
    (1, 'securite', 'anon ne peut pas lire listings.attributes (secret fournisseur)',
        not coalesce(has_column_privilege('anon', to_regclass('public.listings'), 'attributes', 'select'), true)),

    (2, 'securite', 'anon ne peut pas lire les alias de clés API',
        not coalesce(has_table_privilege('anon', to_regclass('public.provider_api_key_aliases'), 'select'), true)),

    (3, 'securite', 'authenticated ne peut pas lire les sync_logs',
        not coalesce(has_table_privilege('authenticated', to_regclass('public.sync_logs'), 'select'), true)),

    (4, 'securite', 'anon ne peut pas lire les agrégats de trafic',
        not coalesce(has_table_privilege('anon', to_regclass('public.trouvetou_traffic_daily'), 'select'), true)),

    (5, 'securite', 'anon ne peut pas lire le journal Schooly',
        not coalesce(has_table_privilege('anon', to_regclass('public.schooly_sync_log'), 'select'), true)),

    (6, 'securite', 'anon ne peut pas lire les favoris',
        not coalesce(has_table_privilege('anon', to_regclass('public.favorites'), 'select'), true)),

    (7, 'securite', 'anon ne peut pas lire les profils',
        not coalesce(has_table_privilege('anon', to_regclass('public.profiles'), 'select'), true)),

    (8, 'securite', 'anon ne peut pas exécuter create_provider',
        not coalesce(has_function_privilege('anon', to_regprocedure('public.create_provider(text,text,text,text)'), 'execute'), true)),

    (9, 'securite', 'authenticated ne peut pas exécuter ingest_listings',
        not coalesce(has_function_privilege('authenticated', to_regprocedure('public.ingest_listings(uuid,uuid,jsonb)'), 'execute'), true)),

    (10, 'securite', 'RPC de trafic : search_path épinglé',
        exists (select 1 from pg_proc p
                where p.oid = to_regprocedure('public.increment_trouvetou_traffic(date,bigint)')
                  and p.proconfig @> array['search_path=public'])),

    (11, 'securite', 'RPC de trafic : version finale (on conflict on constraint)',
        exists (select 1 from pg_proc p
                where p.oid = to_regprocedure('public.increment_trouvetou_traffic(date,bigint)')
                  and p.prosrc like '%on conflict on constraint trouvetou_traffic_daily_pkey%')),

    (12, 'securite', 'RPC Schooly : search_path épinglé',
        exists (select 1 from pg_proc p
                where p.oid = to_regprocedure('public.schooly_sync_school(jsonb,jsonb)')
                  and p.proconfig @> array['search_path=public'])),

    -- ------------------------------------------------------------------ DONNÉES
    (13, 'donnees', 'Séjoura canonique actif, ancien provider désactivé ou supprimé',
        exists (select 1 from public.providers
                where id = 'a5101284-2d97-46e0-a0f2-fa6a008588f2'::uuid and is_active)
        and not exists (
          select 1 from public.providers p
          where p.id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid and p.is_active)),

    (14, 'donnees', 'aucune annonce publicly visible rattachée à un provider inactif',
        not exists (
          select 1 from public.listings l
          join public.providers p on p.id = l.provider_id
          where l.is_available and not p.is_active)),

    (15, 'donnees', 'la clé legacy Séjoura est bien conservée dans les alias',
        to_regclass('public.provider_api_key_aliases') is null
        or exists (select 1 from public.provider_api_key_aliases
                   where legacy_provider_id = '7a358385-6a88-4c8e-8e93-ef743a5ff218'::uuid)),

    (16, 'donnees', 'annonces Schooly publiées cohérentes (schooly_schools)',
        to_regclass('public.schooly_schools') is null
        or not exists (
          select 1 from public.schooly_schools s
          where s.published
            and not exists (select 1 from public.listings l
                            where l.provider_id = (select id from public.providers where name = 'Schooly' limit 1)
                              and l.external_id = s.id::text))),

    -- ------------------------------------------------------------------ SCHÉMA
    (17, 'schema', 'RLS activée sur toutes les tables de public',
        not exists (
          select 1 from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity)),

    (18, 'schema', 'index sur la FK canonique des alias',
        to_regclass('public.idx_provider_api_key_aliases_canonical') is not null),

    (19, 'schema', 'trigger updated_at sur schooly_schools, schooly_grade_levels et profiles',
        (select count(*) from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal
           and c.relname in ('schooly_schools', 'schooly_grade_levels', 'profiles')) = 3),

    (20, 'schema', 'aucune fonction SECURITY DEFINER sans search_path épinglé',
        not exists (
          select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.prosecdef
            and (p.proconfig is null
                 or not exists (select 1 from unnest(p.proconfig) cfg
                                where cfg like 'search_path=%'))))
)
select ordre,
       categorie,
       libelle,
       case when ok then 'OK' else 'ECHEC' end as resultat,
       count(*) filter (where not ok) over () as echecs_total,
       case when count(*) filter (where not ok) over () = 0
            then 'TOUT EST OK'
            else 'ATTENTION — des controles sont en ECHEC'
       end as verdict
from checks
order by ordre;

-- ----------------------------------------------------------------------------
-- Inventaire des policies sur les tables de compte : vérifiez qu'aucune policy
-- ancienne trop permissive n'a survécu (les policies RLS sont combinées par OU,
-- donc une policy large reste valide même si les nôtres sont strictes).
-- ----------------------------------------------------------------------------
select tablename,
       policyname,
       roles,
       cmd,
       left(coalesce(qual, '(using true)'), 60) as using_clause,
       left(coalesce(with_check, ''), 40) as check_clause
from pg_policies
where schemaname = 'public'
  and tablename in ('favorites', 'profiles', 'provider_api_key_aliases',
                    'sync_logs', 'schooly_sync_log', 'trouvetou_traffic_daily')
order by tablename, policyname;

-- ----------------------------------------------------------------------------
-- Test fonctionnel du RPC de trafic : seule écriture du script, annulée
-- immédiatement par le ROLLBACK. Doit renvoyer rpc_fonctionnel = true.
-- ----------------------------------------------------------------------------
begin;
select 'test RPC trafic' as etape,
       (select count(*) = 1
          from public.increment_trouvetou_traffic(
                 (current_date - 3650)::date, 0)) as rpc_fonctionnel;
rollback;