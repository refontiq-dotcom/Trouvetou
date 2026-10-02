import type { LucideIcon } from "lucide-react";
import {
  Building2,
  GraduationCap,
  LayoutGrid,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";

/** Catégorie affichée dans le menu déroulant de l'accueil. */
export interface HomeCategoryItem {
  /** Slug de la catégorie (`categories.slug`). */
  slug: string;
  /** Libellé affiché. */
  label: string;
  /** Nombre d'annonces disponibles. */
  count: number;
}

/**
 * Portail de destination par catégorie — cohérent avec
 * `components/catalog/configs.ts`.
 */
export const PORTAL_BY_SLUG: Record<string, string> = {
  hotel: "/hotels",
  residence: "/hotels",
  school: "/ecoles",
  clinic: "/cliniques",
  restaurant: "/restaurants",
};

/** Présentation visuelle d'une catégorie (icône + couleurs de la pastille). */
interface CategoryMeta {
  href: string;
  icon: LucideIcon;
  chipBg: string;
  chipText: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  hotel: {
    href: "/hotels",
    icon: Building2,
    chipBg: "bg-amber-100",
    chipText: "text-amber-600",
  },
  residence: {
    href: "/hotels",
    icon: Building2,
    chipBg: "bg-violet-100",
    chipText: "text-violet-600",
  },
  school: {
    href: "/ecoles",
    icon: GraduationCap,
    chipBg: "bg-blue-100",
    chipText: "text-blue-600",
  },
  clinic: {
    href: "/cliniques",
    icon: Stethoscope,
    chipBg: "bg-sky-100",
    chipText: "text-sky-600",
  },
  restaurant: {
    href: "/restaurants",
    icon: UtensilsCrossed,
    chipBg: "bg-orange-100",
    chipText: "text-orange-600",
  },
};

const FALLBACK_META: CategoryMeta = {
  href: "/hotels",
  icon: LayoutGrid,
  chipBg: "bg-neutral-100",
  chipText: "text-neutral-600",
};

/** Métadonnées d'une catégorie, avec un repli neutre si le slug est inconnu. */
export function categoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[slug] ?? FALLBACK_META;
}

/**
 * Catégories de repli affichées quand la base n'est pas configurée
 * (même logique que les annonces de démonstration de l'accueil).
 */
export const FALLBACK_CATEGORIES: HomeCategoryItem[] = [
  { slug: "hotel", label: "Hôtels", count: 24 },
  { slug: "residence", label: "Résidences", count: 15 },
  { slug: "school", label: "Écoles", count: 12 },
  { slug: "clinic", label: "Cliniques", count: 8 },
  { slug: "restaurant", label: "Restaurants", count: 6 },
];