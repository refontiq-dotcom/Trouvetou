import { getAdminClient } from "./admin";
import { LISTINGS_SELECT, mapRows } from "./listings";
import { toListingViews, type ListingView } from "./listing-view";

// ============================================================================
// TROUVETOU — Annonces récentes de l'accueil
//
// Lecture serveur uniquement (client service_role). Le rôle `anon` ne peut pas
// lire `providers`, ce qui viderait le JOIN `providers!inner` : on réutilise
// donc le même SELECT que la route publique /api/catalog/listings, avec les
// mêmes garanties (annonces disponibles, providers actifs uniquement).
//
// Le résultat est déjà normalisé en `ListingView` : les cartes et le modal de
// détail consomment exactement la même forme que les portails de catégorie,
// sans second appel réseau côté client.
// ============================================================================

/** Nombre d'annonces récentes affichées sur l'accueil. */
export const RECENT_LISTINGS_LIMIT = 12;

export interface RecentListingsResult {
  listings: ListingView[];
  /** Message technique en cas d'échec ; jamais affiché tel quel. */
  error: string | null;
}

/**
 * Dernières annonces publiées, toutes catégories confondues, triées par
 * `updated_at` décroissant (champ réellement présent en base).
 *
 * Sans configuration serveur, retourne une liste vide sans erreur : l'accueil
 * affiche alors son état « catalogue bientôt disponible » plutôt que des
 * annonces inventées.
 */
export async function fetchRecentListings(
  limit: number = RECENT_LISTINGS_LIMIT
): Promise<RecentListingsResult> {
  const admin = getAdminClient();
  if (!admin) {
    return { listings: [], error: null };
  }

  try {
    const { data, error } = await admin
      .from("listings")
      .select(LISTINGS_SELECT)
      .eq("is_available", true)
      .eq("providers.is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { listings: [], error: error.message };
    }

    return { listings: toListingViews(mapRows(data)), error: null };
  } catch (err) {
    return {
      listings: [],
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}
