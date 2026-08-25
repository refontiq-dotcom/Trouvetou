"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  CircleAlert,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { RoomCard } from "@/components/hotels/room-card";
import { RoomCardSkeletonGrid } from "@/components/hotels/room-card-skeleton";
import { BoostedCarousel } from "@/components/hotels/boosted-carousel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fetchBoostedRooms,
  fetchListedListings,
  sortRooms,
} from "@/lib/supabase/hotels";
import { cn, getCategoryLabel } from "@/lib/utils";
import { detectPortalSuggestion } from "@/lib/search-intent";
import { useLocation } from "@/contexts/location-context";
import { haversineDistance } from "@/lib/geo";
import { VoiceButton } from "@/components/ui/voice-button";
import type { ListingView } from "@/lib/supabase/listing-view";
import type { CatalogContentConfig } from "@/components/catalog/configs";

const PAGE_SIZE = 30;
const MAX_CLIENT_LIMIT = 100;

const BUDGET_OPTIONS = [
  { label: "Tous les budgets", value: 0 },
  { label: "≤ 15 000 F", value: 15000 },
  { label: "≤ 30 000 F", value: 30000 },
  { label: "≤ 50 000 F", value: 50000 },
  { label: "≤ 100 000 F", value: 100000 },
];

const SORT_OPTIONS = [
  { label: "À proximité", value: "distance" },
  { label: "Prix croissant", value: "price_asc" },
  { label: "Prix décroissant", value: "price_desc" },
  { label: "Nom", value: "name" },
];

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface CatalogContentProps {
  config: CatalogContentConfig;
  initialQuery?: string;
}

export function CatalogContent({ config, initialQuery = "" }: CatalogContentProps) {
  const router = useRouter();
  const { location: userLocation } = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [types, setTypes] = useState<string[]>([]);
  const [budget, setBudget] = useState(0);
  const [sort, setSort] = useState<string>(userLocation ? "distance" : "price_asc");

  const [rooms, setRooms] = useState<ListingView[]>([]);
  const [boostedRooms, setBoostedRooms] = useState<ListingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const debounced = useDebouncedValue(query, 350);

  // Détection d'intention : si la recherche appartient manifestement à un autre
  // univers (ex. « résidence » tapé sur /ecoles), on guide l'utilisateur vers
  // le bon portail au lieu d'afficher une page vide.
  const suggestion = useMemo(
    () => detectPortalSuggestion(debounced, config.slug),
    [debounced, config.slug]
  );

  // Quand une suggestion est active, on masque le contenu courant et on
  // affiche le message de bascule de portail.
  const effectiveLoading = suggestion ? false : loading;
  const effectiveError = suggestion ? null : error;
  const effectiveRooms = suggestion ? [] : rooms;

  useEffect(() => {
    if (suggestion) return;
    let cancelled = false;

    fetchBoostedRooms(config.categories)
      .then(({ data }) => {
        if (!cancelled) setBoostedRooms(data);
      })
      .catch(() => {
        if (!cancelled) setBoostedRooms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, config, suggestion]);

  useEffect(() => {
    if (suggestion) return;
    let cancelled = false;

    fetchListedListings({
      search: debounced,
      categorySlugs: types.length > 0 ? types : config.categories,
      maxPrice: budget > 0 ? budget : undefined,
      limit,
    })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setError(null);
          setRooms(sortRooms(data, sort, userLocation));
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, types, budget, sort, reloadKey, limit, config, suggestion, userLocation]);

  function toggleType(type: string) {
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

  function loadMore() {
    setLoading(true);
    setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_CLIENT_LIMIT));
  }

  function retry() {
    setLoading(true);
    setError(null);
    setLimit(PAGE_SIZE);
    setReloadKey((k) => k + 1);
  }

  function handleSwitchPortal() {
    if (!suggestion) return;
    const target = `${suggestion.targetHref}?q=${encodeURIComponent(
      query.trim()
    )}`;
    router.push(target);
  }

  const hasActiveFilters =
    query !== "" || types.length > 0 || budget > 0 || sort !== "price_asc";

  const canLoadMore =
    !effectiveLoading &&
    !effectiveError &&
    effectiveRooms.length >= limit &&
    limit < MAX_CLIENT_LIMIT;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-sm text-muted-foreground">
            Accueil <span className="mx-1">/</span>
            <span className="font-medium text-foreground">
              {config.breadcrumbLabel}
            </span>
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {config.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{config.subtitle}</p>
        </motion.div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setLoading(true);
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder={config.searchPlaceholder}
              className="h-12 pl-12 pr-12"
            />
            <VoiceButton
              onResult={(text) => {
                setLoading(true);
                setQuery(text);
                setLimit(PAGE_SIZE);
              }}
              className="!right-3 !h-9 !w-9"
            />
          </div>

          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={budget}
              onChange={(e) => {
                setLoading(true);
                setBudget(Number(e.target.value));
                setLimit(PAGE_SIZE);
              }}
              className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring"
              aria-label="Filtrer par budget"
            >
              {BUDGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => {
                setLoading(true);
                setSort(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring"
              aria-label="Trier les résultats"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {config.typeFilters && config.typeFilters.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {config.typeFilters.map((type) => {
              const active = types.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                  )}
                >
                  {getCategoryLabel(type)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BoostedCarousel rooms={boostedRooms} priceSuffix={config.priceSuffix} />

      {!suggestion && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {effectiveLoading ? (
              "Chargement des annonces…"
            ) : (
              <>
                <span className="font-semibold text-foreground">
                  {effectiveRooms.length}
                </span>{" "}
                {canLoadMore
                  ? "annonces affichées"
                  : `annonce${effectiveRooms.length > 1 ? "s" : ""} trouvée${
                      effectiveRooms.length > 1 ? "s" : ""
                    }`}
              </>
            )}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      )}

      <div className="mt-6">
        {effectiveLoading ? (
          <RoomCardSkeletonGrid count={6} />
        ) : effectiveError ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-destructive">
              <CircleAlert className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-foreground">
              Impossible de charger les annonces
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {effectiveError}
            </p>
            <Button className="mt-6" onClick={retry}>
              Réessayer
            </Button>
          </div>
        ) : suggestion ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ArrowRightLeft className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-foreground">
              Vous cherchez {suggestion.matchedKeyword} ?
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Votre recherche « {query} » n&apos;a rien donné sur{" "}
              {config.breadcrumbLabel}. {suggestion.matchedKeyword} se trouve
              sur le portail {suggestion.targetLabel}.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSwitchPortal}>
                Voir {suggestion.matchedKeyword} sur {suggestion.targetLabel}
              </Button>
              <Button variant="ghost" onClick={resetFilters}>
                Voir toutes les annonces sur {config.breadcrumbLabel}
              </Button>
            </div>
          </div>
        ) : effectiveRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-foreground">
              Aucune annonce trouvée
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Essayez d&apos;élargir votre recherche ou de réinitialiser les filtres.
            </p>
            <Button className="mt-6" onClick={resetFilters}>
              Voir toutes les annonces
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {effectiveRooms.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                index={i}
                priceSuffix={config.priceSuffix}
              />
            ))}
          </div>
        )}
      </div>

      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={loadMore}>
            Voir plus d&apos;annonces
          </Button>
        </div>
      )}

      {!effectiveLoading &&
        !effectiveError &&
        effectiveRooms.length > 0 && (
          <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            {config.footerNote}
          </p>
        )}
    </div>
  );
}
