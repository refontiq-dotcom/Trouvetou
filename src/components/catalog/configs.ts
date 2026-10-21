// ============================================================================
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
