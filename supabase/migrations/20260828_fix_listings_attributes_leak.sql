-- ============================================================================
-- FIX SÉCURITÉ — Masquer listings.attributes des rôles anon/authenticated
--
-- Problème : la policy RLS "listings_select_public" autorisait SELECT * dès
-- que is_available = TRUE. RLS filtre des LIGNES, pas des colonnes : la
-- colonne `attributes` (qui contient des secrets fournisseur en clair, ex.
-- sejoura_api_key) était donc lisible par n'importe qui muni de la clé
-- publique `anon`, en interrogeant directement l'API REST Supabase
-- (ex: GET {url}/rest/v1/listings?select=attributes), en dehors de l'app.
--
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run.
-- Sans risque pour l'app : elle ne lit jamais `listings` avec le rôle
-- anon/authenticated (uniquement via /api/catalog/* en service_role, qui
-- contourne ces privilèges de colonne).
-- ============================================================================

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

-- Vérification rapide après exécution (doit renvoyer une erreur de permission
-- si vous testez avec la clé anon, PAS les données) :
--   select attributes from listings limit 1;
