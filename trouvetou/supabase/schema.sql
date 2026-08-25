-- ============================================================================
-- TROUVETOU — Schéma de Base de Données Autonome
-- Comparateur multi-secteur (Hôtels / Résidences, Cliniques, Écoles, ...)
--
-- Base de données DÉDIÉE (distincte de Séjoura).
-- Chaque fournisseur (Séjoura pour les hôtels, un PMS pour les cliniques,
-- un logiciel de gestion d'écoles, ...) pousse ses annonces via l'API
-- d'ingestion /api/v1/sync avec sa clé API.
--
-- Devise : FCFA (XOF)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLE: categories (Secteurs d'activité isolés par slug)
--    Ex : 'hotel', 'clinic', 'school', 'residence', ...
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,             -- 'hotel', 'clinic', 'school', ...
  name       TEXT NOT NULL,                    -- 'Hôtels', 'Cliniques', 'Écoles', ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE categories IS
  'Secteurs d''activité référencés par le comparateur (hôtel, clinique, école, ...).';
COMMENT ON COLUMN categories.slug IS
  'Identifiant lisible stable du secteur, utilisé comme valeur de référence.';

-- ----------------------------------------------------------------------------
-- 2. TABLE: providers (Sources d'alimentation des annonces)
--    Chaque logiciel métier (Séjoura, PMS clinique, SIS école) est un provider.
-- ----------------------------------------------------------------------------
CREATE TABLE providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,                  -- 'Séjoura', 'MediPMS', 'EduSoft', ...
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  api_key_hash TEXT NOT NULL,                  -- HMAC-SHA256(clé API, pepper), jamais la clé en clair
  webhook_url  TEXT,                           -- URL de notification (optionnel)
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_api_key_hash_not_empty CHECK (api_key_hash <> '')
);

COMMENT ON TABLE providers IS
  'Chaque source d''alimentation (logiciel métier) est enregistrée ici.';
COMMENT ON COLUMN providers.api_key_hash IS
  'Empreinte HMAC-SHA256 de la clé API. La clé n''est jamais stockée en clair.';

CREATE INDEX idx_providers_category ON providers(category_id);
CREATE INDEX idx_providers_active ON providers(is_active);

-- ----------------------------------------------------------------------------
-- 3. TABLE: listings (Annonces polymorphes multi-secteurs)
--    Unicité (provider_id, external_id) → sert de cible au UPSERT.
--    attributes JSONB porte la spécificité du secteur, ex :
--      hôtel   : { "beds": 3, "wifi": true, "amenities": ["clim"] }
--      clinique: { "specialties": ["Cardiologie", "Dermatologie"] }
--      école   : { "levels": ["Maternelle", "Primaire"], "language": "fr" }
-- ----------------------------------------------------------------------------
CREATE TABLE listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  external_id  TEXT NOT NULL,                  -- ID stable côté fournisseur (room_type_id, ...)
  title        TEXT NOT NULL,
  description  TEXT,
  city         TEXT,
  base_price   NUMERIC(12, 2),                 -- FCFA (nuit / consultation / scolarité / ...)
  images       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- Tableau de liens CDN/Storage
  attributes   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- Spécificités du secteur
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_base_price_non_negative CHECK (base_price IS NULL OR base_price >= 0),
  CONSTRAINT chk_external_id_not_empty CHECK (external_id <> ''),
  CONSTRAINT chk_title_not_empty CHECK (title <> ''),
  CONSTRAINT chk_images_is_array CHECK (jsonb_typeof(images) = 'array'),
  CONSTRAINT chk_attributes_is_object CHECK (jsonb_typeof(attributes) = 'object'),
  -- Cible du UPSERT de la couche d'ingestion :
  UNIQUE (provider_id, external_id)
);

COMMENT ON TABLE listings IS
  'Annonces polymorphes agrégées depuis les providers, tous secteurs confondus.';
COMMENT ON COLUMN listings.attributes IS
  'JSONB libre propre au secteur : lits/wifi pour l''hôtellerie, spécialités pour les cliniques, niveaux pour les écoles.';
COMMENT ON COLUMN listings.external_id IS
  'Identifiant métier stable chez le fournisseur, utilisé avec provider_id pour l''UPSERT.';

CREATE INDEX idx_listings_provider ON listings(provider_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_external ON listings(provider_id, external_id);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_available ON listings(is_available);
CREATE INDEX idx_listings_updated ON listings(updated_at DESC);
CREATE INDEX idx_listings_attributes_gin ON listings USING gin (attributes jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- 4. TABLE: sync_logs (Journal des synchronisations entrantes)
--    Trace chaque appel à /api/v1/sync : qui, quand, combien, statut.
-- ----------------------------------------------------------------------------
CREATE TABLE sync_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,                   -- 'success', 'partial', 'error'
  items_count INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  updated     INTEGER NOT NULL DEFAULT 0,
  message     TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_provider ON sync_logs(provider_id);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. DONNÉES INITIALES — Catégories de référence
-- ----------------------------------------------------------------------------
INSERT INTO categories (slug, name) VALUES
  ('hotel',    'Hôtels'),
  ('residence','Résidences meublées'),
  ('clinic',   'Cliniques'),
  ('school',   'Écoles'),
  ('other',    'Autre')
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. FONCTION: updated_at automatique
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_providers_updated BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_listings_updated BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
--
--   anon         : LECTURE SEULE du catalogue public (listings, categories,
--                  et le strict nécessaire de providers pour le JOIN !inner).
--   providers    : lecture publique limitée (identité du fournisseur) — la
--                  politique EXISTS évite de laisser passer le désactivé.
--   listings     : lecture publique, aucune mutation côté client.
--   L'ingestion passe par la clé service (service_role) qui contourne RLS.
-- ----------------------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- categories : lecture publique (filtres de l'UI)
CREATE POLICY "categories_select_public" ON categories
  FOR SELECT USING (TRUE);

-- providers : lecture publique restreinte à la partie identité, masquage
--   des colonnes sensibles (api_key_hash, webhook_url) via privilèges de colonne.
--   Sans cela, le JOIN `providers!inner` du catalogue ne renvoie rien au rôle
--   anon et toutes les annonces disparaissent du portail.
REVOKE ALL ON providers FROM anon, authenticated;
GRANT SELECT (id, name, category_id, is_active, created_at, updated_at)
  ON providers TO anon, authenticated;
CREATE POLICY "providers_select_public" ON providers
  FOR SELECT USING (is_active = TRUE);

-- listings : catalogue public en lecture seule
CREATE POLICY "listings_select_public" ON listings
  FOR SELECT USING (is_available = TRUE);

-- sync_logs : aucune politique → inaccessible au rôle anon

-- ----------------------------------------------------------------------------
-- 8. FONCTION UTILITAIRE: Créer un provider avec sa clé API hashée
--    Usage (SQL Editor Supabase) :
--      SELECT create_provider('Séjoura', 'hotel', '<api_key_hash>', 'https://...');
--    Le hash est généré côté application : HMAC-SHA256(clé complète, pepper).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_provider(
  p_name        TEXT,
  p_category    TEXT,
  p_api_key_hash TEXT,
  p_webhook_url TEXT DEFAULT NULL
)
RETURNS providers AS $$
DECLARE
  v_category_id UUID;
  v_provider    providers;
BEGIN
  SELECT id INTO v_category_id FROM categories WHERE slug = p_category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND: catégorie % inconnue', p_category;
  END IF;

  INSERT INTO providers (name, category_id, api_key_hash, webhook_url)
  VALUES (p_name, v_category_id, p_api_key_hash, p_webhook_url)
  RETURNING * INTO v_provider;

  RETURN v_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FONCTION UTILITAIRE: Purge des annonces d'un provider
--    Usage : SELECT purge_provider_listings('<provider_id>');
--    (Appelée par l'opérateur lors de la désactivation d'une source.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_provider_listings(p_provider_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM listings WHERE provider_id = p_provider_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 10. FONCTION: ingest_listings (UPSERT atomique d'un lot d'annonces)
--     Appelée par l'API /api/v1/sync (service_role).
--     Insère ou met à jour chaque annonce sur le couple (provider_id,
--     external_id). Le retour indique le nombre d'insertions vs de mises à
--     jour (détection fiable via le marqueur système `xmax`).
--
--     Usage (via la couche API) :
--       SELECT * FROM ingest_listings(
--         p_provider_id  => '<uuid>',
--         p_category_id  => '<uuid>',
--         p_items        => '[{ "external_id": "...", "title": "..." }]'::jsonb
--       );
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ingest_listings(
  p_provider_id UUID,
  p_category_id UUID,
  p_items       JSONB
)
RETURNS TABLE (inserted INTEGER, updated INTEGER) AS $$
DECLARE
  v_item        JSONB;
  v_is_insert   BOOLEAN;
  v_inserted    INTEGER := 0;
  v_updated     INTEGER := 0;
BEGIN
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
    -- Résolution de la catégorie par item
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

      INSERT INTO listings (
        provider_id, category_id, external_id, title, description,
        city, base_price, images, attributes, is_available
      ) VALUES (
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
      ON CONFLICT (provider_id, external_id) DO UPDATE SET
        category_id  = EXCLUDED.category_id,
        title        = EXCLUDED.title,
        description  = EXCLUDED.description,
        city         = EXCLUDED.city,
        base_price   = EXCLUDED.base_price,
        images       = EXCLUDED.images,
        attributes   = EXCLUDED.attributes,
        is_available = EXCLUDED.is_available
      RETURNING (xmax = 0) INTO v_is_insert;

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
