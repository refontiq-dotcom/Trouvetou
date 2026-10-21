import { HomeScreen } from "@/components/home/home-screen";
import {
  CATEGORIES,
  FALLBACK_CATEGORIES,
  NAVIGABLE_CATEGORY_SLUGS,
  type HomeCategoryItem,
} from "@/lib/categories";
import { getSupabase } from "@/lib/supabase/client";
import type { ListingView } from "@/lib/supabase/listing-view";
import {
  fetchRecentListings,
  RECENT_LISTINGS_LIMIT,
} from "@/lib/supabase/recent-listings";

export const revalidate = 60;

/**
 * Les annonces de démonstration ne s'affichent que si `NEXT_PUBLIC_DEMO=1`.
 * Par défaut, une base vide ou non configurée donne un accueil sans annonce :
 * jamais de fausses annonces présentées comme un vrai catalogue.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO === "1";

/** Date technique des cartes de démonstration (jamais affichée). */
const DEMO_UPDATED_AT = "2026-01-01T00:00:00.000Z";

/** Fabrique une annonce de démonstration complète, au même format que la base. */
function demoListing(input: {
  id: string;
  title: string;
  description: string;
  city: string;
  price: number;
  image: string;
}): ListingView {
  return {
    id: input.id,
    external_id: input.id,
    name: input.title,
    price: input.price,
    images: [input.image],
    description: input.description,
    amenities: [],
    capacity: null,
    is_boosted: false,
    category_slug: "hotel",
    establishment: {
      id: `demo-provider-${input.id}`,
      name: "Démo Trouvetou",
      type: "hotel",
      city: input.city,
      country: "CI",
      address: null,
      latitude: null,
      longitude: null,
      contact_phone: null,
      whatsapp: null,
      contact_email: null,
    },
    panoramas: [],
    updated_at: DEMO_UPDATED_AT,
  };
}

/** Cartes de démonstration conformes à la maquette (uniquement en mode DEMO). */
const FALLBACK_LISTINGS: ListingView[] = [
  demoListing({
    id: "demo-sejour-moderne",
    title: "Superbe séjour moderne",
    description: "Baigné de lumière naturelle.",
    city: "Cocody",
    price: 85000,
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=640&h=480&fit=crop",
  }),
  demoListing({
    id: "demo-cuisine-haut-de-gamme",
    title: "Cuisine équipée haut de gamme",
    description: "Avec îlot central et finitions soignées.",
    city: "Cocody",
    price: 75000,
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=640&h=480&fit=crop",
  }),
  demoListing({
    id: "demo-duplex-familial",
    title: "Duplex familial tout confort",
    description: "Terrasse privée et parking inclus.",
    city: "Cocody",
    price: 120000,
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640&h=480&fit=crop",
  }),
  demoListing({
    id: "demo-studio-meuble",
    title: "Studio meublé tout compris",
    description: "Fibre, ménage et eau inclus.",
    city: "Marcory",
    price: 55000,
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=640&h=480&fit=crop",
  }),
];

interface CategoryRow {
  id: string;
  slug: string;
}

/**
 * Catégories disponibles avec leur nombre d'annonces — alimente les menus de
 * l'accueil.
 *
 * Les libellés viennent du registre canonique (jamais de la base, dont le nom
 * pouvait diverger : « Résidences meublées » vs « Résidences ») ; seule la base
 * apporte le compteur. Seules les catégories possédant un portail sont
 * proposées : une catégorie sans page ne peut pas être cliquée.
 * Repli sur une liste statique sans base configurée.
 */
async function getHomeCategories(): Promise<HomeCategoryItem[]> {
  const supabase = getSupabase();
  if (!supabase) return FALLBACK_CATEGORIES;

  try {
    const { data } = await supabase.from("categories").select("id, slug");
    const rows = (data ?? []) as unknown as CategoryRow[];

    const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));

    const counts = await Promise.all(
      NAVIGABLE_CATEGORY_SLUGS.map(async (slug) => {
        const categoryId = idBySlug.get(slug);
        if (!categoryId) return [slug, 0] as const;
        const { count } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("category_id", categoryId)
          .eq("is_available", true);
        return [slug, count ?? 0] as const;
      })
    );
    const countBySlug = new Map(counts);

    return NAVIGABLE_CATEGORY_SLUGS.map((slug) => ({
      slug,
      label: CATEGORIES[slug].plural,
      count: countBySlug.get(slug) ?? 0,
    })).sort((a, b) => b.count - a.count);
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

export default async function HomePage() {
  const [recent, categories] = await Promise.all([
    fetchRecentListings(RECENT_LISTINGS_LIMIT),
    getHomeCategories(),
  ]);

  const visibleListings =
    recent.listings.length > 0
      ? recent.listings
      : DEMO_MODE
        ? FALLBACK_LISTINGS
        : [];

  return (
    <HomeScreen
      listings={visibleListings}
      categories={categories}
      nearbyCount={visibleListings.length}
    />
  );
}
