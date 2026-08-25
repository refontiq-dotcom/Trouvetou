import type { Listing } from "./database.types";

// ============================================================================
// TROUVETOU — Lecture du catalogue public (base autonome Trouvetou)
//
// Le portail consomme désormais la table polymorphe `listings` de sa propre
// base, agrégée par la couche d'ingestion /api/v1/sync (voir `categories`,
// `providers`, `listings` dans supabase/schema.sql).
//
// Les lectures passent par les routes serveur /api/catalog/* (client admin,
// service_role) car le rôle `anon` ne peut pas lire `providers` (pas de
// politique RLS) : le JOIN `providers!inner` du portail filtrerait alors
// toutes les annonces.
// ============================================================================

export const LISTINGS_SELECT = `
  id,
  provider_id,
  category_id,
  external_id,
  title,
  description,
  city,
  base_price,
  images,
  attributes,
  is_available,
  created_at,
  updated_at,
  categories!inner (
    id,
    slug,
    name
  ),
  providers!inner (
    id,
    name
  )
`;

export interface FetchListingsParams {
  search?: string;
  categorySlugs?: string[];
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "updated";
  limit?: number;
  /** Ne retourne que les annonces `is_boosted = true` (filtre SQL). */
  boosted?: boolean;
}

export interface ListedListing extends Listing {
  category: {
    id: string;
    slug: string;
    name: string;
  };
  provider: {
    id: string;
    name: string;
  };
}

/** Ligne brute retournée par PostgREST (ressources embarquées). */
interface ListingRow {
  id: string;
  provider_id: string;
  category_id: string;
  external_id: string;
  title: string;
  description: string | null;
  city: string | null;
  base_price: number | null;
  images: string[] | null;
  attributes: Record<string, unknown> | null;
  is_available: boolean | null;
  created_at: string;
  updated_at: string;
  categories:
    | { id: string; slug: string; name: string }
    | { id: string; slug: string; name: string }[]
    | null;
  providers: { id: string; name: string } | { id: string; name: string }[] | null;
}

function mapRow(row: ListingRow): ListedListing | null {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const provider = Array.isArray(row.providers) ? row.providers[0] : row.providers;
  if (!category || !provider) return null;

  return {
    id: row.id,
    provider_id: row.provider_id,
    category_id: row.category_id,
    external_id: row.external_id,
    title: row.title,
    description: row.description,
    city: row.city,
    base_price: row.base_price,
    images: Array.isArray(row.images) ? row.images : [],
    attributes: row.attributes ?? {},
    is_available: row.is_available ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category,
    provider,
  };
}

function mapRows(data: unknown): ListedListing[] {
  const rows = (data as unknown as ListingRow[]) ?? [];
  return rows
    .map(mapRow)
    .filter((l): l is ListedListing => l !== null);
}

/**
 * Récupère les annonces publiques du comparateur.
 * La lecture passe par la route serveur /api/catalog/listings (client admin,
 * service_role) : la lecture directe en base via le rôle `anon` échoue sur le
 * JOIN `providers!inner` car `providers` n'a pas de politique RLS de lecture
 * pour ce rôle. Les filtres (catégories, budget, recherche) sont appliqués
 * côté serveur ; le tri est appliqué ici après normalisation.
 */
export async function fetchListings(
  params: FetchListingsParams = {}
): Promise<{ data: ListedListing[]; error: Error | null }> {
  const { search, categorySlugs, maxPrice, sort, limit, boosted } = params;

  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://trouvetou.vercel.app";

  const url = new URL("/api/catalog/listings", base);
  if (search && search.trim().length > 0) {
    url.searchParams.set("q", search.trim());
  }
  if (categorySlugs && categorySlugs.length > 0) {
    url.searchParams.set("categories", categorySlugs.join(","));
  }
  if (maxPrice && maxPrice > 0) {
    url.searchParams.set("maxPrice", String(maxPrice));
  }
  if (limit && limit > 0) {
    url.searchParams.set("limit", String(limit));
  }
  if (boosted) {
    url.searchParams.set("boosted", "1");
  }

  let rows: ListingRow[];
  try {
    const res = await fetch(url, { cache: "no-store" });
    const body = (await res.json()) as { data?: ListingRow[]; error?: string | null };
    if (!res.ok || body.error) {
      return {
        data: [],
        error: new Error(body.error ?? `Erreur HTTP ${res.status}`),
      };
    }
    rows = body.data ?? [];
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error("Erreur réseau"),
    };
  }

  const listings = mapRows(rows);

  const sortKey = sort ?? "updated";
  listings.sort((a, b) => {
    if (sortKey === "price_asc") return (a.base_price ?? 0) - (b.base_price ?? 0);
    if (sortKey === "price_desc") return (b.base_price ?? 0) - (a.base_price ?? 0);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return { data: listings, error: null };
}

/** Récupère les catégories de référence (filtres de l'interface). */
export async function fetchCategories(): Promise<{
  data: Array<{ slug: string; name: string }>;
  error: Error | null;
}> {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://trouvetou.vercel.app";

  try {
    const res = await fetch(`${base}/api/catalog/categories`, { cache: "no-store" });
    const body = (await res.json()) as { data?: Array<{ slug: string; name: string }>; error?: string | null };
    if (!res.ok || body.error) {
      return {
        data: [],
        error: new Error(body.error ?? `Erreur HTTP ${res.status}`),
      };
    }
    return { data: body.data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error("Erreur réseau"),
    };
  }
}
