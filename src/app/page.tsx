import { HomeScreen } from "@/components/home/home-screen";
import { FALLBACK_CATEGORIES, type HomeCategoryItem } from "@/lib/home-categories";
import { fetchListedListings } from "@/lib/supabase/hotels";
import { fetchCategories } from "@/lib/supabase/listings";
import { MAX_CLIENT_LIMIT } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

export const revalidate = 60;

/** Nombre d'annonces mises en avant sur l'accueil. */
const FEATURED_LIMIT = 8;

/**
 * Annonces mises en avant sur l'accueil.
 *
 * La lecture passe par `fetchListedListings` (route serveur /api/catalog/listings,
 * client service_role) — comme tous les portails. Une lecture directe via le rôle
 * `anon` échouerait (pas de politique RLS de lecture sur `listings`/`providers`).
 *
 * On retourne les `ListingView` complètes (et non un format simplifié) afin que
 * la carte de l'accueil soit la MÊME que celle des portails (`RoomCard`) : un
 * clic ouvre alors directement le détail de l'annonce, sans redirection.
 *
 * Logique d'ordonnancement : annonces sponsorisées (`is_boosted`) d'abord, puis
 * les plus récentes (voir sortRooms). Le tout limité à FEATURED_LIMIT.
 */
async function getFeaturedListings(): Promise<ListingView[]> {
  const { data, error } = await fetchListedListings({
    limit: FEATURED_LIMIT,
  });
  if (error) return [];
  return data;
}

/**
 * Catégories disponibles avec leur nombre d'annonces — alimente le menu
 * déroulant de l'accueil. Repli sur une liste statique si l'API échoue.
 *
 * Comme pour les annonces, la lecture passe par les routes serveur
 * (/api/catalog/*) : le rôle `anon` n'a pas accès à `categories`/`listings`.
 * On récupère les catégories puis on compte les annonces par catégorie à
 * partir d'un unique appel catalogue (service_role).
 */
async function getHomeCategories(): Promise<HomeCategoryItem[]> {
  // 1️⃣ Récupère d'abord la liste des catégories pour connaître leurs slugs.
  const { data: cats, error: catsError } = await fetchCategories();
  if (catsError || cats.length === 0) return FALLBACK_CATEGORIES;

  const categorySlugs = cats.map((row) => row.slug);

  // 2️⃣ Récupère les annonces de TOUTES les catégories (et pas seulement
  //    hotel/residence qui est le défaut de fetchListedListings).
  const { data: listings, error: listingsError } = await fetchListedListings({
    categorySlugs,
    limit: MAX_CLIENT_LIMIT,
  });

  if (listingsError) {
    // En cas d'échec, on affiche les catégories avec un compteur à 0.
    return cats
      .map((row) => ({ slug: row.slug, label: row.name, count: 0 }))
      .sort((a, b) => b.count - a.count);
  }

  const countBySlug = new Map<string, number>();
  for (const room of listings) {
    countBySlug.set(room.category_slug, (countBySlug.get(room.category_slug) ?? 0) + 1);
  }

  return cats
    .map((row) => ({
      slug: row.slug,
      label: row.name,
      count: countBySlug.get(row.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export default async function HomePage() {
  const [listings, categories] = await Promise.all([
    getFeaturedListings(),
    getHomeCategories(),
  ]);

  return (
    <HomeScreen
      listings={listings}
      categories={categories}
      nearbyCount={listings.length}
    />
  );
}
