# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import op, op_all, apply

# ------------------------------------------------------------ listing-card.tsx
op(
    "src/components/home/listing-card.tsx",
    r"""import {
  formatFCFA,
  getCategoryLabel,
  getPriceSuffix,
  PLACEHOLDER_IMAGE,
  cn,
} from "@/lib/utils";
export type { ListingView } from "@/lib/supabase/listing-view";

/** Couleur du badge de catégorie, cohérente avec les portails. */
const CATEGORY_BADGES: Record<string, string> = {
  hotel: "bg-[#f5a400]",
  residence: "bg-[#f5a400]",
  school: "bg-[#1769e8]",
  clinic: "bg-[#0ea5e9]",
  restaurant: "bg-[#f97316]",
};
""",
    r"""import {
  formatFCFA,
  PLACEHOLDER_IMAGE,
  cn,
} from "@/lib/utils";
import {
  getCategoryBadgeClass,
  getCategoryLabel,
  getPriceSuffix,
} from "@/lib/categories";
export type { ListingView } from "@/lib/supabase/listing-view";
""",
)

op(
    "src/components/home/listing-card.tsx",
    r"""            CATEGORY_BADGES[listing.category_slug] ?? "bg-neutral-800"
""",
    r"""            getCategoryBadgeClass(listing.category_slug)
""",
)

# --------------------------------------------------------------- room-card.tsx
op(
    "src/components/hotels/room-card.tsx",
    r"""import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  getCategoryLabel,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
""",
    r"""import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import {
  categorySearchHref,
  getCategoryBadgeClass,
  getCategoryLabel,
} from "@/lib/categories";
""",
)

op(
    "src/components/hotels/room-card.tsx",
    r"""/** Couleurs par catégorie pour les badges */
const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  clinic: { bg: "bg-[#0ea5e9]", text: "text-[#0284c7]", ring: "ring-sky-500/20" },
  school: { bg: "bg-[#1769e8]", text: "text-[#1769e8]", ring: "ring-[#1769e8]/20" },
  restaurant: { bg: "bg-[#f97316]", text: "text-orange-600", ring: "ring-orange-500/20" },
  hotel: { bg: "bg-[#f5a400]", text: "text-[#d97706]", ring: "ring-[#f5a400]/20" },
  residence: { bg: "bg-[#f5a400]", text: "text-[#d97706]", ring: "ring-[#f5a400]/20" },
};

""",
    "",
)

op(
    "src/components/hotels/room-card.tsx",
    r"""  const catSlug = resolveCategorySlug(room);
  const catColor = CATEGORY_COLORS[catSlug] ?? CATEGORY_COLORS.hotel;
""",
    r"""  const catSlug = resolveCategorySlug(room);
""",
)

op(
    "src/components/hotels/room-card.tsx",
    r"""            catColor.bg
""",
    r"""            getCategoryBadgeClass(catSlug)
""",
)

op(
    "src/components/hotels/room-card.tsx",
    r"""  const listingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${catSlug === "school" ? "ecoles" : catSlug === "clinic" ? "cliniques" : catSlug === "restaurant" ? "restaurants" : "hotels"}?q=${encodeURIComponent(room.name)}`
      : "";
""",
    r"""  // Lien de partage : il mène à la catégorie exacte de l'annonce (et non au
  // portail entier), grâce au registre canonique des catégories.
  const listingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${categorySearchHref(catSlug, room.name)}`
      : "";
""",
)

# --------------------------------------------------- listing-detail-modal.tsx
op(
    "src/components/listings/listing-detail-modal.tsx",
    r"""import { PORTAL_BY_SLUG } from "@/lib/home-categories";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  getCategoryLabel,
  getPriceSuffix,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
""",
    r"""import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import {
  categorySearchHref,
  getCategoryChipClass,
  getCategoryLabel,
  getPriceSuffix,
} from "@/lib/categories";
""",
)

op(
    "src/components/listings/listing-detail-modal.tsx",
    r"""const CATEGORY_CHIPS: Record<string, string> = {
  hotel: "bg-amber-100 text-amber-700",
  residence: "bg-violet-100 text-violet-700",
  school: "bg-blue-100 text-blue-700",
  clinic: "bg-sky-100 text-sky-700",
  restaurant: "bg-orange-100 text-orange-700",
};

""",
    "",
)

op(
    "src/components/listings/listing-detail-modal.tsx",
    r"""                  CATEGORY_CHIPS[categorySlug] ?? "bg-neutral-100 text-neutral-700"
""",
    r"""                  getCategoryChipClass(categorySlug)
""",
)

op(
    "src/components/listings/listing-detail-modal.tsx",
    r"""  const listingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${PORTAL_BY_SLUG[categorySlug] ?? "/hotels"}?q=${encodeURIComponent(room.name)}`
      : "";
""",
    r"""  // Lien de partage : il mène à la catégorie exacte de l'annonce.
  const listingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${categorySearchHref(categorySlug, room.name)}`
      : "";
""",
)

# --------------------------------------------------------- catalog-content.tsx
op(
    "src/components/catalog/catalog-content.tsx",
    r"""import { useRouter } from "next/navigation";
""",
    r"""import { usePathname, useRouter } from "next/navigation";
""",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""import { cn, getCategoryLabel } from "@/lib/utils";
""",
    r"""import { cn } from "@/lib/utils";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/categories";
""",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""/** Catégories avec icônes visuelles */
const CATEGORY_ICONS: Record<string, string> = {
  hotel: "🏨",
  residence: "🏠",
  clinic: "🏥",
  school: "🏫",
  restaurant: "🍽️",
  other: "📋",
};

""",
    "",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""interface CatalogContentProps {
  config: CatalogContentConfig;
  initialQuery?: string;
}

export function CatalogContent({ config, initialQuery = "" }: CatalogContentProps) {
  const router = useRouter();
  const { location: userLocation } = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [types, setTypes] = useState<string[]>([]);
""",
    r"""interface CatalogContentProps {
  config: CatalogContentConfig;
  initialQuery?: string;
  /**
   * Catégorie(s) pré-sélectionnée(s) via `?type=` (ex. « residence »).
   *
   * Ce paramètre existait déjà dans l'URL des portails mais n'était jamais lu :
   * impossible d'arriver sur une catégorie précise. Il est désormais appliqué
   * au chargement, et réécrit à chaque changement de filtre.
   */
  initialType?: string;
}

/** Convertit `?type=hotel,residence` en une liste de catégories valides. */
function parseTypes(raw: string | undefined, allowed: string[]): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0 && allowed.includes(value));
}

export function CatalogContent({
  config,
  initialQuery = "",
  initialType,
}: CatalogContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { location: userLocation } = useLocation();
  const [query, setQuery] = useState(initialQuery);

  // Catégories issues de l'URL : la page se charge déjà filtrée.
  const initialTypes = useMemo(
    () => parseTypes(initialType, config.categories),
    [initialType, config.categories]
  );
  const initialTypesKey = initialTypes.join(",");
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [appliedTypesKey, setAppliedTypesKey] = useState(initialTypesKey);

  // L'URL fait foi : lien partagé, navigation arrière ou changement de page
  // rechargent le filtre (et non l'inverse).
  if (appliedTypesKey !== initialTypesKey) {
    setAppliedTypesKey(initialTypesKey);
    setTypes(initialTypes);
  }
""",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""  function toggleType(type: string) {
    setLoading(true);
    setLimit(PAGE_SIZE);
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function resetFilters() {
    setLoading(true);
    setQuery("");
    setTypes([]);
    setBudget(0);
    setSort("price_asc");
    setLimit(PAGE_SIZE);
  }
""",
    r"""  /**
   * Reflète le filtre de catégorie dans l'URL (`?type=`), pour que la page
   * soit partageable et que le bouton « retour » retrouve le bon filtre.
   */
  function syncTypeParam(nextTypes: string[], nextQuery: string) {
    const params = new URLSearchParams(window.location.search);
    const trimmed = nextQuery.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    if (nextTypes.length > 0) {
      params.set("type", nextTypes.join(","));
    } else {
      params.delete("type");
    }
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function toggleType(type: string) {
    setLoading(true);
    setLimit(PAGE_SIZE);
    const next = types.includes(type)
      ? types.filter((t) => t !== type)
      : [...types, type];
    setTypes(next);
    syncTypeParam(next, query);
  }

  function resetFilters() {
    setLoading(true);
    setQuery("");
    setTypes([]);
    setBudget(0);
    setSort("price_asc");
    setLimit(PAGE_SIZE);
    syncTypeParam([], "");
  }
""",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""                const emoji = CATEGORY_ICONS[type] ?? "📋";
""",
    r"""                const emoji = getCategoryEmoji(type);
""",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""          {budget > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
""",
    r"""          {types.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {getCategoryEmoji(type)} {getCategoryLabel(type)}
              <button
                onClick={() => toggleType(type)}
                className="ml-0.5 hover:text-primary/70"
                aria-label={`Retirer le filtre ${getCategoryLabel(type)}`}
              >
                ×
              </button>
            </span>
          ))}
          {budget > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
""",
)

# ----------------------------------------------------------- home-sidebar.tsx
op(
    "src/components/home/home-sidebar.tsx",
    "",
    r""""use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  categoryHref,
  getCategory,
  type HomeCategoryItem,
} from "@/lib/categories";

interface HomeSidebarProps {
  /** Catégories affichées (libellés et compteurs issus du registre). */
  categories: HomeCategoryItem[];
}

/**
 * Barre latérale de l'accueil desktop : navigation par catégorie.
 *
 * Chaque entrée est un lien vers la page de sa catégorie : cliquer sur
 * « Résidences » ouvre le portail filtré sur les résidences, et non le
 * portail entier où hôtels et résidences sont mélangés.
 */
export function HomeSidebar({ categories }: HomeSidebarProps) {
  return (
    <nav
      aria-label="Catégories"
      className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
    >
      <h2 className="px-2 pb-2 pt-1 text-sm font-bold text-neutral-900">
        Explorer
      </h2>

      <ul className="space-y-1">
        {categories.map((category) => {
          const definition = getCategory(category.slug);
          const Icon = definition?.icon;

          return (
            <li key={category.slug}>
              <Link
                href={categoryHref(category.slug)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
                  "text-neutral-800 hover:bg-neutral-100"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    definition?.chipBg ?? "bg-neutral-100"
                  )}
                >
                  {Icon ? (
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        definition?.chipText ?? "text-neutral-700"
                      )}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {category.label}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-neutral-500">
                  {category.count}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="px-2 pb-1 pt-3 text-[11px] leading-relaxed text-neutral-500">
        Ouvrez une catégorie pour voir toutes ses annonces.
      </p>
    </nav>
  );
}
""",
)

# ----------------------------------------------------------- category-menu.tsx
op(
    "src/components/home/category-menu.tsx",
    r"""import { categoryMeta, type HomeCategoryItem } from "@/lib/home-categories";
import { cn } from "@/lib/utils";
""",
    r"""import {
  categoryHref,
  getCategory,
  type HomeCategoryItem,
} from "@/lib/categories";
import { cn } from "@/lib/utils";
""",
)

op(
    "src/components/home/category-menu.tsx",
    r"""              {categories.map((category, i) => {
                const meta = categoryMeta(category.slug);
                const Icon = meta.icon;
                return (
""",
    r"""              {categories.map((category, i) => {
                const definition = getCategory(category.slug);
                const Icon = definition?.icon;
                return (
""",
)

op(
    "src/components/home/category-menu.tsx",
    r"""                    <Link
                      href={meta.href}
                      onClick={close}
""",
    r"""                    <Link
                      href={categoryHref(category.slug)}
                      onClick={close}
""",
)

op(
    "src/components/home/category-menu.tsx",
    r"""                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          meta.chipBg
                        )}
                      >
                        <Icon className={cn("h-4 w-4", meta.chipText)} />
                      </span>
""",
    r"""                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          definition?.chipBg ?? "bg-neutral-100"
                        )}
                      >
                        {Icon ? (
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              definition?.chipText ?? "text-neutral-700"
                            )}
                          />
                        ) : null}
                      </span>
""",
)

# -------------------------------------------------------------- home-screen.tsx
op(
    "src/components/home/home-screen.tsx",
    r"""import { useEffect, useMemo, useState, type FormEvent } from "react";
""",
    r"""import { useEffect, useState, type FormEvent } from "react";
""",
)

op(
    "src/components/home/home-screen.tsx",
    r"""import type { HomeCategoryItem } from "@/lib/home-categories";
""",
    r"""import type { HomeCategoryItem } from "@/lib/categories";
""",
)

op(
    "src/components/home/home-screen.tsx",
    r"""  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
""",
    r"""  const [pickerOpen, setPickerOpen] = useState(false);
""",
)

op(
    "src/components/home/home-screen.tsx",
    r"""  // Liste dérivée : la catégorie sélectionnée filtre les annonces reçues du
  // serveur, sans état dupliqué ni rendu en cascade.
  const filteredListings = useMemo(
    () =>
      selectedCategory === null
        ? listings
        : listings.filter(
            (listing) => listing.category_slug === selectedCategory
          ),
    [listings, selectedCategory]
  );

""",
    "",
)

op(
    "src/components/home/home-screen.tsx",
    r"""              <HomeSidebar
                selectedCategory={selectedCategory}
                onCategorySelect={setSelectedCategory}
                nearbyCount={nearbyCount}
              />
""",
    r"""              <HomeSidebar categories={categories} />
""",
)

op_all(
    "src/components/home/home-screen.tsx",
    r"""                {filteredListings.length === 0 && <EmptyCatalog />}
                {filteredListings.map((listing, index) => (
""",
    r"""                {listings.length === 0 && <EmptyCatalog />}
                {listings.map((listing, index) => (
""",
)

# ---------------------------------------------------------- alert-subscribe.tsx
op(
    "src/components/alerts/alert-subscribe.tsx",
    r"""import { Bell, Check, Loader2 } from "lucide-react";

const CATEGORIES = [
  { slug: "clinic", label: "Cliniques" },
  { slug: "school", label: "Écoles" },
  { slug: "hotel", label: "Hôtels" },
  { slug: "residence", label: "Résidences" },
  { slug: "restaurant", label: "Restaurants" },
];
""",
    r"""import { Bell, Check, Loader2 } from "lucide-react";
import { CATEGORIES, NAVIGABLE_CATEGORY_SLUGS } from "@/lib/categories";

/** Catégories proposées à l'abonnement (libellés issus du registre). */
const ALERT_CATEGORIES = NAVIGABLE_CATEGORY_SLUGS.map((slug) => ({
  slug,
  label: CATEGORIES[slug].plural,
}));
""",
)

op(
    "src/components/alerts/alert-subscribe.tsx",
    r"""                      {CATEGORIES.map((c) => (
""",
    r"""                      {ALERT_CATEGORIES.map((c) => (
""",
)

# ------------------------------------------------------------------ footer.tsx
op(
    "src/components/layout/footer.tsx",
    r"""import { MapPin, Mail } from "lucide-react";

const CATEGORIES = [
  { href: "/hotels", label: "Hôtels & Résidences meublées" },
  { href: "/ecoles", label: "Écoles & Établissements privés" },
  { href: "/cliniques", label: "Cliniques & Santé" },
  { href: "/restaurants", label: "Restaurants & Gastronomie" },
];

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/hotels", label: "Hôtels & Résidences" },
  { href: "/ecoles", label: "Écoles & Établissements" },
  { href: "/cliniques", label: "Cliniques & Santé" },
  { href: "/restaurants", label: "Restaurants" },
];
""",
    r"""import { MapPin, Mail } from "lucide-react";
import { PORTALS } from "@/lib/categories";

/** Univers : une entrée par portail (libellés issus du registre). */
const CATEGORIES = Object.values(PORTALS).map((portal) => ({
  href: portal.path,
  label: portal.label,
}));

/** Navigation applicative (les univers sont déjà listés ci-dessus). */
const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/favoris", label: "Mes favoris" },
  { href: "/compare", label: "Comparateur" },
  { href: "/profil", label: "Mon espace" },
];
""",
)

# ------------------------------------------------------------------ header.tsx
op(
    "src/components/layout/header.tsx",
    r"""import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/hotels", label: "Hôtels" },
  { href: "/ecoles", label: "Écoles" },
  { href: "/cliniques", label: "Cliniques" },
  { href: "/restaurants", label: "Restaurants" },
];
""",
    r"""import { Logo } from "@/components/logo";
import { PORTALS } from "@/lib/categories";

/** Navigation principale : un lien par univers (libellés du registre). */
const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  ...Object.values(PORTALS).map((portal) => ({
    href: portal.path,
    label: portal.shortLabel,
  })),
];
""",
)

apply()
