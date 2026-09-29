-- ===========================================================================
-- TROUVETOU — Credential SORTANT au niveau du provider
--
-- POURQUOI UNE SECONDE COLONNE
--
-- `providers.api_key_hash` est le credential ENTRANT : le provider
-- s'authentifie auprès de TrouveTout, et seule une empreinte suffit à vérifier
-- cette assertion. Il est donc, par construction, non récupérable.
--
-- Or TrouveTout doit aussi appeler le provider en `x-api-key`, ce qui suppose
-- de RÉCUPÉRER le secret d'origine. Un hash ne peut pas servir : c'est
-- précisément l'inverse d'un hash.
--
-- D'où `outbound_api_key_encrypted`, qui porte le secret chiffré (AES-256-GCM,
-- appliqué par l'application). Le nom explicite évite toute confusion avec
-- `api_key_hash` et rend le SENS du flux lisible dans le code.
--
-- SÉCURITÉ
--
-- La colonne contient uniquement du CHIFFREMENT, jamais le secret en clair.
-- Elle est NULLABLE et n'est pas ajoutée au GRANT public : la ligne
-- `GRANT SELECT (id, name, category_id, is_active, ...)` de `schema.sql`
-- exclut volontairement toute colonne sensible, et `type` comme
-- `outbound_api_key_encrypted` suivent la même règle.
--
-- TYPE RÉELLEMENT RÉCUPÉRABLE
--
-- NOT NULL est volontairement EXCLU à ce stade : le backfill s'exécute côté
-- application (la clé de chiffrement n'est pas accessible à une migration
-- SQL), donc des providers peuvent légitimement porter NULL pendant la
-- transition. Rendre la colonne NOT NULL avant le backfill échouerait.
--
-- RÉVERSIBILITÉ
--
-- `drop column` suffit : aucune donnée existante n'est modifiée.
-- ===========================================================================

begin;

-- 1. Colonne nullable : aucun provider existant n'est affecté.
alter table public.providers
  add column if not exists outbound_api_key_encrypted text;

comment on column public.providers.outbound_api_key_encrypted is
  'Credential SORTANT (TrouveTout -> provider), chiffre en AES-256-GCM, format v1:iv:tag:ciphertext. Distinct de api_key_hash qui porte le credential ENTRANT (provider -> TrouveTout), stocke en HMAC. NULL tant que le backfill applicatif n''est pas passe.';

-- ---------------------------------------------------------------------------
-- 2. PROTECTION CONTRE LA PERTE SILENCIEUSE DU CREDENTIAL (P0)
--
-- `ingest_listings` faisait `attributes = EXCLUDED.attributes` : le champ était
-- REMPLACÉ intégralement. Un client d'API qui n'envoie pas `sejoura_api_key`
-- -- comportement normal, une intégration n'envoie pas un champ qu'elle ne
-- connaît pas -- effaçait donc la clé de TOUTES les annonces de son lot.
--
-- Symptôme observé : 409 BOOKING_NOT_AVAILABLE sur un lot entier, sans qu'aucune
-- action humaine n'ait été menée. La réservation cessait sans cause visible.
--
-- CORRECTION
--
-- L'ancienne valeur est lue AVANT l'upsert, pendant la boucle : c'est le seul
-- moment où elle est encore disponible, puisque le `DO UPDATE` l'a déjà
-- remplacée. On la mémorise dans une variable, puis on la réapplique si le
-- nouveau lot ne fournit pas de credential.
--
-- Deux règles, toutes deux nécessaires :
--   * clé ABSENTE du nouveau lot  -> l'ancienne est conservée (correction du P0) ;
--   * clé PRÉSENTE dans le nouveau lot -> elle remplace l'ancienne, ce qui
--     permet au provider de faire tourner ses credentials.
--
-- PORTÉE : ce correctif concerne UNIQUEMENT `sejoura_api_key`, dernier champ
-- sensible stocké dans `attributes`. Il sera retiré avec le fallback legacy,
-- quand le credential sera lu depuis `providers.outbound_api_key_encrypted`.
-- ---------------------------------------------------------------------------
create or replace function public.ingest_listings(
  p_provider_id UUID,
  p_category_id UUID,
  p_items       JSONB
)
returns table (inserted INTEGER, updated INTEGER) as $$
declare
  v_item              JSONB;
  v_is_insert         BOOLEAN;
  v_inserted          INTEGER := 0;
  v_updated           INTEGER := 0;
  v_previous_credential TEXT;
begin
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_PAYLOAD: le lot "items" est manquant ou vide';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM providers WHERE id = p_provider_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'PROVIDER_INACTIVE';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    DECLARE
      v_item_category_id UUID;
      v_slug TEXT;
    BEGIN
      v_slug := v_item ->> 'category_slug';
      IF v_slug IS NOT NULL THEN
        SELECT id INTO v_item_category_id FROM categories WHERE slug = v_slug;
        IF NOT FOUND THEN
          v_item_category_id := p_category_id;
        END IF;
      ELSE
        v_item_category_id := p_category_id;
      END IF;

      -- Lecture de l'credential AVANT l'upsert, qui l'écrasera.
      select l.attributes ->> 'sejoura_api_key'
        into v_previous_credential
        from public.listings l
       where l.provider_id = p_provider_id
         and l.external_id = v_item ->> 'external_id';

      insert into public.listings (
        provider_id, category_id, external_id, title, description,
        city, base_price, images, attributes, is_available
      ) values (
        p_provider_id,
        v_item_category_id,
        v_item ->> 'external_id',
        v_item ->> 'title',
        v_item ->> 'description',
        v_item ->> 'city',
        (v_item ->> 'base_price')::NUMERIC,
        COALESCE(v_item -> 'images', '[]'::jsonb),
        COALESCE(v_item -> 'attributes', '{}'::jsonb),
        COALESCE((v_item ->> 'is_available')::BOOLEAN, TRUE)
      )
      on conflict (provider_id, external_id) do update set
        category_id  = EXCLUDED.category_id,
        title        = EXCLUDED.title,
        description  = EXCLUDED.description,
        city         = EXCLUDED.city,
        base_price   = EXCLUDED.base_price,
        images       = EXCLUDED.images,
        attributes   = EXCLUDED.attributes,
        is_available = EXCLUDED.is_available
      returning (xmax = 0) into v_is_insert;

      -- Restauration : uniquement si le nouveau lot n'en a pas fourni un.
      IF v_previous_credential IS NOT NULL
         AND (v_item -> 'attributes' ->> 'sejoura_api_key') IS NULL THEN
        update public.listings l
           set attributes = jsonb_set(
                 l.attributes,
                 '{sejoura_api_key}',
                 to_jsonb(v_previous_credential),
                 true
               )
         where l.provider_id = p_provider_id
           and l.external_id = v_item ->> 'external_id';
      END IF;

      IF v_is_insert THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- La fonction reste serveur uniquement, comme avant ce correctif.
revoke all on function public.ingest_listings(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_listings(uuid, uuid, jsonb) to service_role;
alter function public.ingest_listings(uuid, uuid, jsonb) set search_path = public;

commit;
