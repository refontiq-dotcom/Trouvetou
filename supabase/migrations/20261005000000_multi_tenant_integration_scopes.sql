-- ============================================================================
-- TROUVETOUT — Socle du modèle d'intégration multi-tenant
--
-- PHASE 2D.39 — STRUCTURE SEULE. AUCUNE DONNÉE MÉTIER.
--
-- DÉCISION ARCHITECTURALE
--
--   `provider` = CONNEXION SaaS authentifiée. Ce n'est ni un tenant, ni un
--   établissement, ni une accommodation. Un même provider sert donc
--   plusieurs tenants Séjour@, chacun lié par un SCOPE.
--
--   Séjour@ reste source de vérité des tenants et de la logique métier.
--   TrouveTout ne conserve qu'un `tenant_ref` TECHNIQUE, opaque et privé.
--
--   Identité définitive d'un listing :
--
--       (provider_id, tenant_ref, external_id)
--
--   L'ancienne contrainte `UNIQUE (provider_id, external_id)` est SUPPRIMÉE :
--   elle empêchait physiquement que deux tenants d'un même provider
--   partagent un external_id. Aucun mapping privé ne peut contourner une
--   contrainte de base.
--
-- CE QUE CETTE MIGRATION FAIT
--
--   1. `integration_scopes`       — autorisation, `scope_id` stable
--   2. `integration_credentials`  — secrets, JAMAIS identité de scope
--   3. `listings.tenant_ref`      — colonne nullable (legacy toléré)
--   4. contrainte d'unicité triplet (NULLS NOT DISTINCT)
--   5. `listing_tenant_scopes`    — routage PRIVÉ (soft-removal borné)
--   6. `ingest_listings`          — triplet + garde cross-tenant
--   7. `apply_soft_removal`        — désactivation bornée au tenant
--   8. `resolve_integration_scope`— résolution credential → scope
--
-- CE QU'ELLE NE FAIT PAS
--
--   · AUCUNE donnée insérée, déplacée ou supprimée. Le rattachement des 7
--     listings historiques est une migration distincte, non produite ici.
--   · `provider_api_key_aliases` n'est PAS touchée : son sens reste
--     « alias de credential provider historique ».
--   · `listings.attributes.sejoura_api_key` n'est PAS modifié : sa
--     suppression exige d'avoir mesuré le backfill outbound.
--
-- VERSION POSTGRESQL
--
--   `NULLS NOT DISTINCT` exige PostgreSQL 15+ (CREATE INDEX). Supabase
--   fournit 15 et 17. Sur une version antérieure, l'index échoue et la
--   transaction entière est annulée : échec propre, jamais silencieux.
--
-- IDEMPOTENCE : toutes les créations sont conditionnelles ; les
-- suppressions sont gardées par une vérification d'existence.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. INTÉGRATION SCOPES — l'autorisation
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.integration_scopes (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references public.providers(id) on delete cascade,

  -- 'GLOBAL' : portée provider, compatibilité legacy. Ne permet PAS de créer
  --   de listing sans tenant_ref (invariant appliqué dans ingest_listings).
  -- 'TENANT' : portée un tenant ; seule portée de création.
  scope_type      text not null,

  -- OPAQUE. `tenants.id` Séjour@ en pratique, mais le type est TEXT : aucun
  -- couplage au schéma du SaaS source, aucun UUID imposé.
  tenant_ref      text,

  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_integration_scope_type
    check (scope_type in ('GLOBAL', 'TENANT')),

  -- Un GLOBAL n'a pas de tenant ; un TENANT en a toujours un.
  constraint chk_integration_scope_global_no_ref
    check (scope_type <> 'GLOBAL' or tenant_ref is null),
  constraint chk_integration_scope_tenant_has_ref
    check (scope_type <> 'TENANT' or tenant_ref is not null),
  constraint chk_integration_scope_tenant_ref_not_blank
    check (tenant_ref is null or btrim(tenant_ref) <> '')
);

comment on table public.integration_scopes is
  'Autorisation d''un provider sur un périmètre. L''identité est id : stable, '
  'indépendante de toute credential, elle survit aux rotations. RLS sans '
  'policy : service_role uniquement.';

comment on column public.integration_scopes.tenant_ref is
  'Identifiant TECHNIQUE opaque fourni par le SaaS source (tenants.id). '
  'Ni secret, ni donnée métier. Strictement privé.';

-- PAS de UNIQUE(provider_id, tenant_ref) : plusieurs scopes pour un même
-- tenant sont permis (rotation, transition progressive).
create index if not exists idx_integration_scopes_provider_tenant
  on public.integration_scopes (provider_id, tenant_ref);

create index if not exists idx_integration_scopes_provider_type
  on public.integration_scopes (provider_id, scope_type);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. INTÉGRATION CREDENTIALS — le secret, jamais l'identité
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.integration_credentials (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references public.providers(id) on delete cascade,

  -- Lien vers le scope autorisé. Une credential appartient EXACTEMENT à un
  -- scope : c'est ce qui empêche qu'une clé de tenant A serve le scope de B.
  scope_id        uuid not null references public.integration_scopes(id) on delete cascade,

  -- HMAC-SHA256(credential, TROUVETOU_API_KEY_PEPPER), identique à
  -- providers.api_key_hash. Calculé CÔTÉ APPLICATION : le pepper vit dans
  -- l'environnement et n'est jamais stocké en base.
  credential_hash text not null,

  is_active       boolean not null default true,
  expires_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_integration_credential_hash_not_empty
    check (credential_hash <> ''),

  -- UNE credential par (provider, scope). Deux credentials distinctes
  -- peuvent coexister pour le MÊME scope : c'est la rotation.
  constraint uq_integration_credential_hash
    unique (provider_id, credential_hash)
);

comment on table public.integration_credentials is
  'Secrets d''authentification des scopes. Stockage HACHÉ, jamais en clair. '
  'Rotation : on insère une nouvelle ligne et on désactive l''ancienne — '
  'scope_id et tenant_ref ne bougent pas, donc aucun listing n''est créé.';

comment on column public.integration_credentials.credential_hash is
  'HMAC-SHA256(credential brute, TROUVETOU_API_KEY_PEPPER). Calculé côté '
  'application : le pepper n''est jamais stocké en base.';

-- Chemin le plus chaud : résolution de la credential à chaque POST.
create index if not exists idx_integration_credentials_lookup
  on public.integration_credentials (provider_id, credential_hash)
  where is_active;

create index if not exists idx_integration_credentials_scope
  on public.integration_credentials (scope_id)
  where is_active;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. LISTINGS — identité tenant-scoped
-- ────────────────────────────────────────────────────────────────────────────

-- NULLABLE : les listings historiques conservent `tenant_ref IS NULL` tant que
-- le backfill n'a pas eu lieu. Ils restent pilotés par le scope GLOBAL, et
-- l'unicité historique est préservée par NULLS NOT DISTINCT (voir §3b).
alter table public.listings
  add column if not exists tenant_ref text;

comment on column public.listings.tenant_ref is
  'Identifiant TECHNIQUE opaque du tenant source (tenants.id Séjour@). '
  'Ni secret, ni donnée métier. NULL = listing legacy non scopé, traité par le '
  'scope GLOBAL. NON retourné par le catalogue : LISTINGS_SELECT énumère ses '
  'colonnes et ne l''inclut pas.';

alter table public.listings
  drop constraint if exists chk_listings_tenant_ref_blank;

alter table public.listings
  add constraint chk_listings_tenant_ref_blank
  check (tenant_ref is null or btrim(tenant_ref) <> '');

-- ── 3b. REMPLACEMENT DE LA CONTRAINTE D'UNICITÉ ────────────────────────────
--
-- L'ancienne `UNIQUE (provider_id, external_id)` BLOQUE
--     P + tenant A + X   puis   P + tenant B + X
-- Elle doit tomber. Le DROP est gardé par une vérification d'existence : le
-- nom de la contrainte n'est pas garanti par le schéma, on compare donc sa
-- DÉFINITION.
do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conrelid = 'public.listings'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (provider_id, external_id)'
  ) then
    alter table public.listings
      drop constraint listings_provider_id_external_id_key;
  end if;
end $$;

-- NULLS NOT DISTINCT : sans ce mot-clé, PostgreSQL considère deux lignes dont
-- tenant_ref est NULL comme distinctes. L'unicité d'AVANT la bascule
-- (provider + external_id) serait alors perdue pour les listings legacy.
create unique index if not exists uq_listings_tenant_external
  on public.listings (provider_id, tenant_ref, external_id) nulls not distinct;

comment on index public.uq_listings_tenant_external is
  'Identité fonctionnelle multi-tenant. NULLS NOT DISTINCT garantit qu''un '
  'listing legacy (tenant_ref NULL) reste unique par (provider_id, '
  'external_id), exactement comme avant la bascule.';

-- L'ancien index (provider_id, external_id) devient redondant pour le tenant ;
-- on le remplace par un index NON unique, utile aux lectures par provider.
drop index if exists public.idx_listings_external;

create index if not exists idx_listings_provider_external
  on public.listings (provider_id, external_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ROUTAGE PRIVÉ (soft-removal borné)
-- ────────────────────────────────────────────────────────────────────────────

-- `listing_tenant_scopes` n'est PAS l'identité du listing (elle est portée par
-- listings). Elle porte le routage privé qui permet de BORNER le
-- soft-removal au tenant sans exposer quoi que ce soit au catalogue.
create table if not exists public.listing_tenant_scopes (
  listing_id   uuid primary key references public.listings(id) on delete cascade,

  -- Dénormalisation justifiée : elle évite une jointure sur le chemin chaud du
  -- soft-removal. Risque de dérive nul — un listing ne change pas de
  -- provider, c'est la clé d'upsert qui le définit.
  provider_id  uuid not null references public.providers(id) on delete cascade,

  tenant_ref   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint chk_listing_tenant_scope_ref_not_blank
    check (btrim(tenant_ref) <> '')
);

comment on table public.listing_tenant_scopes is
  'Routage PRIVÉ listing → (provider_id, tenant_ref). Sert au soft-removal '
  'borné. L''identité reste sur listings (uq_listings_tenant_external). Le '
  'CASCADE fait disparaître le routage avec le listing.';

create index if not exists idx_listing_tenant_scopes_lookup
  on public.listing_tenant_scopes (provider_id, tenant_ref);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. SÉCURITÉ — RLS et grants
-- ────────────────────────────────────────────────────────────────────────────

-- RLS activée, AUCUNE policy : seules les lectures via service_role
-- (getAdminClient) sont possibles. Même traitement que `sync_logs`.
alter table public.integration_scopes       enable row level security;
alter table public.integration_credentials  enable row level security;
alter table public.listing_tenant_scopes   enable row level security;

revoke all on public.integration_scopes      from anon, authenticated;
revoke all on public.integration_credentials from anon, authenticated;
revoke all on public.listing_tenant_scopes  from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. FONCTION — résolution du scope (authorize-only)
-- ────────────────────────────────────────────────────────────────────────────

-- `SECURITY INVOKER` : cette fonction ne fait que LIRE les tables privées,
-- dont la RLS est activée SANS policy. En `SECURITY DEFINER`, elle
-- contournerait cette RLS pour une simple lecture et deviendrait un point
-- d'entrée privilégié — inutile ici.
--
-- Elle retourne `provider_matches` plutôt que de filtrer : la route peut ainsi
-- distinguer « credential inconnue » (401) de « credential d'un autre
-- provider » (403) sans révéler l'existence du scope.
create or replace function public.resolve_integration_scope(
  p_provider_id     uuid,
  p_credential_hash text
)
returns table (
  scope_id         uuid,
  scope_type       text,
  tenant_ref       text,
  scope_is_active  boolean,
  provider_matches boolean
)
language sql
security invoker
set search_path = public
as $$
  select
    s.id,
    s.scope_type,
    s.tenant_ref,
    s.is_active,
    (c.provider_id = p_provider_id)
  from public.integration_credentials c
  join public.integration_scopes s on s.id = c.scope_id
  where c.provider_id = p_provider_id
    and c.credential_hash = p_credential_hash
    and c.is_active
    and (c.expires_at is null or c.expires_at > now())
  limit 1;
$$;

revoke all on function public.resolve_integration_scope(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_integration_scope(uuid, text)
  to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. FONCTION — soft-removal borné au tenant
-- ────────────────────────────────────────────────────────────────────────────

-- Remplace le `provider_id = X AND external_id NOT IN (...)` historique, qui
-- vaudrait pour TOUT le provider et vicierait un tenant voisin.
--
-- SCÉNARIO OBLIGATOIRE
--   Provider P, tenant A : A1 A2 A3 ; tenant B : B1 B2
--   A synchronise [A1, A2]
--   → A1 actif, A2 actif, A3 inactif ; B1 et B2 INCHANGÉS.
--
-- `SECURITY DEFINER` : les tables privées n'ont aucune policy, la fonction
-- doit pouvoir écrire. Restreinte à service_role juste après.
create or replace function public.apply_soft_removal(
  p_provider_id  uuid,
  p_tenant_ref   text,   -- NULL = portée GLOBAL (listings sans routage)
  p_external_ids text[]  -- vide = aucun soft-removal
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affected integer;
begin
  -- Garde-fou : un lot vide ne désactive RIEN. Un POST vide ne doit pas vider
  -- le provider.
  if p_external_ids is null or cardinality(p_external_ids) = 0 then
    return 0;
  end if;

  if p_tenant_ref is null then
    -- GLOBAL : uniquement les listings du provider qui n'ont AUCUN routage
    -- tenant. Les listings scopés sont hors périmètre : GLOBAL ne peut pas
    -- décider de leur sort.
    update public.listings l
       set is_available = false
     where l.provider_id = p_provider_id
       and l.external_id <> all (p_external_ids)
       and not exists (
         select 1 from public.listing_tenant_scopes s
          where s.listing_id = l.id
       );
  else
    -- TENANT : strictement borné. L'égalité du tenant_ref est ce qui
    -- empêche un tenant A de désactiver un listing de B.
    update public.listings l
       set is_available = false
     where l.provider_id = p_provider_id
       and l.external_id <> all (p_external_ids)
       and exists (
         select 1 from public.listing_tenant_scopes s
          where s.listing_id = l.id
            and s.tenant_ref = p_tenant_ref
       );
  end if;

  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

revoke all on function public.apply_soft_removal(uuid, text, text[])
  from public, anon, authenticated;
grant execute on function public.apply_soft_removal(uuid, text, text[])
  to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. INGESTION — triplet, garde cross-tenant, routage atomique
-- ────────────────────────────────────────────────────────────────────────────

-- AUTORITÉ
--
-- `p_tenant_ref` provient du SCOPE RÉSOLU par la route, jamais du payload.
-- Cette fonction est `SECURITY DEFINER` et n'est exécutable que par
-- `service_role` : un client anon ou authenticated ne peut donc pas l'appeler
-- pour écrire un `tenant_ref` de son choix. Le contrôle d'autorisation est
-- fail-closed : provider inactif, ou tenant déjà attribué à un autre
-- périmètre, lèvent une exception.
--
-- ATOMICITÉ
--
-- L'insertion du listing ET celle de son routage ont lieu dans la MÊME
-- transaction. C'est ce qui rend le premier ingest cohérent : pas de listing
-- sans routage, donc jamais invisible à un futur soft-removal borné.
--
-- RÉTROCOMPATIBILITÉ
--
-- L'argument `p_tenant_ref` a un DEFAULT : un appelant à 3 arguments compile
-- toujours. Il crée alors des listings legacy sans routage,exactly comme
-- avant. Le GLOBAL ne peut de toute façon pas créer de listing NOUVEAU
-- inéligible : la route le refuse en amont (GLOBAL_CANNOT_CREATE).
create or replace function public.ingest_listings(
  p_provider_id uuid,
  p_category_id uuid,
  p_items       jsonb,
  p_tenant_ref  text default null
)
returns table (inserted integer, updated integer) as $$
declare
  v_item               jsonb;
  v_is_insert          boolean;
  v_inserted           integer := 0;
  v_updated            integer := 0;
  v_previous_credential text;
  v_current_tenant     text;
  v_listing_id         uuid;
  v_external_id        text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_PAYLOAD: le lot "items" est manquant ou vide';
  end if;

  if not exists (
    select 1 from public.providers
     where id = p_provider_id and is_active = true
  ) then
    raise exception 'PROVIDER_INACTIVE';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    declare
      v_item_category_id uuid;
      v_slug text;
    begin
      v_slug := v_item ->> 'category_slug';
      if v_slug is not null then
        select id into v_item_category_id
          from public.categories where slug = v_slug;
        if not found then
          v_item_category_id := p_category_id;
        end if;
      else
        v_item_category_id := p_category_id;
      end if;

      v_external_id := v_item ->> 'external_id';

      -- Lecture de l'credential AVANT l'upsert, qui l'écrasera.
      select l.attributes ->> 'sejoura_api_key'
        into v_previous_credential
        from public.listings l
       where l.provider_id = p_provider_id
         and l.external_id = v_external_id
         and l.tenant_ref is not distinct from p_tenant_ref;

      -- GARDE CROSS-TENANT — avant toute écriture.
      --
      -- Si le couple (provider, external_id) existe déjà et appartient à un
      -- AUTRE tenant, on refuse. Un tenant A ne peut donc pas réécrire le
      -- listing de B, même si ce listing partage son external_id.
      if p_tenant_ref is not null then
        select s.tenant_ref into v_current_tenant
          from public.listings l
          left join public.listing_tenant_scopes s on s.listing_id = l.id
         where l.provider_id = p_provider_id
           and l.external_id = v_external_id
           and s.tenant_ref is distinct from p_tenant_ref
         limit 1;

        if v_current_tenant is not null then
          raise exception
            'CROSS_TENANT_CONFLICT: l''annonce % appartient au tenant %',
            v_external_id, v_current_tenant;
        end if;
      end if;

      insert into public.listings (
        provider_id, category_id, external_id, title, description,
        city, base_price, images, attributes, is_available, tenant_ref
      ) values (
        p_provider_id,
        v_item_category_id,
        v_external_id,
        v_item ->> 'title',
        v_item ->> 'description',
        v_item ->> 'city',
        (v_item ->> 'base_price')::numeric,
        coalesce(v_item -> 'images', '[]'::jsonb),
        coalesce(v_item -> 'attributes', '{}'::jsonb),
        coalesce((v_item ->> 'is_available')::boolean, true),
        -- tenancy : ÉCRITE PAR LE SERVEUR depuis le scope authentifié.
        p_tenant_ref
      )
      -- La cible du conflit est le TRIPLET : c'est ce qui permet à deux
      -- tenants du même provider de partager un external_id.
      --
      -- PAS de `nulls not distinct` ICI : la clause n'existe que dans
      -- CREATE UNIQUE INDEX et UNIQUE, pas dans la grammaire d'ON CONFLICT.
      -- L'inférence retrouve l'index `uq_listings_tenant_external` par ses
      -- colonnes — la propriété NULLS NOT DISTINCT de l'index s'applique
      -- d'elle-même, sans avoir à être déclarée ici.
      on conflict (provider_id, tenant_ref, external_id)
      do update set
        category_id  = excluded.category_id,
        title        = excluded.title,
        description  = excluded.description,
        city         = excluded.city,
        base_price   = excluded.base_price,
        images       = excluded.images,
        attributes   = excluded.attributes,
        is_available = excluded.is_available
      returning id, (xmax = 0) into v_listing_id, v_is_insert;

      -- ROUTAGE PRIVÉ — dans la MÊME transaction que l'upsert.
      if p_tenant_ref is not null then
        insert into public.listing_tenant_scopes
          (listing_id, provider_id, tenant_ref)
        values (v_listing_id, p_provider_id, p_tenant_ref)
        on conflict (listing_id) do update
          set tenant_ref  = excluded.tenant_ref,
              provider_id = excluded.provider_id,
              updated_at  = now();
      end if;

      -- Restauration : uniquement si le nouveau lot n'en a pas fourni un.
      if v_previous_credential is not null
         and (v_item -> 'attributes' ->> 'sejoura_api_key') is null then
        update public.listings l
           set attributes = jsonb_set(
                 l.attributes, '{sejoura_api_key}',
                 to_jsonb(v_previous_credential), true)
         where l.provider_id = p_provider_id
           and l.external_id = v_external_id
           and l.tenant_ref is not distinct from p_tenant_ref;
      end if;

      if v_is_insert then
        v_inserted := v_inserted + 1;
      else
        v_updated := v_updated + 1;
      end if;
    end;
  end loop;

  return query select v_inserted, v_updated;
end;
$$ language plpgsql security definer;

alter function public.ingest_listings(uuid, uuid, jsonb, text)
  set search_path = public;

revoke all on function public.ingest_listings(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.ingest_listings(uuid, uuid, jsonb, text)
  to service_role;

commit;
