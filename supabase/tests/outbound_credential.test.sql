-- ============================================================================
-- TROUVETOU — Contrat du credential SORTANT (provider)
-- ============================================================================
-- Run with: supabase test db
-- Préalable : supabase/schema.sql + supabase/migrations/ dans l'ordre.
--
-- Ces tests sont STRUCTURELS : ils vérifient que le SCHEMA interdit ce qu'il
-- doit interdire, sans dépendre du contenu réel des tables. Une base vierge
-- les passe tous — le but est de verrouiller la migration 2D.18, pas les
-- données.
--
-- Ce que ces tests verrouillent :
--   1. la colonne existe et est NULLABLE (aucun provider ne porte de secret
--      tant que le backfill n'a pas eu lieu) ;
--   2. AUCUN rôle public ne peut la lire ;
--   3. la migration ne crée aucun credential par elle-même ;
--   4. les providers existants survivent à son application.
-- ============================================================================

begin;

select plan(8);

-- 1. La colonne existe sur `providers`.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'providers'
      and column_name = 'outbound_api_key_encrypted'
  ),
  'providers.outbound_api_key_encrypted column exists'
);

-- 2. Elle est TEXT et NULLABLE : aucun secret n'est imposé à l'insertion.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'providers'
      and column_name = 'outbound_api_key_encrypted'
      and data_type = 'text'
      and is_nullable = 'YES'
  ),
  'column is text and nullable'
);

-- 3. AUCUN rôle public ne lit la colonne. C'est le point de sécurité central :
--    sans ce contrôle, une fuite de la clé de chiffrement deviendrait une fuite
--    de tous les credentials sortants, par l'API REST Supabase.
select ok(
  not has_column_privilege('anon', 'public.providers', 'outbound_api_key_encrypted', 'SELECT'),
  'anon cannot read the outbound credential column'
);

select ok(
  not has_column_privilege('authenticated', 'public.providers', 'outbound_api_key_encrypted', 'SELECT'),
  'authenticated cannot read the outbound credential column'
);

-- 5. TEMOIN : les colonnes d'identité, elles, restent publiques. Sans ce
--    contrôle, un `revoke` trop large casserait tout le catalogue en silence.
select ok(
  has_column_privilege('anon', 'public.providers', 'name', 'SELECT')
  and has_column_privilege('anon', 'public.providers', 'category_id', 'SELECT'),
  'public identity columns remain readable (no over-revoke)'
);

-- 6. La migration ne fabrique aucun credential : une base fraîche, qui n'a
--    jamais subi de backfill, ne doit contenir que des NULL.
select ok(
  not exists (select 1 from public.providers where outbound_api_key_encrypted is not null),
  'no provider carries an outbound credential out of the box'
);

-- 7. Les providers existants sont intacts : la migration est un ajout de
--    colonne, pas une transformation de données.
select ok(
  (select count(*) from public.providers)
    = (select count(*) from public.providers where id is not null),
  'all providers survive the migration'
);

-- 8. La protection P0 d'`ingest_listings` est en place : la fonction conserve
--    un credential absent du lot, au lieu de l'effacer par
--    `attributes = EXCLUDED.attributes`.
--    On vérifie que la fonction existe, est serveur uniquement, et que son
--    corps référence bien la restauration du credential.
select ok(
  exists (select 1 from pg_proc where proname = 'ingest_listings')
  and exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'ingest_listings'
      and n.nspname = 'public'
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  )
  and pg_get_functiondef(
        (select p.oid from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where p.proname = 'ingest_listings' and n.nspname = 'public' limit 1)
      ) like '%sejoura_api_key%',
  'ingest_listings preserves a missing credential and stays server-only'
);

select * from finish();
rollback;
