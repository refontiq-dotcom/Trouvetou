-- ============================================================================
-- TROUVETOU — Schéma de Base de Données Autonome
-- Comparateur multi-secteur (Hôtels / Résidences, Cliniques, Écoles, ...)
--
-- Base de données DÉDIÉE (distincte de Séjoura).
-- Chaque fournisseur (Séjoura pour les hôtels, un PMS pour les cliniques,
-- un logiciel de gestion d'écoles, ...) pousse ses annonces via l'API
-- d'ingestion /api/v1/sync avec sa clé API.
--
-- INSTALLATION :
--   1. Appliquer CE fichier (schéma de base + instantané des objets
--      reconstitués en section 11).
--   2. Appliquer les migrations de supabase/migrations/ dans l'ordre
--      lexicographique (ls -1 | sort) : c'est l'ordre d'application et il est
--      significatif. 20260924_reconstitute_missing_schema.sql DOIT précéder
--      les migrations 20260925_* qui dépendent de ses objets.
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
--   listings     : lecture publique, aucune mutation côté client. La colonne
--                  `attributes` (contient des secrets fournisseur, ex :
--                  sejoura_api_key) est masquée des rôles anon/authenticated
--                  via privilèges de colonne, comme pour `providers`.
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
-- `attributes` masqué des rôles anon/authenticated (peut contenir des
-- secrets fournisseur, ex : sejoura_api_key, en clair). Sans ce privilège
-- de colonne, n'importe qui muni de la clé anon publique pourrait lire
-- `attributes` directement via l'API REST Supabase, hors de l'app.
REVOKE ALL ON listings FROM anon, authenticated;
GRANT SELECT (
  id,
  provider_id,
  category_id,
  external_id,
  title,
  description,
  city,
  base_price,
  images,
  is_available,
  created_at,
  updated_at
) ON listings TO anon, authenticated;
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

-- ============================================================================
-- 11. OBJETS COMPLÉMENTAIRES (reconstitués le 2026-09-24)
--
--     Ces objets existaient en production sans aucune définition versionnée
--     (créés « à la main » dans le SQL Editor). La DÉFINITION DE RÉFÉRENCE
--     EST LA MIGRATION supabase/migrations/20260924_reconstitute_missing_schema.sql
--     (rejouable, idempotente, avec les grants/policies complète) — source du
--     connecteur Schooly : schooly/trouvetou-migrations/
--     20260913000000_schooly_connector.sql, et usage applicatif des
--     favoris/profils.
--
--     Ce bloc est un instantané de référence pour l'installation vierge, dans
--     la continuité de ce fichier. Il n'inclut pas les objets purement
--     incrémentaux (traffic, provider_api_key_aliases) ni le RPC
--     schooly_sync_school : ceux-ci restent définis par leur seule migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 11.1 Connecteur Schooly : écoles synchronisées, niveaux, journal
-- ----------------------------------------------------------------------------
CREATE TABLE schooly_schools (
  id                   UUID PRIMARY KEY,             -- ID original Schooly (immutable)
  schooly_instance_url TEXT NOT NULL,                 -- URL de l'instance Schooly
  nom                  TEXT NOT NULL,
  ville                TEXT,
  latitude             DOUBLE PRECISION,
  longitude            DOUBLE PRECISION,
  description_publique TEXT,
  itineraire           TEXT,
  photos_360           JSONB DEFAULT '[]'::jsonb,
  video_url            TEXT,
  grille_tarifaire_publique JSONB DEFAULT '[]'::jsonb,
  published            BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schooly_instance_url, id)
);

CREATE INDEX idx_schooly_schools_published ON schooly_schools (published) WHERE published = TRUE;
CREATE INDEX idx_schooly_schools_location ON schooly_schools (latitude, longitude)
  WHERE published = TRUE AND latitude IS NOT NULL;

CREATE TABLE schooly_grade_levels (
  id                 UUID PRIMARY KEY,                 -- ID original Schooly
  schooly_school_id  UUID NOT NULL REFERENCES schooly_schools(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  capacity           INTEGER NOT NULL DEFAULT 0,
  prix_min           BIGINT,
  prix_max           BIGINT,
  places_disponibles INTEGER NOT NULL DEFAULT 0,
  last_sync_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schooly_school_id, id)
);

CREATE INDEX idx_schooly_grade_school ON schooly_grade_levels (schooly_school_id);

CREATE TABLE schooly_sync_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schooly_school_id UUID REFERENCES schooly_schools(id) ON DELETE SET NULL,
  action           TEXT NOT NULL CHECK (action IN
                     ('sync', 'unsync', 'availability_update', 'reservation_created', 'reservation_confirmed')),
  payload          JSONB,
  status           TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'warning')),
  message          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schooly_sync_log_school ON schooly_sync_log (schooly_school_id);
CREATE INDEX idx_schooly_sync_log_created ON schooly_sync_log (created_at DESC);

CREATE TRIGGER trg_schooly_schools_updated BEFORE UPDATE ON schooly_schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_schooly_grade_levels_updated BEFORE UPDATE ON schooly_grade_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lecture publique limitée aux écoles publiées ; le journal reste interne.
ALTER TABLE schooly_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE schooly_grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE schooly_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schooly_schools_public_read" ON schooly_schools
  FOR SELECT USING (published = TRUE);

CREATE POLICY "schooly_grade_levels_public_read" ON schooly_grade_levels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM schooly_schools s WHERE s.id = schooly_school_id AND s.published = TRUE)
  );

-- Le rôle service_role bypasse RLS : aucune policy d'écriture nécessaire.
REVOKE ALL ON schooly_sync_log FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11.2 Favoris et profils (authentifiés)
-- ----------------------------------------------------------------------------
CREATE TABLE favorites (
  user_id    UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_favorites_listing ON favorites (listing_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON favorites FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON favorites TO authenticated;

CREATE POLICY favorites_select_own ON favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY favorites_insert_own ON favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY favorites_delete_own ON favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
