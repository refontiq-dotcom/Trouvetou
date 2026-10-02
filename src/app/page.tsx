import { HomeScreen } from "@/components/home/home-screen";
import type { HomeListing } from "@/components/home/listing-card";
import {
  FALLBACK_CATEGORIES,
  PORTAL_BY_SLUG,
  type HomeCategoryItem,
} from "@/lib/home-categories";
import { getSupabase } from "@/lib/supabase/client";

export const revalidate = 60;

/** Catégories proposées à la nuitée (prix affiché « / nuit »). */
const STAY_SLUGS = new Set(["hotel", "residence"]);

/** Cartes de démonstration conformes à la maquette (fallback base vide). */
const FALLBACK_LISTINGS: HomeListing[] = [
  {
    id: "demo-sejour-moderne",
    title: "Superbe séjour moderne",
    subtitle: "Baigné de lumière naturelle",
    city: "Cocody",
    ratingLabel: "4,8",
    priceLabel: "85 000 FCFA / nuit",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=640&h=480&fit=crop",
    href: "/hotels",
  },
  {
    id: "demo-cuisine-haut-de-gamme",
    title: "Cuisine équipée haut de gamme",
    subtitle: "Avec ilot central et finitions soignées",
    city: "Cocody",
    ratingLabel: "4,7",
    priceLabel: "75 000 FCFA / nuit",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=640&h=480&fit=crop",
    href: "/hotels",
  },
  {
    id: "demo-duplex-familial",
    title: "Duplex familial tout confort",
    subtitle: "Terrasse privée et parking inclus",
    city: "Cocody",
    ratingLabel: "4,6",
    priceLabel: "120 000 FCFA / nuit",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640&h=480&fit=crop",
    href: "/hotels",
  },
  {
    id: "demo-studio-meuble",
    title: "Studio meublé tout compris",
    subtitle: "Fibre, ménage et eau inclus",
    city: "Marcory",
    ratingLabel: "4,5",
    priceLabel: "55 000 FCFA / nuit",
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=640&h=480&fit=crop",
    href: "/hotels",
  },
];

interface ListingRow {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  base_price: number | null;
  images: string[] | null;
  categories: { slug: string } | { slug: string }[] | null;
}

function priceLabel(price: number | null, slug: string): string | undefined {
  if (!price || price <= 0) return undefined;
  const formatted = `${price.toLocaleString("fr-FR")} FCFA`;
  return STAY_SLUGS.has(slug) ? `${formatted} / nuit` : formatted;
}

/** Dernières annonces disponibles, mises en forme pour l'accueil. */
async function getFeaturedListings(): Promise<HomeListing[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data } = await supabase
      .from("listings")
      .select(
        "id, title, description, city, base_price, images, categories(slug)"
      )
      .eq("is_available", true)
      .order("updated_at", { ascending: false })
      .limit(4);

    const rows = (data ?? []) as unknown as ListingRow[];

    return rows
      .map((row): HomeListing | null => {
        const category = Array.isArray(row.categories)
          ? row.categories[0]
          : row.categories;
        if (!category) return null;

        return {
          id: row.id,
          title: row.title,
          subtitle: row.description ?? undefined,
          city: row.city ?? undefined,
          priceLabel: priceLabel(row.base_price, category.slug),
          image: row.images?.[0] ?? "/placeholder-hotel.svg",
          href: PORTAL_BY_SLUG[category.slug] ?? "/hotels",
        };
      })
      .filter((l): l is HomeListing => l !== null);
  } catch {
    return [];
  }
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

/**
 * Catégories disponibles avec leur nombre d'annonces — alimente le menu
 * déroulant de l'accueil. Repli sur une liste statique sans base configurée.
 */
async function getHomeCategories(): Promise<HomeCategoryItem[]> {
  const supabase = getSupabase();
  if (!supabase) return FALLBACK_CATEGORIES;

  try {
    const { data } = await supabase.from("categories").select("id, slug, name");
    const rows = (data ?? []) as unknown as CategoryRow[];
    if (rows.length === 0) return FALLBACK_CATEGORIES;

    const counts = await Promise.all(
      rows.map(async (row) => {
        const { count } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("category_id", row.id)
          .eq("is_available", true);
        return [row.slug, count ?? 0] as const;
      })
    );
    const countBySlug = new Map(counts);

    return rows
      .map((row) => ({
        slug: row.slug,
        label: row.name,
        count: countBySlug.get(row.slug) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

export default async function HomePage() {
  const [listings, categories] = await Promise.all([
    getFeaturedListings(),
    getHomeCategories(),
  ]);

  const visibleListings = listings.length > 0 ? listings : FALLBACK_LISTINGS;

  return (
    <HomeScreen
      listings={visibleListings}
      categories={categories}
      nearbyCount={visibleListings.length}
    />
  );
}
