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

/** Catégories couvertes par la section « Hôtels & Résidences ». */
const HOTELS_SECTION_CATEGORIES = ["hotel", "residence"];

export interface FetchListedListingsParams {
  search?: string;
  categorySlugs?: string[];
  maxPrice?: number;
  limit?: number;
  /** Ne retourne que les annonces `is_boosted = true` (filtre SQL). */
  boosted?: boolean;
}

/**
 * Récupère les annonces du secteur Hôtels depuis la base Trouvetou.
 * Par défaut la section couvre les catégories `hotel` et `residence`.
 */
export async function fetchListedListings(
  params: FetchListedListingsParams = {}
): Promise<{ data: ListingView[]; error: Error | null }> {
  const { search, categorySlugs, maxPrice, limit, boosted } = params;

  const { data, error } = await fetchListings({
    search,
    categorySlugs:
      categorySlugs && categorySlugs.length > 0
        ? categorySlugs
        : HOTELS_SECTION_CATEGORIES,
    maxPrice,
    limit,
    boosted,
  });

  if (error) {
    return { data: [], error };
  }

  return { data: toListingViews(data), error: null };
}

export interface FetchListedRoomsParams {
  search?: string;
  establishmentTypes?: string[];
  maxPrice?: number;
}

/** Alias de compatibilité (ancien nom). */
export async function fetchListedRooms(
  params: FetchListedRoomsParams = {}
): Promise<{ data: ListingView[]; error: Error | null }> {
  return fetchListedListings({
    search: params.search,
    categorySlugs: params.establishmentTypes,
    maxPrice: params.maxPrice,
  });
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
