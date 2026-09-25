// ============================================================================
// TROUVETOU — Configurations des portails du catalogue
// ============================================================================

import type { UniverseSlug } from "@/lib/search-intent";

export interface CatalogContentConfig {
  slug: UniverseSlug;
  categories: string[];
  title: string;
  breadcrumbLabel: string;
  subtitle?: string;
  searchPlaceholder: string;
  priceSuffix: string;
  typeFilters?: string[];
  footerNote: string;
}

export const HOTELS_CONFIG: CatalogContentConfig = {
  slug: "hotels",
  categories: ["hotel", "residence"],
  title: "Hôtels & Résidences Meublées",
  breadcrumbLabel: "Hôtels & Résidences",
  searchPlaceholder: "Rechercher une ville, une résidence, une chambre…",
  priceSuffix: "par nuit",
  typeFilters: ["hotel", "residence"],
  footerNote: "Les annonces sont gérées par les établissements via la plateforme Séjoura.",
};

export const ECOLES_CONFIG: CatalogContentConfig = {
  slug: "ecoles",
  categories: ["school"],
  title: "Écoles & Établissements Privés",
  breadcrumbLabel: "Écoles & Établissements",
  searchPlaceholder: "Rechercher une école, un niveau, une ville…",
  priceSuffix: "par scolarité",
  footerNote: "Les annonces sont gérées par les établissements via nos logiciels partenaires.",
};

export const RESTAURANTS_CONFIG: CatalogContentConfig = {
  slug: "restaurants",
  categories: ["restaurant"],
  title: "Restaurants & Gastronomie",
  breadcrumbLabel: "Restaurants",
  searchPlaceholder: "Rechercher un restaurant, une cuisine, une ville…",
  priceSuffix: "par plat",
  footerNote: "Les annonces sont gérées par les établissements partenaires.",
};

export const CLINIQUES_CONFIG: CatalogContentConfig = {
  slug: "cliniques",
  categories: ["clinic"],
  title: "Cliniques & Santé",
  breadcrumbLabel: "Cliniques & Santé",
  searchPlaceholder: "Rechercher une clinique, une spécialité, une ville…",
  priceSuffix: "par consultation",
  footerNote: "Les annonces sont gérées par les établissements via nos logiciels partenaires.",
};

export const AUTRES_CONFIG: CatalogContentConfig = {
  slug: "autres",
  categories: ["other"],
  title: "Autres annonces",
  breadcrumbLabel: "Autres",
  searchPlaceholder: "Rechercher une annonce ou un service…",
  priceSuffix: "à partir de",
  footerNote: "Les annonces sont gérées par les établissements partenaires.",
};
