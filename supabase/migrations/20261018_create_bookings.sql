-- ----------------------------------------------------------------------------
-- TROUVETOU — Historique des réservations
--
-- La réservation elle-même est créée chez l'établissement (Séjoura) ; cette
-- table archive la trace côté client, rattachée à son compte. Avant, cet
-- historique vivait dans le localStorage du navigateur : un changement
-- d'appareil le faisait disparaître alors que la réservation existait toujours.
--
-- RLS : chaque utilisateur ne voit et ne crée que ses propres lignes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id       UUID REFERENCES listings(id) ON DELETE SET NULL,
  booking_code     TEXT,
  listing_name     TEXT NOT NULL,
  check_in_date    DATE NOT NULL,
  check_out_date   DATE NOT NULL,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  total_amount     NUMERIC(12, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bookings_dates CHECK (check_out_date > check_in_date),
  CONSTRAINT chk_bookings_guests CHECK (number_of_guests BETWEEN 1 AND 50),
  CONSTRAINT chk_bookings_name CHECK (length(btrim(listing_name)) > 0)
);

CREATE INDEX IF NOT EXISTS bookings_user_created
  ON bookings (user_id, created_at DESC);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON bookings FROM anon, authenticated;
-- Pas de UPDATE ni DELETE : une réservation archivée ne se modifie pas
-- depuis le client (l'annulation passe par l'API de l'établissement).
GRANT SELECT, INSERT ON bookings TO authenticated;

-- DROP puis CREATE : le fichier reste rejouable depuis le SQL Editor.
DROP POLICY IF EXISTS bookings_select_own ON bookings;
CREATE POLICY bookings_select_own ON bookings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bookings_insert_own ON bookings;
CREATE POLICY bookings_insert_own ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE bookings IS
  'Historique des réservations par utilisateur. Lecture et création limitées au propriétaire.';
