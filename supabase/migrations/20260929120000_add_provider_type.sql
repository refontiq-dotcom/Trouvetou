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

commit;
