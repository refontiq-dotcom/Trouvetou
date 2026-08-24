// ============================================================================
// TROUVETOU — Configurations des portails du catalogue (sections publiques)
//
// Chaque portail (hôtels, écoles, cliniques) est rendu par le composant
// générique `CatalogContent` avec une configuration propre : catégories
// couvertes, textes, libellé de prix, filtres de sous-type.
// ============================================================================

import type { UniverseSlug } from "@/lib/search-intent";

export interface CatalogContentConfig {
  /** Identifiant de l'univers (utilisé par la détection d'intention). */
  slug: UniverseSlug;
  /** Slugs de catégories couverts (voir `categories` : hotel, residence, clinic, school, other). */
  categories: string[];
  /** Titre principal de la page (H1). */
  title: string;
  /** Libellé affiché dans le fil d'Ariane. */
  breadcrumbLabel: string;
  /** Sous-titre sous le H1. */
  subtitle: string;
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
  categories: ["hotel", "residence"],
  title: "Hôtels & Résidences Meublées",
  breadcrumbLabel: "Hôtels & Résidences",
  subtitle:
    "Chambres et appartements publiés en direct par nos établissements partenaires.",
  searchPlaceholder: "Rechercher une ville, une résidence, une chambre…",
  priceSuffix: "par nuit",
  typeFilters: ["hotel", "residence"],
  footerNote:
    "Les annonces sont gérées par les établissements via la plateforme Séjoura.",
};

export const ECOLES_CONFIG: CatalogContentConfig = {
  slug: "ecoles",
  categories: ["school"],
  title: "Écoles & Établissements Privés",
  breadcrumbLabel: "Écoles & Établissements",
  subtitle:
    "Écoles, campus et centres de formation publiés en direct par nos établissements partenaires.",
  searchPlaceholder: "Rechercher une école, un niveau, une ville…",
  priceSuffix: "par scolarité",
  footerNote:
    "Les annonces sont gérées par les établissements via nos logiciels partenaires.",
};

export const RESTAURANTS_CONFIG: CatalogContentConfig = {
  slug: "restaurants",
  categories: ["restaurant"],
  title: "Restaurants & Gastronomie",
  breadcrumbLabel: "Restaurants",
  subtitle:
    "Restaurants, brasseries et bars partenaires : carte, spécialités et ambiance.",
  searchPlaceholder: "Rechercher un restaurant, une cuisine, une ville…",
  priceSuffix: "par plat",
  footerNote:
    "Les annonces sont gérées par les établissements partenaires.",
};

export const CLINIQUES_CONFIG: CatalogContentConfig = {
  slug: "cliniques",
  categories: ["clinic"],
  title: "Cliniques & Santé",
  breadcrumbLabel: "Cliniques & Santé",
  subtitle:
    "Cliniques, cabinets médicaux et centres de santé partenaires vérifiés.",
  searchPlaceholder: "Rechercher une clinique, une spécialité, une ville…",
  priceSuffix: "par consultation",
  footerNote:
    "Les annonces sont gérées par les établissements via nos logiciels partenaires.",
};
