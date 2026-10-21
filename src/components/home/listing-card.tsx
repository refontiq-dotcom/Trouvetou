"use client";

import type { ListingView } from "@/lib/supabase/listing-view";
import { Heart, MapPin } from "lucide-react";
import { useFavorites } from "@/contexts/favorites-context";
import {
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

interface ListingCardProps {
  listing: ListingView;
  /** Ouvre le détail de l'annonce dans le modal partagé. */
  onOpen?: (listing: ListingView) => void;
  /** Position dans la grille (les premières images sont chargées en priorité). */
  index?: number;
}

/**
 * Carte d'annonce de l'accueil.
 *
 * Toute la surface est cliquable et ouvre le modal de détail ; le bouton
 * favori reste indépendant (z-index supérieur). Les informations affichées
 * proviennent uniquement des champs réellement disponibles en base : pas de
 * note inventée, pas de date affichée.
 */
export function ListingCard({ listing, onOpen, index = 0 }: ListingCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(listing.id);
  const image =
    listing.images.find(
      (src) => typeof src === "string" && src.trim().length > 0
    ) ?? PLACEHOLDER_IMAGE;
  const categoryLabel = getCategoryLabel(listing.category_slug);
  const city = listing.establishment.city;
  const hasPrice = listing.price != null && listing.price > 0;

  return (
    <article className="relative rounded-2xl bg-white p-2 pb-3 shadow-sm ring-1 ring-neutral-200/70 transition-shadow hover:shadow-md">
      {/* Surface cliquable : ouvre directement le détail, sans passer par un portail. */}
      <button
        type="button"
        onClick={() => onOpen?.(listing)}
        aria-label={`Voir le détail de ${listing.name}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1769e8] focus-visible:ring-offset-2"
      />

      <div className="relative">
        <img
          src={image}
          alt={listing.name}
          loading={index < 4 ? "eager" : "lazy"}
          className="h-36 w-full rounded-xl object-cover sm:h-44"
        />

        <span
          className={cn(
            "pointer-events-none absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm",
            getCategoryBadgeClass(listing.category_slug)
          )}
        >
          {categoryLabel}
        </span>

        <button
          type="button"
          onClick={() => toggleFavorite(listing.id)}
          aria-pressed={isFav}
          aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition-transform active:scale-90"
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isFav ? "fill-red-500 text-red-500" : "text-neutral-900"
            )}
          />
        </button>
      </div>

      <div className="px-1 pt-2.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[15px] font-bold leading-snug text-neutral-900">
          {listing.name}
        </h3>
        {city && (
          <p className="mt-1 flex items-center gap-1 text-xs text-neutral-600">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{city}</span>
          </p>
        )}
      </div>

      {hasPrice && (
        <p className="mt-2 px-1 text-[15px] font-extrabold tracking-tight text-neutral-900">
          {formatFCFA(listing.price as number)}
          <span className="ml-1 text-[11px] font-medium text-neutral-500">
            {getPriceSuffix(listing.category_slug)}
          </span>
        </p>
      )}
    </article>
  );
}
