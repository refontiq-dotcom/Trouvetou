-- ============================================================================
-- ÉTAPE 11 — BACKFILL DES 7 LISTINGS HISTORIQUES
--
-- PROBLÈME : sept `UPDATE` séparés serait un script non rejouable, non
-- vérifiable et impossible à auditer. Un attribut erroné dans le `where`
-- d'une ligne suffit à corrompre l'opération. Ce script fait donc UNE
-- opération ensembliste, encadrée par des garde-fous qui prouvent le résultat.
--
-- DÉCISION : RATTACHEMENT PAR EMPREINTE, JAMAIS PAR provider
--
-- Une seule jointure, un seul `UPDATE ... FROM` :
--
--     set tenant_ref = t.tenant_reference
--     from tenant_destination t
--     where t.credential_fingerprint = empreinte_sha256(listing)
--
-- Les 7 listings sont rattachés par l'EMPREINTE SHA-256 tronquée de leur clé
-- sortante `attributes ->> 'sejoura_api_key'`. Cette règle est :
--
--   · DÉTERMINISTE  — la même base produit toujours le même tenant_ref
--   · REJOUABLE      — `is distinct from` rend l'opération no-op sur une base
--                     déjà traitée
--   · INDEPENDANTE DE L'ÉTAT DE LA PRODUCTION — elle ne référence aucun
--     provider_id. Le split 2D.15/2D.19 est ABANDONNÉ (P0-5) et ne doit pas
--     avoir été exécuté.
--   · SANS SECRET    — seule l'empreinte tronquée est manipulée ; la clé en
--     clair n'est ni projetée, ni affichée, ni écrite dans un log
--
-- `sejoura:ping` EST EXCLU : il reste sans tenant et sert de filet de sécurité.
--
-- MODÈLE : ce script ne déplace PAS les listings entre providers. `provider`
-- reste la connexion SaaS ; `tenant_ref` distingue les tenants via
-- `integration_scopes` et `integration_credentials` (migration 2D.39).
--
-- 2D.15/2D.19 ABANDONNÉS (P0-5) — NE PAS EXÉCUTER.
-- Ce script suppose le split NON exécuté : UN provider SaaS portant les
-- 7 listings, chacun recevant son `tenant_ref`. Tout déplacement préalable
-- des listings entre providers invaliderait cette hypothèse.
--
-- pgcrypto : requis pour digest(). Déjà actif sur Supabase ; installé
-- explicitement par la migration 20260828.
--
-- MODE : ce fichier se termine par `ROLLBACK`. C'est un DRY-RUN par défaut.
-- Relire le rapport, puis remplacer `rollback;` par `commit;` pour appliquer.
--
-- AUCUN SECRET : les 4 empreintes sont des valeurs déjà versionnées dans le
-- dépôt (réconciliation 2D.14, section Q12), surchargeables par
-- current_setting pour une simulation locale.
-- ============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- MATRICE DE RATTACHEMENT (réconciliation 2D.14, section Q12)
--
-- Répartition observée en production : 4 / 1 / 1 / 1. `expected_listings`
-- n'est pas décoratif : le garde-fou 2 échoue si la production ne correspond
-- pas, ce qui interdit un backfill silencieux sur une base non analysée.
-- ─────────────────────────────────────────────────────────────────────────────

create temporary table tenant_destination (
  credential_fingerprint text primary key,
  tenant_reference       text not null unique,
  expected_listings      int  not null check (expected_listings > 0)
) on commit drop;

insert into tenant_destination
  (credential_fingerprint, tenant_reference, expected_listings)
values
  (coalesce(nullif(current_setting('tv_fp_gage',    true), ''), '53e8f49d'), 'gage',     4),
  (coalesce(nullif(current_setting('tv_fp_lemonde', true), ''), '4971052c'), 'le-monde', 1),
  (coalesce(nullif(current_setting('tv_fp_dady',    true), ''), '7bc2f822'), 'dady',     1),
  (coalesce(nullif(current_setting('tv_fp_plazza',  true), ''), 'd7f7f920'), 'plazza',   1);

-- ─────────────────────────────────────────────────────────────────────────────
-- GARDE-FOU 1 — INVENTAIRE : exactement 7 listings porteurs d'un credential
--
-- Compte AVEC credential, hors `sejoura:ping`. Si le compte diffère, la base
-- n'est pas celle analysée : on annule plutôt que d'attribuer un tenant_ref
-- arbitraire à des listings dont on ne connaît pas l'origine.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_total int;
begin
  select count(*) into v_total
  from public.listings l
  where l.external_id <> 'sejoura:ping'
    and nullif(l.attributes ->> 'sejoura_api_key', '') is not null;

  if v_total <> 7 then
    raise exception
      'INVENTAIRE: % listing(s) avec credential hors sejoura:ping, 7 attendu(s). '
      'La base differe de l analyse 2D.14. Aucune ecriture.', v_total;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- GARDE-FOU 2 — DISTRIBUTION : exactement 4 / 1 / 1 / 1
--
-- Une répartition 2/3/1/1 ou 7/0/0/0 passerait un simple contrôle de total.
-- Ce garde-fou exige la distribution CONNUE, ce qui rend le rattachement
-- déterministe : chaque empreinte tombe sur un tenant et un seul.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_bad text;
begin
  select string_agg(
           format('%s=%s (attendu %s)', t.tenant_reference, v.n, t.expected_listings),
           ', ' order by t.tenant_reference)
    into v_bad
  from tenant_destination t
  left join lateral (
    select count(*) as n
    from public.listings l
    where l.external_id <> 'sejoura:ping'
      and nullif(l.attributes ->> 'sejoura_api_key', '') is not null
      and left(encode(digest(l.attributes ->> 'sejoura_api_key', 'sha256'), 'hex'), 8)
          = t.credential_fingerprint
  ) v on true
  where v.n <> t.expected_listings;

  if v_bad is not null then
    raise exception
      'DISTRIBUTION: % — la cle sortante ne correspond pas a la matrice 2D.14-Q12. '
      'Aucune ecriture.', v_bad;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- GARDE-FOU 3 — CONFLIT : aucun tenant_ref déjà posé ne change
--
-- Une divergence sur un tenant_ref existant signale que la base a déjà été
-- traitée par un AUTRE chemin. On refuse d'écraser, plutôt que de choisir un
-- gagnant arbitraire entre deux sources de vérité.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_bad text;
begin
  select string_agg(
           format('%s : %s != %s', l.external_id, l.tenant_ref, t.tenant_reference),
           ', ' order by l.external_id)
    into v_bad
  from public.listings l
  join tenant_destination t
    on left(encode(digest(l.attributes ->> 'sejoura_api_key', 'sha256'), 'hex'), 8)
       = t.credential_fingerprint
  where l.external_id <> 'sejoura:ping'
    and nullif(l.attributes ->> 'sejoura_api_key', '') is not null
    and l.tenant_ref is not null
    and l.tenant_ref <> t.tenant_reference;

  if v_bad is not null then
    raise exception
      'CONFLIT: tenant_ref deja pose et divergent — % — aucune ecriture.', v_bad;
  end if;
end $$;



-- ─────────────────────────────────────────────────────────────────────────────
-- ÉCRITURE 1/3 — LE BACKFILL : une seule opération ensembliste
--
-- C'est LE cœur du script. Aucun listing n'est nommé, aucun identifiant n'est
-- figé : les 7 lignes sont atteintes par la règle, pas par une liste.
--
-- `is distinct from` (et non `<>`) traite le cas `tenant_ref IS NULL` et rend
-- la clause idempotente sur une base déjà traitée.
--
-- `provider_id` n'est volontairement PAS touché : le provider reste la
-- connexion SaaS. Voir §DÉCISION.
-- ─────────────────────────────────────────────────────────────────────────────

update public.listings l
set tenant_ref = t.tenant_reference,
    updated_at = now()
from tenant_destination t
where l.external_id <> 'sejoura:ping'
  and nullif(l.attributes ->> 'sejoura_api_key', '') is not null
  and t.credential_fingerprint =
      left(encode(digest(l.attributes ->> 'sejoura_api_key', 'sha256'), 'hex'), 8)
  and l.tenant_ref is distinct from t.tenant_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉCRITURE 2/3 — SCOPES : un scope TENANT par couple (provider, tenant)
--
-- Les scopes sont dérivés de l'état APRÈS backfill : ils sont donc justes
-- sur le provider SaaS unique (split 2D.15/2D.19 abandonné — P0-5),
-- sans jamais être figés.
--
-- `not exists` plutôt que `on conflict` : `integration_scopes` n'a pas de
-- contrainte d'unicité sur (provider_id, tenant_ref) — cf. migration
-- 20261005000000, §limites.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.integration_scopes (provider_id, scope_type, tenant_ref, is_active)
select l.provider_id, 'TENANT', l.tenant_ref, true
from public.listings l
where l.tenant_ref is not null
group by l.provider_id, l.tenant_ref
having not exists (
  select 1 from public.integration_scopes s
  where s.provider_id = l.provider_id
    and s.tenant_ref  = l.tenant_ref
);

-- Un scope GLOBAL couvre les listings legacy (tenant_ref IS NULL), dont
-- `sejourra:ping`. Sans lui, ils ne seraient plus adressables.
insert into public.integration_scopes (provider_id, scope_type, tenant_ref, is_active)
select l.provider_id, 'GLOBAL', null, true
from public.listings l
where l.tenant_ref is null
group by l.provider_id
having not exists (
  select 1 from public.integration_scopes s
  where s.provider_id = l.provider_id
    and s.scope_type  = 'GLOBAL'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉCRITURE 3/3 — ROUTAGE PRIVÉ : `listing_tenant_scopes`
--
-- Table de routage privé introduite par la migration 20261005000000. Elle
-- borne le soft-removal au tenant. Alignée par construction sur le backfill ;
-- `on conflict do nothing` la rend sans risque de doublon.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.listing_tenant_scopes (listing_id, provider_id, tenant_ref)
select l.id, l.provider_id, l.tenant_ref
from public.listings l
where l.tenant_ref is not null
on conflict (listing_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- RAPPORT — à relire AVANT de remplacer rollback par commit
--
-- Ces nombres sont la preuve que le backfill est correct : 7 listings
-- rattachés, répartis 4/1/1/1, et autant de lignes de routage privé.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  r record;
begin
  raise notice 'BACKFILL — rapport';
  raise notice '  listings backfillés (tenant_ref non NULL) : %',
    (select count(*) from public.listings where tenant_ref is not null);
  raise notice '  listings legacy  (tenant_ref NULL)        : %',
    (select count(*) from public.listings where tenant_ref is null);
  raise notice '  scopes TENANT                            : %',
    (select count(*) from public.integration_scopes where scope_type = 'TENANT');
  raise notice '  scopes GLOBAL                            : %',
    (select count(*) from public.integration_scopes where scope_type = 'GLOBAL');
  raise notice '  lignes de routage privé                  : %',
    (select count(*) from public.listing_tenant_scopes);
  raise notice '  répartition des listings backfillés :';
  for r in
    select tenant_ref, count(*) as n
    from public.listings
    where tenant_ref is not null
    group by tenant_ref
    order by tenant_ref
  loop
    raise notice '    % = %', r.tenant_ref, r.n;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- DRY-RUN. Remplacer par `commit;` après lecture du rapport ci-dessus.
-- ─────────────────────────────────────────────────────────────────────────────
rollback;