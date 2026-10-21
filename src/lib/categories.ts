import type { LucideIcon } from "lucide-react";
import {
  Building2,
  GraduationCap,
  LayoutGrid,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";

// ============================================================================
// TROUVETOU — Registre canonique des catégories
//
// SOURCE DE VÉRITÉ UNIQUE. Avant, chaque page réécrivait sa propre table de
// catégories : 15 fichiers divergaient (libellés, chemins de portail, prix,
// couleurs, icônes). « Résidences » / « Résidences meublées » coexistaient,
// la catégorie `other` existait en base mais dans aucun menu, et la catégorie
// `hotel` comme `residence` menaient au même portail sans distinction.
//
// Tout ce qui concerne une catégorie passe désormais par ce fichier :
// libellé, portail de destination, filtre `?type=`, libellé de prix,
// réservabilité, couleurs, icône. Les autres fichiers n'en conservent qu'une
// copie — jamais une redéfinition.
//
// Règle de navigation : une catégorie pointe vers la page de son univers.
// Lorsqu'un portail couvre plusieurs catégories (hôtels ET résidences), il
// ajoute `?type=<slug>` pour que la page se filtre sur la catégorie exacte.
// ============================================================================

/** Slugs de catégories supportés par l'application (table `categories`). */
export const CATEGORY_SLUGS = [
  "hotel",
  "residence",
  "school",
  "clinic",
  "restaurant",
  "other",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

/** Univers (portails) de l'application. */
export const PORTAL_SLUGS = [
  "hotels",
  "ecoles",
  "cliniques",
  "restaurants",
] as const;

export type UniverseSlug = (typeof PORTAL_SLUGS)[number];

export interface CategoryDefinition {
  /** Slug technique (clé de la table `categories`). */
  slug: CategorySlug;
  /** Libellé singulier (badges, puces de filtre). */
  label: string;
  /** Libellé pluriel (menus, alertes, pied de page). */
  plural: string;
  /** Univers de destination ; `null` si la catégorie n'a pas de page propre. */
  portal: UniverseSlug | null;
  /** Emoji utilisé par les filtres du catalogue. */
  emoji: string;
  /** Libellé de prix (« par nuit », « par consultation »…). */
  priceSuffix: string;
  /** La réservation en ligne a-t-elle un sens pour cette catégorie ? */
  bookable: boolean;
  /** Pastille de catégorie : fond. */
  chipBg: string;
  /** Pastille de catégorie : texte. */
  chipText: string;
  /** Badge catégorie affiché sur les cartes d'annonces. */
  badgeBg: string;
  /** Icône de navigation. */
  icon: LucideIcon;
}

/** Définition d'une catégorie. */
export const CATEGORIES: Record<CategorySlug, CategoryDefinition> = {
  hotel: {
    slug: "hotel",
    label: "Hôtel",
    plural: "Hôtels",
    portal: "hotels",
    emoji: "🏨",
    priceSuffix: "par nuit",
    bookable: true,
    chipBg: "bg-amber-100",
    chipText: "text-amber-700",
    badgeBg: "bg-[#f5a400]",
    icon: Building2,
  },
  residence: {
    slug: "residence",
    label: "Résidence",
    plural: "Résidences",
    portal: "hotels",
    emoji: "🏠",
    priceSuffix: "par nuit",
    bookable: true,
    chipBg: "bg-violet-100",
    chipText: "text-violet-700",
    badgeBg: "bg-[#f5a400]",
    icon: Building2,
  },
  school: {
    slug: "school",
    label: "École",
    plural: "Écoles",
    portal: "ecoles",
    emoji: "🏫",
    priceSuffix: "par scolarité",
    bookable: false,
    chipBg: "bg-blue-100",
    chipText: "text-blue-700",
    badgeBg: "bg-[#1769e8]",
    icon: GraduationCap,
  },
  clinic: {
    slug: "clinic",
    label: "Clinique",
    plural: "Cliniques",
    portal: "cliniques",
    emoji: "🏥",
    priceSuffix: "par consultation",
    bookable: false,
    chipBg: "bg-sky-100",
    chipText: "text-sky-700",
    badgeBg: "bg-[#0ea5e9]",
    icon: Stethoscope,
  },
  restaurant: {
    slug: "restaurant",
    label: "Restaurant",
    plural: "Restaurants",
    portal: "restaurants",
    emoji: "🍽️",
    priceSuffix: "par plat",
    bookable: false,
    chipBg: "bg-orange-100",
    chipText: "text-orange-700",
    badgeBg: "bg-[#f97316]",
    icon: UtensilsCrossed,
  },
  other: {
    slug: "other",
    label: "Établissement",
    plural: "Établissements",
    // Pas de portail : catégorie fourre-tout, jamais proposée à la navigation.
    portal: null,
    emoji: "📋",
    priceSuffix: "sur demande",
    bookable: false,
    chipBg: "bg-neutral-100",
    chipText: "text-neutral-700",
    badgeBg: "bg-neutral-800",
    icon: LayoutGrid,
  },
};

export interface PortalDefinition {
  slug: UniverseSlug;
  /** Chemin de la page publique. */
  path: string;
  /** Libellé complet (fil d'Ariane, pied de page, détection d'intention). */
  label: string;
  /** Libellé court (barre de navigation). */
  shortLabel: string;
  /** Catégories couvertes par la page. */
  categories: CategorySlug[];
}

/** Univers (pages publiques) et catégories qu'elles couvrent. */
export const PORTALS: Record<UniverseSlug, PortalDefinition> = {
  hotels: {
    slug: "hotels",
    path: "/hotels",
    label: "Hôtels & Résidences",
    shortLabel: "Hôtels",
    categories: ["hotel", "residence"],
  },
  ecoles: {
    slug: "ecoles",
    path: "/ecoles",
    label: "Écoles & Établissements",
    shortLabel: "Écoles",
    categories: ["school"],
  },
  cliniques: {
    slug: "cliniques",
    path: "/cliniques",
    label: "Cliniques & Santé",
    shortLabel: "Cliniques",
    categories: ["clinic"],
  },
  restaurants: {
    slug: "restaurants",
    path: "/restaurants",
    label: "Restaurants",
    shortLabel: "Restaurants",
    categories: ["restaurant"],
  },
};

/**
 * Filtres de catégorie d'un portail.
 *
 * Un portail qui ne couvre qu'une catégorie (écoles, cliniques, restaurants)
 * n'affiche pas de filtre : la page EST déjà la page de la catégorie. Un
 * portail multi-catégories (hôtels / résidences) affiche une puce par
 * catégorie, et `?type=` permet d'y arriver directement.
 */
export function portalTypeFilters(portal: UniverseSlug): string[] | undefined {
  const categories = PORTALS[portal].categories;
  return categories.length > 1 ? [...categories] : undefined;
}

/**
 * Libellé de prix d'un portail.
 *
 * Dérivé de ses catégories (et non redéfini) : les annonces d'un même portail
 * sont toujours facturées de la même façon.
 */
export function portalPriceSuffix(portal: UniverseSlug): string {
  const [first] = PORTALS[portal].categories;
  return first ? CATEGORIES[first].priceSuffix : "par nuit";
}

/** Catégories possédant un portail : seules celles-ci sont navigables. */
export const NAVIGABLE_CATEGORY_SLUGS: CategorySlug[] = CATEGORY_SLUGS.filter(
  (slug) => CATEGORIES[slug].portal !== null
);

/** Catégories réservables en ligne (hôtellerie : prix par nuit). */
export const BOOKABLE_CATEGORY_SLUGS: CategorySlug[] = CATEGORY_SLUGS.filter(
  (slug) => CATEGORIES[slug].bookable
);

/** Définition d'une catégorie, ou `null` si le slug est inconnu. */
export function getCategory(
  slug: string | null | undefined
): CategoryDefinition | null {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  return (
    (CATEGORIES as Record<string, CategoryDefinition>)[normalized] ?? null
  );
}

/** Libellé singulier d'une catégorie (« Hôtel », « Résidence »…). */
export function getCategoryLabel(slug: string | null | undefined): string {
  const definition = getCategory(slug);
  if (definition) return definition.label;
  return slug ? slug : "Établissement";
}

/** Libellé pluriel d'une catégorie (« Hôtels », « Résidences »…). */
export function getCategoryPluralLabel(
  slug: string | null | undefined
): string {
  const definition = getCategory(slug);
  if (definition) return definition.plural;
  return slug ? slug : "Établissements";
}

/**
 * Libellé de prix d'une annonce, selon sa catégorie.
 * Utilisé quand une carte est affichée hors de son portail dédié
 * (ex. page Favoris qui mélange toutes les catégories).
 */
export function getPriceSuffix(slug: string | null | undefined): string {
  return getCategory(slug)?.priceSuffix ?? "par nuit";
}

/** Une catégorie donne-t-elle droit à la réservation en ligne ? */
export function isBookableCategory(slug: string | null | undefined): boolean {
  const definition = getCategory(slug);
  return definition ? definition.bookable : false;
}

/** Classes Tailwind de la pastille de catégorie. */
export function getCategoryChipClass(slug: string | null | undefined): string {
  const definition = getCategory(slug);
  if (!definition) return "bg-neutral-100 text-neutral-700";
  return `${definition.chipBg} ${definition.chipText}`;
}

/** Classe Tailwind du badge de catégorie (cartes d'annonces). */
export function getCategoryBadgeClass(slug: string | null | undefined): string {
  return getCategory(slug)?.badgeBg ?? "bg-neutral-800";
}

/** Emoji d'une catégorie (filtres du catalogue). */
export function getCategoryEmoji(slug: string | null | undefined): string {
  return getCategory(slug)?.emoji ?? "📋";
}

/** Chemin du portail d'une catégorie (`/` si elle n'a pas de portail). */
export function getCategoryPortalPath(
  slug: string | null | undefined
): string {
  const definition = getCategory(slug);
  if (!definition || !definition.portal) return "/";
  return PORTALS[definition.portal].path;
}

/**
 * URL de la page d'une catégorie.
 *
 * Un portail qui ne couvre qu'une catégorie (écoles, cliniques, restaurants)
 * est atteint directement. Un portail multi-catégories (hôtels / résidences)
 * reçoit `?type=<slug>` : c'est ce paramètre que `CatalogContent` applique
 * pour filtrer la liste. C'est ce qui rend « Hôtels » et « Résidences »
 * réellement distincts d'un clic à l'autre.
 */
export function categoryHref(slug: string | null | undefined): string {
  const definition = getCategory(slug);
  if (!definition || !definition.portal) return "/";
  const portal = PORTALS[definition.portal];
  return portal.categories.length > 1
    ? `${portal.path}?type=${definition.slug}`
    : portal.path;
}

/**
 * URL de partage d'une annonce : portail + catégorie + recherche.
 * Le lien WhatsApp mène donc droit à la bonne catégorie, pas au portail
 * entier où l'annonce se noierait.
 */
export function categorySearchHref(
  slug: string | null | undefined,
  query?: string | null
): string {
  const definition = getCategory(slug);
  const portal = definition?.portal ? PORTALS[definition.portal] : null;
  const path = portal?.path ?? "/hotels";

  const params = new URLSearchParams();
  if (portal && portal.categories.length > 1 && definition) {
    params.set("type", definition.slug);
  }
  if (query && query.trim().length > 0) {
    params.set("q", query.trim());
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Catégorie affichée dans les menus de l'accueil. */
export interface HomeCategoryItem {
  /** Slug de la catégorie (`categories.slug`). */
  slug: string;
  /** Libellé affiché. */
  label: string;
  /** Nombre d'annonces disponibles. */
  count: number;
}

/**
 * Catégories de repli affichées quand la base n'est pas configurée.
 *
 * Les compteurs restent à 0 : un nombre inventé donnerait l'illusion d'un
 * catalogue peuplé alors que la base est injoignable.
 */
export const FALLBACK_CATEGORIES: HomeCategoryItem[] = NAVIGABLE_CATEGORY_SLUGS.map(
  (slug) => ({ slug, label: CATEGORIES[slug].plural, count: 0 })
);
