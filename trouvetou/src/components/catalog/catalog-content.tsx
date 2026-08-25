"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  CircleAlert,
  Coins,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  MapPin,
  ArrowDownWideNarrow,
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
import { VoiceButton } from "@/components/ui/voice-button";
import { CategoryBanner } from "@/components/catalog/category-banner";
import { FilterDrawer } from "@/components/catalog/filter-drawer";
import type { ListingView } from "@/lib/supabase/listing-view";
import type { CatalogContentConfig } from "@/components/catalog/configs";

const PAGE_SIZE = 30;
const MAX_CLIENT_LIMIT = 100;

const BUDGET_OPTIONS = [
  { label: "Tous", value: 0, icon: Coins, color: "text-muted-foreground" },
  { label: "≤ 15 000", value: 15000, icon: TrendingDown, color: "text-emerald-600" },
  { label: "≤ 30 000", value: 30000, icon: TrendingUp, color: "text-amber-600" },
  { label: "≤ 50 000", value: 50000, icon: Coins, color: "text-orange-600" },
  { label: "≤ 100 000", value: 100000, icon: Coins, color: "text-red-600" },
];

const SORT_OPTIONS = [
  { label: "À proximité", value: "distance", icon: MapPin },
  { label: "Prix ↑", value: "price_asc", icon: TrendingDown },
  { label: "Prix ↓", value: "price_desc", icon: TrendingUp },
  { label: "Récent", value: "name", icon: ArrowDownWideNarrow },
];

/** Catégories avec icônes visuelles */
const CATEGORY_ICONS: Record<string, string> = {
  hotel: "🏨",
  residence: "🏠",
  clinic: "🏥",
  school: "🏫",
  restaurant: "🍽️",
  other: "📋",
};

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

  const suggestion = useMemo(
    () => detectPortalSuggestion(debounced, config.slug),
    [debounced, config.slug]
  );

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

    return () => { cancelled = true; };
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

    return () => { cancelled = true; };
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
    const target = `${suggestion.targetHref}?q=${encodeURIComponent(query.trim())}`;
    router.push(target);
  }

  const hasActiveFilters = query !== "" || types.length > 0 || budget > 0 || sort !== "price_asc";

  const canLoadMore = !effectiveLoading && !effectiveError && effectiveRooms.length >= limit && limit < MAX_CLIENT_LIMIT;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Header — titre seul, pas de sous-titre */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-sm text-muted-foreground">
          Accueil <span className="mx-1">/</span>
          <span className="font-medium text-foreground">{config.breadcrumbLabel}</span>
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {config.title}
        </h1>
      </motion.div>

      {/* Bannière contextuelle catégorie */}
      <div className="mt-4">
        <CategoryBanner categorySlug={config.categories[0] ?? ""} />
      </div>

      {/* Search bar + category toggles + filtre drawer */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setLoading(true); setQuery(e.target.value); setLimit(PAGE_SIZE); }}
            placeholder={config.searchPlaceholder}
            className="h-12 pl-11 pr-12"
          />
          <VoiceButton
            onResult={(text) => { setLoading(true); setQuery(text); setLimit(PAGE_SIZE); }}
            className="!right-2 !h-9 !w-9"
          />
        </div>

        {/* Category toggles + Filtres button — même ligne */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {config.typeFilters && config.typeFilters.length > 0 && (
            <>
              {config.typeFilters.map((type) => {
                const active = types.includes(type);
                const emoji = CATEGORY_ICONS[type] ?? "📋";
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-white text-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <span className="text-base">{emoji}</span>
                    {getCategoryLabel(type)}
                  </button>
                );
              })}
              <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
            </>
          )}

          {/* Filtres drawer trigger */}
          <FilterDrawer
            budgetOptions={BUDGET_OPTIONS}
            sortOptions={SORT_OPTIONS}
            activeBudget={budget}
            activeSort={sort}
            onBudgetChange={(v) => { setLoading(true); setBudget(v); setLimit(PAGE_SIZE); }}
            onSortChange={(v) => { setLoading(true); setSort(v); setLimit(PAGE_SIZE); }}
            onReset={() => { setLoading(true); setBudget(0); setSort("price_asc"); setLimit(PAGE_SIZE); }}
          />
        </div>
      </div>

      {/* Active filter chips — résumé compact */}
      {hasActiveFilters && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {budget > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              💰 ≤ {budget.toLocaleString("fr-FR")} F
              <button onClick={() => { setLoading(true); setBudget(0); setLimit(PAGE_SIZE); }} className="ml-0.5 hover:text-primary/70">×</button>
            </span>
          )}
          {sort !== "price_asc" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              📊 {SORT_OPTIONS.find(o => o.value === sort)?.label}
              <button onClick={() => { setLoading(true); setSort("price_asc"); setLimit(PAGE_SIZE); }} className="ml-0.5 hover:text-primary/70">×</button>
            </span>
          )}
          <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Tout effacer
          </button>
        </div>
      )}

      <BoostedCarousel rooms={boostedRooms} priceSuffix={config.priceSuffix} />

      {/* Results count */}
      {!suggestion && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {effectiveLoading ? (
              "Chargement…"
            ) : (
              <>
                <span className="font-semibold text-foreground">{effectiveRooms.length}</span>
                {" "}
                {canLoadMore
                  ? "annonces affichées"
                  : `annonce${effectiveRooms.length !== 1 ? "s" : ""} trouvée${effectiveRooms.length !== 1 ? "s" : ""}`}
              </>
            )}
          </p>
        </div>
      )}

      {/* Results */}
      <div className="mt-4">
        {effectiveLoading ? (
          <RoomCardSkeletonGrid count={6} />
        ) : effectiveError ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-destructive">
              <CircleAlert className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              📡 Problème de connexion
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Impossible de charger les annonces. Vérifiez votre connexion et réessayez.
            </p>
            <div className="mt-5 flex gap-3">
              <Button onClick={retry}>🔄 Réessayer</Button>
              {hasActiveFilters && (
                <Button variant="outline" onClick={resetFilters}>✕ Effacer les filtres</Button>
              )}
            </div>
          </div>
        ) : suggestion ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ArrowRightLeft className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Vous cherchez {suggestion.matchedKeyword} ?
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              « {query} » n&apos;a rien donné ici. Essayez sur {suggestion.targetLabel}.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleSwitchPortal}>→ Voir sur {suggestion.targetLabel}</Button>
              <Button variant="ghost" onClick={resetFilters}>Voir tout ici</Button>
            </div>
          </div>
        ) : effectiveRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              🔍 Aucune annonce trouvée
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {budget > 0
                ? "Aucune annonce dans cette plage de prix. Essayez un budget plus élevé."
                : types.length > 0
                ? "Aucune annonce dans cette catégorie."
                : "Aucune annonce ne correspond à votre recherche."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={resetFilters}>🔄 Tout afficher</Button>
              {budget > 0 && (
                <Button variant="outline" onClick={() => { setLoading(true); setBudget(0); setLimit(PAGE_SIZE); }}>
                  💰 Supprimer le budget
                </Button>
              )}
            </div>
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

      {!effectiveLoading && !effectiveError && effectiveRooms.length > 0 && (
        <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent" />
          {config.footerNote}
        </p>
      )}
    </div>
  );
}
