# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import op, apply

# ---------------------------------------------------------------- utils.ts
op(
    "src/lib/utils.ts",
    r"""import type { EstablishmentType } from "./supabase/database.types";
""",
    "",
)

op(
    "src/lib/utils.ts",
    r"""/**
 * Libellé de prix selon la catégorie d'une annonce.
 * Utilisé quand une carte est affichée hors de son portail dédié
 * (ex. page Favoris qui mélange toutes les catégories).
 */
export function getPriceSuffix(categorySlug: string): string {
  switch (categorySlug) {
    case "school":
      return "par scolarité";
    case "restaurant":
      return "par plat";
    case "clinic":
      return "par consultation";
    default:
      return "par nuit";
  }
}

""",
    r"""/*
 * Les libellés de catégorie (prix, couleurs, portail, icône) sont centralisés
 * dans `lib/categories.ts` : une seule table pour toute l'application.
 */

""",
)

op(
    "src/lib/utils.ts",
    r"""export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  hotel: "Hôtel",
  residence: "Résidence",
  appartements: "Appartements",
  villa: "Villa",
  guesthouse: "Maison d'hôtes",
  other: "Établissement",
};

export function getEstablishmentTypeLabel(type: EstablishmentType | null): string {
  if (!type) return "Établissement";
  return ESTABLISHMENT_TYPE_LABELS[type] ?? "Établissement";
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hôtel",
  residence: "Résidence",
  restaurant: "Restaurant",
  clinic: "Clinique",
  school: "École",
  other: "Établissement",
};

/** Libellé d'une catégorie Trouvetou (slug : hotel, residence, clinic, school, other). */
export function getCategoryLabel(slug: string | null): string {
  if (!slug) return "Établissement";
  return CATEGORY_LABELS[slug] ?? slug;
}
""",
    "",
)

# --------------------------------------------------------- eligibility.ts
op(
    "src/lib/booking/eligibility.ts",
    r"""// Source de vérité UNIQUE pour savoir si une annonce affiche (et peut ouvrir)
// le bouton « Réserver ». Avant, room-card / boosted-carousel utilisaient
// `room.category_slug` et le modal un autre calcul : un clic pouvait donc ne
// rien afficher, sans aucun message pour l'utilisateur.
// ============================================================================
""",
    r"""// Source de vérité UNIQUE pour savoir si une annonce affiche (et peut ouvrir)
// le bouton « Réserver ». Avant, room-card / boosted-carousel utilisaient
// `room.category_slug` et le modal un autre calcul : un clic pouvait donc ne
// rien afficher, sans aucun message pour l'utilisateur.
//
// Les catégories réservables sont décrites par le registre canonique
// `lib/categories.ts` : cette liste n'en est qu'un miroir.
// ============================================================================

import { isBookableCategory as registryIsBookable } from "@/lib/categories";
""",
)

op(
    "src/lib/booking/eligibility.ts",
    r"""/** Catégories dont la réservation « par nuit » a un sens. */
const BOOKABLE_CATEGORIES = new Set(["hotel", "residence"]);

""",
    "",
)

op(
    "src/lib/booking/eligibility.ts",
    r"""/** Un slug de catégorie donne-t-il droit à la réservation en ligne ? */
export function isBookableCategory(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return BOOKABLE_CATEGORIES.has(slug.trim().toLowerCase());
}
""",
    r"""/** Un slug de catégorie donne-t-il droit à la réservation en ligne ? */
export function isBookableCategory(slug: string | null | undefined): boolean {
  return registryIsBookable(slug);
}
""",
)

# -------------------------------------------------------- search-intent.ts
op(
    "src/lib/search-intent.ts",
    r"""export type UniverseSlug = "hotels" | "ecoles" | "cliniques" | "restaurants";
""",
    r"""import { PORTALS, type UniverseSlug } from "@/lib/categories";

export type { UniverseSlug };
""",
)

op(
    "src/lib/search-intent.ts",
    r"""    slug: "hotels",
    label: "Hôtels & Résidences",
    href: "/hotels",
""",
    r"""    slug: "hotels",
    label: PORTALS.hotels.label,
    href: PORTALS.hotels.path,
""",
)

op(
    "src/lib/search-intent.ts",
    r"""    slug: "ecoles",
    label: "Écoles & Établissements",
    href: "/ecoles",
""",
    r"""    slug: "ecoles",
    label: PORTALS.ecoles.label,
    href: PORTALS.ecoles.path,
""",
)

op(
    "src/lib/search-intent.ts",
    r"""    slug: "restaurants",
    label: "Restaurants",
    href: "/restaurants",
""",
    r"""    slug: "restaurants",
    label: PORTALS.restaurants.label,
    href: PORTALS.restaurants.path,
""",
)

op(
    "src/lib/search-intent.ts",
    r"""    slug: "cliniques",
    label: "Cliniques & Santé",
    href: "/cliniques",
""",
    r"""    slug: "cliniques",
    label: PORTALS.cliniques.label,
    href: PORTALS.cliniques.path,
""",
)

# ------------------------------------------------------- supabase/hotels.ts
op(
    "src/lib/supabase/hotels.ts",
    r"""import { fetchListings } from "./listings";
""",
    r"""import { NAVIGABLE_CATEGORY_SLUGS } from "@/lib/categories";
import { fetchListings } from "./listings";
""",
)

op(
    "src/lib/supabase/hotels.ts",
    r"""export const ALL_SECTION_CATEGORIES = [
  "hotel",
  "residence",
  "school",
  "clinic",
  "restaurant",
];
""",
    r"""export const ALL_SECTION_CATEGORIES: string[] = [
  ...NAVIGABLE_CATEGORY_SLUGS,
];
""",
)

# ------------------------------------------------------------- configs.ts
op(
    "src/components/catalog/configs.ts",
    "",
    r"""// ============================================================================
// TROUVETOU — Configurations des portails du catalogue (sections publiques)
//
// Chaque portail (hôtels, écoles, cliniques) est rendu par le composant
// générique `CatalogContent` avec une configuration propre : catégories
// couvertes, textes, libellé de prix, filtres de sous-type.
//
// Les catégories, le libellé de prix et les filtres de sous-type ne sont PAS
// réécrits ici : ils sont dérivés du registre canonique `lib/categories.ts`,
// seul endroit qui décrit ce qu'est une catégorie.
// ============================================================================

import {
  PORTALS,
  portalPriceSuffix,
  portalTypeFilters,
  type UniverseSlug,
} from "@/lib/categories";

export interface CatalogContentConfig {
  /** Identifiant de l'univers (utilisé par la détection d'intention). */
  slug: UniverseSlug;
  /** Slugs de catégories couverts (hotel, residence, clinic, school, restaurant). */
  categories: string[];
  /** Titre principal de la page (H1). */
  title: string;
  /** Libellé affiché dans le fil d'Ariane. */
  breadcrumbLabel: string;
  /** Sous-titre sous le H1 (optionnel). */
  subtitle?: string;
  /** Placeholder de la barre de recherche. */
  searchPlaceholder: string;
  /** Libellé du prix (ex. "par nuit", "par consultation", "par scolarité"). */
  priceSuffix: string;
  /** Filtres de sous-catégorie affichés sous la recherche (facultatif). */
  typeFilters?: string[];
  /** Note affichée en bas de page (source des annonces). */
  footerNote: string;
}

export const HOTELS_CONFIG: CatalogContentConfig = {
  slug: "hotels",
  categories: PORTALS.hotels.categories,
  title: "Hôtels & Résidences Meublées",
  breadcrumbLabel: PORTALS.hotels.label,

  searchPlaceholder: "Rechercher une ville, une résidence, une chambre…",
  priceSuffix: portalPriceSuffix("hotels"),
  typeFilters: portalTypeFilters("hotels"),
  footerNote:
    "Les annonces sont gérées par les établissements via la plateforme Séjoura.",
};

export const ECOLES_CONFIG: CatalogContentConfig = {
  slug: "ecoles",
  categories: PORTALS.ecoles.categories,
  title: "Écoles & Établissements Privés",
  breadcrumbLabel: PORTALS.ecoles.label,

  searchPlaceholder: "Rechercher une école, un niveau, une ville…",
  priceSuffix: portalPriceSuffix("ecoles"),
  typeFilters: portalTypeFilters("ecoles"),
  footerNote:
    "Les annonces sont gérées par les établissements via nos logiciels partenaires.",
};

export const RESTAURANTS_CONFIG: CatalogContentConfig = {
  slug: "restaurants",
  categories: PORTALS.restaurants.categories,
  title: "Restaurants & Gastronomie",
  breadcrumbLabel: PORTALS.restaurants.label,

  searchPlaceholder: "Rechercher un restaurant, une cuisine, une ville…",
  priceSuffix: portalPriceSuffix("restaurants"),
  typeFilters: portalTypeFilters("restaurants"),
  footerNote:
    "Les annonces sont gérées par les établissements partenaires.",
};

export const CLINIQUES_CONFIG: CatalogContentConfig = {
  slug: "cliniques",
  categories: PORTALS.cliniques.categories,
  title: "Cliniques & Santé",
  breadcrumbLabel: PORTALS.cliniques.label,

  searchPlaceholder: "Rechercher une clinique, une spécialité, une ville…",
  priceSuffix: portalPriceSuffix("cliniques"),
  typeFilters: portalTypeFilters("cliniques"),
  footerNote:
    "Les annonces sont gérées par les établissements via nos logiciels partenaires.",
};
""",
)

apply()
