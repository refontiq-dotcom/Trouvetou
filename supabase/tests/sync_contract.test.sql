-- ===========================================================================
-- TROUVETOU — Contrat de synchronisation : garanties SQL
--
-- Run with: supabase test db
-- Prérequis : supabase/schema.sql + supabase/migrations/ dans l'ordre.
--
-- Ces tests couvrent ce qui N'EXISTE QU'EN BASE et ne peut donc pas être
-- vérifié depuis le TypeScript :
--
--   1. la contrainte UNIQUE (provider_id, external_id) ;
--   2. le rejet effectif d'un doublon ;
--   3. le comportement idempotent de `ingest_listings` ;
--   4. l'atomicité du lot (rejet total si un item est invalide) ;
--   5. la préservation du credential legacy quand le snapshot ne l'envoie pas.
--
-- Le pendant TypeScript (src/app/api/v1/sync/contract.test.ts) verrouille la
-- SÉMANTIQUE du snapshot. Voir docs/sync-contract.md, document normatif.
-- ===========================================================================
begin;

select plan(6);

-- Données de test : deux providers distincts, de même catégorie.
insert into public.providers (name, category_id, api_key_hash, type)
select 'Test A', c.id, 'hash-a-test', 'sejoura'::public.provider_type
  from public.categories c where c.slug = 'hotel'
limit 1;

insert into public.providers (name, category_id, api_key_hash, type)
select 'Test B', c.id, 'hash-b-test', 'sejoura'::public.provider_type
  from public.categories c where c.slug = 'hotel'
limit 1;

-- 1. La contrainte UNIQUE existe bien sur (provider_id, external_id).
select ok(
  exists (
    select 1
      from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'listings'
       and constraint_type = 'UNIQUE'
       and constraint_name like '%provider%external%'
  ),
  'UNIQUE (provider_id, external_id) existe sur listings'
);

-- 2. Deux providers, MÊME external_id => deux listings distincts.
select ok(
  (
    select count(*)
      from public.listings
     where external_id = 'shared-1'
       and provider_id in (
         select id from public.providers where name in ('Test A', 'Test B')
       )
  ) = 0,
  'état initial : aucun listing pour ce couple'
);

insert into public.listings (provider_id, category_id, external_id, title)
select p.id, p.category_id, 'shared-1', 'Annonce ' || p.name
  from public.providers p
 where p.name in ('Test A', 'Test B');

select is(
  (
    select count(*) from public.listings
     where external_id = 'shared-1'
       and provider_id in (select id from public.providers where name in ('Test A','Test B'))
  ),
  2::bigint,
  'deux providers + même external_id = deux listings distincts'
);

-- 3. Un doublon sur le même provider est REJETÉ par la base.
select throws_ok(
  $$
  insert into public.listings (provider_id, category_id, external_id, title)
  select id, category_id, 'shared-1', 'Doublon'
    from public.providers where name = 'Test A'
  $$,
  '23505',
  null,
  'doublon (provider_id, external_id) rejeté par la contrainte UNIQUE'
);

-- 4. idempotence : rejouer le même snapshot ne crée pas de ligne de plus.
select is(
  ingest_listings(
    (select id from public.providers where name = 'Test A'),
    (select category_id from public.providers where name = 'Test A'),
    '[{"external_id":"idem-1","title":"Idempotence","base_price":"1000"}]'::jsonb
  )::text,
  '(1,0)',
  'premier sync : insertion'
);

select is(
  ingest_listings(
    (select id from public.providers where name = 'Test A'),
    (select category_id from public.providers where name = 'Test A'),
    '[{"external_id":"idem-1","title":"Idempotence","base_price":"1000"}]'::jsonb
  )::text,
  '(0,1)',
  'sync identique rejoué : mise à jour, aucune insertion'
);

-- 5. Atomicité : un lot contenant un item invalide est REJETÉ EN ENTIER.
--    L'item valide qui le précède ne doit surtout pas rester écrit.
select throws_ok(
  $$
  select ingest_listings(
    (select id from public.providers where name = 'Test B'),
    (select category_id from public.providers where name = 'Test B'),
    '[{"external_id":"atom-ok","title":"Valide"},
      {"external_id":"atom-ko","title":""}]'::jsonb
  )
  $$,
  '23514',
  null,
  'lot avec un item invalide : échec complet (chk_title_not_empty)'
);

select is(
  (
    select count(*) from public.listings
     where external_id = 'atom-ok'
       and provider_id = (select id from public.providers where name = 'Test B')
  ),
  0::bigint,
  'atomicité : l item valide du lot rejeté n a PAS été écrit'
);

-- 6. Le credential legacy survit à un snapshot qui ne l'envoie pas.
--    Garantie de la Phase 2D.1, indispensable au contrat : les credentials
--    sont hors du miroir public.
insert into public.listings (provider_id, category_id, external_id, title, attributes)
select id, category_id, 'cred-1', 'Avec credential',
       '{"beds":2,"sejoura_api_key":"valeur-de-test"}'::jsonb
  from public.providers where name = 'Test B';

select ingest_listings(
  (select id from public.providers where name = 'Test B'),
  (select category_id from public.providers where name = 'Test B'),
  '[{"external_id":"cred-1","title":"Avec credential","attributes":{"beds":3}}]'::jsonb
);

select is(
  (
    select l.attributes ->> 'sejoura_api_key'
      from public.listings l
     where l.external_id = 'cred-1'
       and l.provider_id = (select id from public.providers where name = 'Test B')
  ),
  'valeur-de-test',
  'credential legacy préservé quand le snapshot ne l envoie pas'
);

select * from finish();
rollback;
