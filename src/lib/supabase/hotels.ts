import { NAVIGABLE_CATEGORY_SLUGS } from "@/lib/categories";
import { fetchListings } from "./listings";
import { toListingViews, type ListingView } from "./listing-view";
import { haversineDistance, type LatLng } from "@/lib/geo";

// ============================================================================
// TROUVETOU — Service de récupération des annonces du secteur Hôtels
//
// Depuis la migration vers la base dédiée, la lecture passe par la table
// `listings` (polymorphe) filtrée sur les catégories du secteur :
//   hotel (chambres d'hôtel) et residence (résidences meublées).
// ============================================================================

/**
 * Toutes les catégories publiables du catalogue.
 *
 * Sert de défaut aux vues TRANSVERSES (favoris, comparateur) qui ne doivent
 * filtrer aucun secteur. La section « Hôtels & Résidences » passe
 * explicitement `["hotel", "residence"]` (voir `components/catalog/configs`).
 */
export const ALL_SECTION_CATEGORIES: string[] = [
  ...NAVIGABLE_CATEGORY_SLUGS,
];

export interface FetchListedListingsParams {
  search?: string;
  categorySlugs?: string[];
  /** Identifiants précis à charger (favoris, comparateur). */
  ids?: string[];
  maxPrice?: number;
  limit?: number;
  /** Ne retourne que les annonces `is_boosted = true` (filtre SQL). */
  boosted?: boolean;
}

/**
 * Récupère des annonces depuis la base Trouvetou.
 *
 * Par défaut, TOUS les secteurs sont inclus : un défaut restreint aux hôtels
 * masquait silencieusement les écoles et cliniques dans les favoris et le
 * comparateur. Les portails passent leurs propres catégories.
 */
export async function fetchListedListings(
  params: FetchListedListingsParams = {}
): Promise<{ data: ListingView[]; error: Error | null }> {
  const { search, categorySlugs, ids, maxPrice, limit, boosted } = params;

  const { data, error } = await fetchListings({
    search,
    categorySlugs:
      categorySlugs && categorySlugs.length > 0
        ? categorySlugs
        : ALL_SECTION_CATEGORIES,
    ids,
    maxPrice,
    limit,
    boosted,
  });

  if (error) {
    return { data: [], error };
  }

  return { data: toListingViews(data), error: null };
}

/**
 * Récupère les annonces boostées pour le carrousel sponsorisé.
 * Le filtre `is_boosted` est appliqué en SQL AVANT la limite, afin que les
 * annonces boostées les plus récentes ne soient jamais évincées du lot.
 */
export async function fetchBoostedRooms(
  categorySlugs?: string[]
): Promise<{ data: ListingView[]; error: Error | null }> {
  return fetchListedListings({ limit: 20, boosted: true, categorySlugs });
}

export function sortRooms(
  rooms: ListingView[],
  sort: string,
  userLocation?: LatLng | null
): ListingView[] {
  const byCriteria = (a: ListingView, b: ListingView): number => {
    // Tri par distance si une position utilisateur est fournie
    if (sort === "distance" && userLocation) {
      const distA = getDistanceOrNull(userLocation, a);
      const distB = getDistanceOrNull(userLocation, b);
      // Les annonces sans coordonnées passent à la fin
      if (distA == null && distB == null) return 0;
      if (distA == null) return 1;
      if (distB == null) return 1;
      return distA - distB;
    }
    if (sort === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
    if (sort === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
    // « Récent » : tri par date de mise à jour décroissante.
    if (sort === "recent") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return a.name.localeCompare(b.name, "fr");
  };

  const boosted = rooms.filter((room) => room.is_boosted).sort(byCriteria);
  const regular = rooms.filter((room) => !room.is_boosted).sort(byCriteria);

  // Les annonces boostées apparaissent TOUJOURS en premier.
  return [...boosted, ...regular];
}

/** Calcule la distance ou retourne null si les coordonnées manquent. */
function getDistanceOrNull(
  user: LatLng,
  room: ListingView
): number | null {
  const lat = room.establishment?.latitude;
  const lng = room.establishment?.longitude;
  if (lat == null || lng == null) return null;
  return haversineDistance(user, { lat, lng });
}
