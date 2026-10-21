# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import op, apply

# ------------------------------------------------------------------ app/page.tsx
op(
    "src/app/page.tsx",
    r"""import {
  FALLBACK_CATEGORIES,
  type HomeCategoryItem,
} from "@/lib/home-categories";
""",
    r"""import {
  CATEGORIES,
  FALLBACK_CATEGORIES,
  NAVIGABLE_CATEGORY_SLUGS,
  type HomeCategoryItem,
} from "@/lib/categories";
""",
)

op(
    "src/app/page.tsx",
    r"""interface CategoryRow {
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
""",
    r"""interface CategoryRow {
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
""",
)

# -------------------------------------------------------------- favoris/page.tsx
op(
    "src/app/favoris/page.tsx",
    r"""import { getPriceSuffix } from "@/lib/utils";
""",
    r"""import { getPriceSuffix } from "@/lib/categories";
""",
)

# ------------------------------------------------------------- app/hotels/page.tsx
op(
    "src/app/hotels/page.tsx",
    r"""export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return <CatalogContent config={HOTELS_CONFIG} initialQuery={initialQuery} />;
}
""",
    r"""export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  // `?type=hotel` ou `?type=residence` : la page s'ouvre filtrée sur la
  // catégorie demandée (lien depuis l'accueil, partage d'annonce).
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={HOTELS_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
""",
)

# ------------------------------------------------------------ app/ecoles/page.tsx
op(
    "src/app/ecoles/page.tsx",
    r"""interface EcolesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function EcolesPage({ searchParams }: EcolesPageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return <CatalogContent config={ECOLES_CONFIG} initialQuery={initialQuery} />;
}
""",
    r"""interface EcolesPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function EcolesPage({ searchParams }: EcolesPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={ECOLES_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
""",
)

# --------------------------------------------------------- app/cliniques/page.tsx
op(
    "src/app/cliniques/page.tsx",
    r"""interface CliniquesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CliniquesPage({ searchParams }: CliniquesPageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return <CatalogContent config={CLINIQUES_CONFIG} initialQuery={initialQuery} />;
}
""",
    r"""interface CliniquesPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function CliniquesPage({ searchParams }: CliniquesPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={CLINIQUES_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
""",
)

# ------------------------------------------------------- app/restaurants/page.tsx
op(
    "src/app/restaurants/page.tsx",
    r"""interface RestaurantsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function RestaurantsPage({ searchParams }: RestaurantsPageProps) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  return <CatalogContent config={RESTAURANTS_CONFIG} initialQuery={initialQuery} />;
}
""",
    r"""interface RestaurantsPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function RestaurantsPage({ searchParams }: RestaurantsPageProps) {
  const { q, type } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";
  const initialType = typeof type === "string" ? type : undefined;

  return (
    <CatalogContent
      config={RESTAURANTS_CONFIG}
      initialQuery={initialQuery}
      initialType={initialType}
    />
  );
}
""",
)

# ------------------------------------------------------------- api/alerts/route.ts
op(
    "src/app/api/alerts/route.ts",
    r"""import { alertConfirmationEmail } from "@/lib/alerts/templates";
""",
    r"""import { alertConfirmationEmail } from "@/lib/alerts/templates";
import { CATEGORIES, NAVIGABLE_CATEGORY_SLUGS } from "@/lib/categories";
""",
)

op(
    "src/app/api/alerts/route.ts",
    r"""/** Libellé affiché dans l'email, par slug de catégorie. */
const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hôtels",
  residence: "Résidences meublées",
  school: "Écoles",
  clinic: "Cliniques",
  restaurant: "Restaurants",
};
""",
    r"""/** Catégories acceptées pour une alerte (libellés du registre canonique). */
const ALERT_CATEGORIES = NAVIGABLE_CATEGORY_SLUGS.map((slug) => ({
  slug,
  label: CATEGORIES[slug].plural,
}));
""",
)

op(
    "src/app/api/alerts/route.ts",
    r"""  if (categorySlug !== null && !(categorySlug in CATEGORY_LABELS)) {
""",
    r"""  if (
    categorySlug !== null &&
    !ALERT_CATEGORIES.some((category) => category.slug === categorySlug)
  ) {
""",
)

op(
    "src/app/api/alerts/route.ts",
    r"""  const message = alertConfirmationEmail({
    categoryLabel: categorySlug ? CATEGORY_LABELS[categorySlug] : null,
    city,
  });
""",
    r"""  const message = alertConfirmationEmail({
    categoryLabel: categorySlug
      ? (ALERT_CATEGORIES.find((category) => category.slug === categorySlug)
          ?.label ?? categorySlug)
      : null,
    city,
  });
""",
)

# ------------------------------------------- api/internal/alerts/dispatch/route.ts
op(
    "src/app/api/internal/alerts/dispatch/route.ts",
    r"""import { newListingsEmail, siteUrl } from "@/lib/alerts/templates";
""",
    r"""import { newListingsEmail, siteUrl } from "@/lib/alerts/templates";
import { categoryHref, getCategoryPluralLabel } from "@/lib/categories";
""",
)

op(
    "src/app/api/internal/alerts/dispatch/route.ts",
    r"""const PORTAL_BY_SLUG: Record<string, string> = {
  hotel: "/hotels",
  residence: "/hotels",
  school: "/ecoles",
  clinic: "/cliniques",
  restaurant: "/restaurants",
};

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hôtels",
  residence: "Résidences meublées",
  school: "Écoles",
  clinic: "Cliniques",
  restaurant: "Restaurants",
};
""",
    "",
)

op(
    "src/app/api/internal/alerts/dispatch/route.ts",
    r"""        href: `${siteUrl()}${PORTAL_BY_SLUG[slug] ?? "/hotels"}`,
""",
    r"""        href: `${siteUrl()}${categoryHref(slug)}`,
""",
)

op(
    "src/app/api/internal/alerts/dispatch/route.ts",
    r"""      categoryLabel: alert.category_slug
        ? CATEGORY_LABELS[alert.category_slug] ?? alert.category_slug
        : null,
""",
    r"""      categoryLabel: alert.category_slug
        ? getCategoryPluralLabel(alert.category_slug)
        : null,
""",
)

apply()
