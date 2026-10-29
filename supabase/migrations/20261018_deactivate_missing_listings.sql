-- ----------------------------------------------------------------------------
-- TROUVETOU — Soft-removal des annonces disparues d'une synchronisation
--
-- Remplace le filtre PostgREST construit côté application :
--   .filter("external_id", "not.in", `(${ids.join(",")})`)
-- qui interprétait `external_id` comme du langage de filtre (virgules,
-- parenthèses, guillemets) et dont l'erreur n'était jamais vérifiée.
--
-- Ici les identifiants voyagent en `text[]` : aucune concaténation, aucune
-- injection possible, et pas de plafond de longueur d'URL sur les gros lots.
--
-- Usage (service_role uniquement) :
--   SELECT deactivate_missing_listings('<provider_id>', ARRAY['rt:1','rt:2']);
-- Retourne le nombre d'annonces passées en `is_available = false`.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deactivate_missing_listings(
  p_provider_id  UUID,
  p_external_ids TEXT[]
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_provider_id IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_REQUIRED: p_provider_id est obligatoire';
  END IF;

  IF p_external_ids IS NULL THEN
    RAISE EXCEPTION 'EXTERNAL_IDS_REQUIRED: p_external_ids est obligatoire';
  END IF;

  -- Un lot vide désactiverait tout le catalogue du provider : on refuse.
  IF array_length(p_external_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'EXTERNAL_IDS_EMPTY: le lot ne peut pas être vide';
  END IF;

  UPDATE listings
     SET is_available = FALSE
   WHERE provider_id = p_provider_id
     AND is_available = TRUE
     AND NOT (external_id = ANY(p_external_ids));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- L'ingestion passe par service_role : aucun autre rôle n'a besoin d'exécuter
-- cette fonction (PUBLIC a EXECUTE par défaut, on le révoque).
REVOKE ALL ON FUNCTION deactivate_missing_listings(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION deactivate_missing_listings(UUID, TEXT[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION deactivate_missing_listings(UUID, TEXT[]) TO service_role;

COMMENT ON FUNCTION deactivate_missing_listings(UUID, TEXT[]) IS
  'Désactive les annonces d''un provider absentes du lot synchronisé (comparaison tableau, sans concaténation SQL).';
