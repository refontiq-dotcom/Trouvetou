"use client";

import Link from "next/link";
import { Heart, MapPin, Star } from "lucide-react";
import { useFavorites } from "@/contexts/favorites-context";
import { cn } from "@/lib/utils";

/** Annonce affichée sur l'accueil (données réelles ou cartes de démonstration). */
export interface HomeListing {
  id: string;
  title: string;
  subtitle?: string;
  city?: string;
  /** Note déjà formatée en français, ex. « 4,8 ». */
  ratingLabel?: string;
  /** Prix déjà formaté, ex. « 85 000 FCFA / nuit ». */
  priceLabel?: string;
  image: string;
  href: string;
}

export function ListingCard({ listing }: { listing: HomeListing }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(listing.id);

  return (
    <div className="relative rounded-2xl bg-white p-2 pb-3 shadow-sm ring-1 ring-neutral-200/70 transition-shadow hover:shadow-md">
      {/* Overlay cliquable sous le bouton favori */}
      <Link
        href={listing.href}
        aria-label={listing.title}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className="relative">
        <img
          src={listing.image}
          alt={listing.title}
          className="h-36 w-full rounded-xl object-cover sm:h-44"
        />
        <button
          type="button"
          onClick={() => toggleFavorite(listing.id)}
          aria-pressed={isFav}
          aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition-transform active:scale-90"
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
        <h3 className="text-[15px] font-bold leading-snug text-neutral-900">
          {listing.title}
        </h3>
        {listing.subtitle && (
          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
            {listing.subtitle}
          </p>
        )}
      </div>

      <div className="mt-2 flex min-h-[20px] items-center gap-1 px-1">
        {listing.city && (
          <>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-700" />
            <span className="text-xs font-medium text-neutral-700">
              {listing.city}
            </span>
          </>
        )}
        {listing.ratingLabel && (
          <span className="ml-auto flex items-center gap-1">
            <Star className="h-4 w-4 fill-lime text-lime" />
            <span className="text-xs font-bold text-neutral-900">
              {listing.ratingLabel}
            </span>
          </span>
        )}
      </div>

      {listing.priceLabel && (
        <p className="mt-2 px-1 text-[15px] font-extrabold tracking-tight text-neutral-900">
          {listing.priceLabel}
        </p>
      )}
    </div>
  );
}
