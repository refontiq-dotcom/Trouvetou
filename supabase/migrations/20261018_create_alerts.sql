-- ----------------------------------------------------------------------------
-- TROUVETOU — Alertes email
--
-- Remplace l'ancien formulaire qui prétendait enregistrer l'abonnement mais
-- n'écrivait que dans le localStorage du visiteur : l'adresse était perdue et
-- aucune alerte n'était jamais envoyée.
--
-- Aucune donnée n'est exposée au client : la table est en RLS sans politique,
-- les privilèges sont révoqués pour anon/authenticated, et seule la couche
-- serveur (service_role) lit et écrit.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  category_slug    TEXT,          -- NULL = toutes les catégories
  city             TEXT,          -- NULL = toutes les villes
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_notified_at TIMESTAMPTZ,   -- dernier envoi pour cet abonnement
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- L'application normalise déjà l'adresse : la contrainte garantit qu'aucune
  -- autre voie d'écriture ne peut stocker une variante de casse ou d'espaces.
  CONSTRAINT chk_alerts_email_normalized
    CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 5 AND 254),
  CONSTRAINT chk_alerts_city
    CHECK (city IS NULL OR length(btrim(city)) BETWEEN 2 AND 80)
);

-- Un même email ne s'abonne qu'une fois par couple (catégorie, ville).
CREATE UNIQUE INDEX IF NOT EXISTS alerts_unique_subscription
  ON alerts (email, COALESCE(category_slug, ''), COALESCE(lower(city), ''));

CREATE INDEX IF NOT EXISTS alerts_active_scope
  ON alerts (is_active, category_slug, lower(city));

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Aucune politique : la table est invisible pour anon et authenticated, même
-- avec la clé publique. Le formulaire passe par /api/alerts (service_role).
REVOKE ALL ON alerts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON alerts TO service_role;

COMMENT ON TABLE alerts IS
  'Abonnements email aux nouvelles annonces. Écriture et lecture réservées au service_role.';
COMMENT ON COLUMN alerts.last_notified_at IS
  'Date du dernier email de notification envoyé pour cet abonnement.';
