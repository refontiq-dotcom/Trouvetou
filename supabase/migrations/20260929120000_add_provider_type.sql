-- ===========================================================================
-- TROUVETOU — Identité technique explicite des providers (`providers.type`)
--
-- POURQUOI CETTE MIGRATION
--
-- L'architecture cible exige de résoudre :
--
--     provider.type  ->  ProviderRegistry  ->  adapter
--
-- Aucun champ existant ne peut porter cette valeur :
--
--   - `name`        : texte LIBRE saisi par un opérateur. Un nom affiché
--                     n'est pas une identité technique durable.
--   - `category_id` : décrit le SECTEUR (hôtel, clinique, école), pas le
--                     LOGICIEL MÉTIER. Deux PMS hôteliers distincts
--                     partageraient la même catégorie, et un même logiciel
--                     peut alimenter plusieurs secteurs.
--
-- `type` est donc une colonne À PART ENTIÈRE, résolue par le registre
-- d'adapters et jamais déduite d'un nom ou d'une URL.
--
-- STRATÉGIE DE VALEURS
--
--   'unknown'  : provider existant dont le logiciel métier n'est pas établi.
--   'sejoura'  : seul connecteur Booking implémenté à ce jour.
--
-- Le vocabulaire est volontairement MINIMAL. Ajouter 'schooly' ou
-- 'restaurant' plus tard se fera par un `alter type ... add value`, sans
-- réécrire cette migration.
--
-- BACKFILL — AUCUNE DÉDUCTION AUTOMATIQUE
--
-- Toutes les lignes existantes reçoivent 'unknown'. Aucune n'est devinée à
-- partir de `name` ou `category_id`, qui sont expressément exclus.
--
-- L'opérateur rattache un provider existant à 'sejoura' par une commande
-- EXPLICITE, ce qui est tracé dans les logs serveur :
--
--     UPDATE public.providers SET type = 'sejoura' WHERE id = '<uuid>';
--
-- C'est volontairement manuel. Une déduction automatique aurait produit une
-- base apparemment migrée alors que des providers resteraient mal
-- identifiés, et le symptôme (réservation refusée) n'apparaîtrait qu'en
-- production.
--
-- RÉVERSIBILITÉ
--
-- Le type ENUM est.droppable : `drop type` le supprime. Aucune donnée n'est
-- perdue (les annonces restent), seule l'identité technique est perdue.
-- ===========================================================================

begin;

-- 1. Création du type ENUM.
--
-- `if not exists` rend la migration rejouable sans erreur si elle a déjà été
-- appliquée (utile en intégration continue, où la base est reconstruite).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'provider_type') then
    create type public.provider_type as enum ('unknown', 'sejoura');
  end if;
end;
$$;

comment on type public.provider_type is
  'Logiciel métier alimentant le provider. Résolu via ProviderRegistry. ''unknown'' = non établi. ''sejoura'' = PMS Séjour@.';

-- 2. Ajout de la colonne.
--
-- La colonne est ajoutée NULLABLE, avec backfill immédiat à 'unknown', puis
-- passée NOT NULL dans une étape séparée (étape 4). Ce découpage évite qu'un
-- défaut sur une table pré-remplie échoue transactionnellement à l'ajout :
-- PostgreSQL refuse l'ALTER ... SET NOT NULL si une seule ligne est nulle.
alter table public.providers
  add column if not exists type public.provider_type;

comment on column public.providers.type is
  'Identité technique du logiciel métier. Résolue par ProviderRegistry pour sélectionner un adapter. Ne jamais dériver cette valeur de ''name'' ou de la catégorie.';

-- 3. Backfill : 'unknown' pour toute ligne existante.
--
-- `where type is null` rend l'opération idempotente et évite d'écraser un type
-- déjà renseigné par une exécution antérieure.
update public.providers
   set type = 'unknown'
 where type is null;

-- 4. Passage en NOT NULL.
--
-- Lève une exception explicite si une ligne est restée nulle : mieux vaut un
-- échec franc à l'application de la migration qu'un type nullable que le code
-- devra traiter indefiniment.
do $$
begin
  if exists (select 1 from public.providers where type is null) then
    raise exception 'PROVIDERS_TYPE_STILL_NULL: des providers n''ont pas pu être typés';
  end if;
end;
$$;

alter table public.providers
  alter column type set not null;

-- 5. Valeur par défaut des futures insertions.
--
-- Un provider créé sans type explicite ne doit pas échouer : il naît
-- 'unknown', ce qui le rend identifiable comme non typé plutôt que de
-- bloquer l'opération commerciale.
alter table public.providers
  alter column type set default 'unknown';

-- 6. Index sur le type.
--
-- Le registre résout par type : l'index sert les jointures qui listent les
-- providers d'un connecteur donné. Faible cardinalité, donc l'intérêt est
-- faible aujourd'hui, mais le coût est nul et l'index évite une migration de
-- plus le jour où le nombre de providers croît.
create index if not exists idx_providers_type on public.providers(type);

-- 7. `create_provider()` : ajout du paramètre `p_type`.
--
-- ⚠️ DÉCISION D'ARCHITECTURE : PAS DE SURCHARGE
--
-- Une fonction PL/pgSQL dont les derniers paramètres ont une valeur par
-- défaut ne peut pas coexister avec une signature plus courte. PostgreSQL
-- refuse alors de choisir :
--
--     ERROR: function create_provider(text, text, text, text) is not unique
--     HINT:  Could not choose a best candidate function.
--
-- Le problème ne se contourne PAS avec un cast : le message persiste même
-- avec des types explicites, parce que les DEUX candidats restent applicables
-- (les 4 derniers paramètres de la nouvelle sont tous optionnels). Créer une
-- 5ᵉ surcharge casserait donc TOUT appel à 4 arguments — y compris l'outillage
-- existant.
--
-- On remplace donc l'ancienne fonction par une nouvelle qui porte les DEUX
-- anciens paramètres par défaut (`p_webhook_url`, `p_type`). Une seule
-- signature, aucun appel ambigu :
--
--   3 arguments  -> OK  (comportement historique, type 'unknown')
--   4 arguments  -> OK  (comportement historique, type 'unknown')
--   5 arguments  -> OK  (type explicite)
--
-- Le premier `drop` supprime la surcharge 5 args d'un essai antérieur, ET
-- l'ancienne signature 4 args : `CREATE OR REPLACE` ne supprime PAS une
-- fonction dont la nouvelle définition a PLUS de paramètres — il crée une
-- surcharge à côté. Sans ce `drop`, les deux coexistent et tout appel à
-- 3 ou 4 arguments devient ambigu.
drop function if exists public.create_provider(text, text, text, text, text);
drop function if exists public.create_provider(text, text, text, text);

create or replace function public.create_provider(
  p_name         TEXT,
  p_category     TEXT,
  p_api_key_hash TEXT,
  p_webhook_url  TEXT DEFAULT NULL,
  p_type         TEXT DEFAULT 'unknown'
)
returns public.providers as $$
declare
  v_category_id UUID;
  v_provider    public.providers;
  v_type        public.provider_type;
begin
  select id into v_category_id
    from public.categories
   where slug = p_category;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND: catégorie % inconnue', p_category;
  end if;

  -- Le cast échoue sur une valeur hors vocabulaire : l'appelant reçoit une
  -- erreur explicite plutôt que de créer un provider au type arbitraire.
  -- `lower` + `trim` tolèrent la casse et les espaces superflus.
  v_type := lower(trim(p_type))::public.provider_type;

  insert into public.providers (name, category_id, api_key_hash, webhook_url, type)
  values (p_name, v_category_id, p_api_key_hash, p_webhook_url, v_type)
  returning * into v_provider;

  return v_provider;
end;
$$ language plpgsql security definer;

-- SÉCURITÉ — point critique
--
-- `20260925_production_audit_hardening.sql` révoque l'EXECUTE sur la
-- signature 4 args pour empêcher l'exposition via l'API Data de Supabase.
-- `CREATE OR REPLACE` conserve les privilèges existants, mais la révocation
-- est réappliquée explicitement : elle ne doit dépendre d'aucun état antérieur
-- de la base. Sans elle, la fonction créerait des providers — donc des sources
-- d'alimentation — depuis n'importe quel client authentifié.
revoke all on function public.create_provider(text, text, text, text, text) from public, anon, authenticated;
alter function public.create_provider(text, text, text, text, text) set search_path = public;

commit;
