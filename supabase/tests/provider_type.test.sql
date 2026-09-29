-- ===========================================================================
-- TROUVETOU — Contrat de l'identité technique des providers
--
-- Run with: supabase test db
-- Prérequis : supabase/schema.sql + supabase/migrations/ dans l'ordre.
--
-- Ces tests sont STRUCTURELS : ils vérifient que le modèle interdit ce qu'il
-- doit interdire, sans dépendre du contenu réel de la table. Une base vierge
-- les passe tous, ce qui est le but : ils verrouillent le SCHÉMA, pas les
-- données.
-- ===========================================================================
begin;

select plan(9);

-- 1. Le type ENUM existe.
select ok(
  exists (select 1 from pg_type where typname = 'provider_type'),
  'provider_type enum exists'
);

-- 2. La colonne existe sur providers.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'providers' and column_name = 'type'
  ),
  'providers.type column exists'
);

-- 3. La colonne est NOT NULL : une identité technique ne peut pas être absente.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'providers'
      and column_name = 'type' and is_nullable = 'NO'
  ),
  'providers.type is NOT NULL'
);

-- 4. La colonne a une valeur par défaut.
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'providers'
      and column_name = 'type' and column_default like '%unknown%'
  ),
  'providers.type defaults to unknown'
);

-- 5. 'unknown' fait partie du vocabulaire.
select ok(
  'unknown'::public.provider_type = 'unknown'::public.provider_type,
  'provider_type accepts unknown'
);

-- 6. 'sejoura' fait partie du vocabulaire.
select ok(
  'sejoura'::public.provider_type = 'sejoura'::public.provider_type,
  'provider_type accepts sejoura'
);

-- 7. Une valeur hors vocabulaire est REJETÉE par le type.
--
-- C'est le test le plus important du lot : c'est lui qui empêche qu'un jour un
-- `check provider, type = 'typo'` ne crée un provider que le ProviderRegistry
-- ne saura jamais résoudre.
select throws_ok(
  $$ select 'restaurant'::public.provider_type $$,
  '22P02',
  'invalid input value for enum provider_type',
  'provider_type rejects a value outside the vocabulary'
);

-- 8. L'index sur le type existe (résolution par le registre).
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_providers_type'),
  'index on providers.type exists'
);

-- 9. Aucune ligne de providers n'est restée NULL.
--
-- Le nom du provider ne doit JAMAIS servir à déduire le type : une ligne dont
-- le logiciel métier n'est pas établi porte donc 'unknown', ce qui la rend
-- explicitement identifiée comme non typée plutôt que devinée.
select ok(
  not exists (select 1 from public.providers where type is null),
  'no provider row is left without a type'
);

select * from finish();
rollback;
