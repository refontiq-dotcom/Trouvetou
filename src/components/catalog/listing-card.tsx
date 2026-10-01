"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, MapPin, Star } from "lucide-react";
import { ListingDetailModal } from "@/components/hotels/listing-detail-modal";
import { useListingActions } from "@/components/hotels/use-listing-actions";
import { formatDistance } from "@/lib/geo";
import { cn, formatFCFA } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

// ============================================================================
// TROUVETOU — Carte d'annonce du catalogue (verticale)
//
// Composition conforme à la maquette, dans cet ordre strict :
//   image → favori (haut droite) → titre → localisation → note → prix suffixé
//
// La carte est volontairement dépouillée : les actions métier (détail, WhatsApp,
// itinéraire, réservation, comparaison, panorama 360°) restent accessibles en
// ouvrant la fiche partagée `ListingDetailModal`, au clic sur la carte.
//
// La notation est OPTIONNELLE et n'est jamais inventée : sans `rating`, aucune
// ligne de note n'est rendue. Le catalogue ne fournit pas ces valeurs à ce
// stade — le modèle de données ne les porte pas encore.
// ============================================================================

interface ListingCardProps {
  room: ListingView;
  /** Libellé du prix pour cette catégorie (« par nuit », « par plat »…). */
  priceSuffix: string;
  /** Note sur 5 — absente tant que la donnée métier n'existe pas. */
  rating?: number;
  /** Nombre d'avis — absent tant que la donnée métier n'existe pas. */
  reviewCount?: number;
}

export function ListingCard({ room, priceSuffix, rating, reviewCount }: ListingCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { coverImage, location, distance, liked, toggleFavorite } = useListingActions(
    room,
    priceSuffix
  );

  const hasRating = typeof rating === "number" && Number.isFinite(rating);

  function openDetail() {
    setSelectedImage(coverImage);
    setDetailOpen(true);
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.35 }}
        className={cn(
          "group relative flex cursor-pointer flex-col overflow-hidden rounded-tt-card bg-tt-card shadow-tt-card ring-1 transition-shadow hover:shadow-tt-pop",
          room.is_boosted ? "ring-lime/60" : "ring-tt-line"
        )}
        onClick={openDetail}
      >
        {/* Image + favori — le bouton intercepte le clic pour ne pas ouvrir la fiche. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <Image
            src={coverImage}
            alt={room.name}
            fill
            sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite();
            }}
            aria-pressed={liked}
            aria-label={
              liked
                ? `Retirer ${room.name} des favoris`
                : `Ajouter ${room.name} aux favoris`
            }
            className={cn(
              "tt-tap absolute right-2 top-2 flex items-center justify-center rounded-full backdrop-blur-sm transition-colors",
              liked ? "bg-rose-500 text-white" : "bg-white/85 text-tt-ink-60 hover:bg-white"
            )}
          >
            <Heart className={cn("h-5 w-5", liked && "fill-current")} aria-hidden="true" />
          </button>
        </div>

        {/* Titre → localisation → note → prix */}
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-tt-ink">
            {room.name}
          </h3>

          {location && (
            <p className="flex items-center gap-1 text-xs text-tt-ink-60">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{location}</span>
              {distance != null && (
                <span className="shrink-0 font-medium text-tt-ink-60">
                  · {formatDistance(distance)}
                </span>
              )}
            </p>
          )}

          {hasRating && (
            <p className="flex items-center gap-1 text-xs font-medium text-tt-ink-60">
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <Star className="h-3.5 w-3.5 fill-lime text-lime" />
              </span>
              <span>{rating}</span>
              {typeof reviewCount === "number" && (
                <span className="text-tt-ink-40">({reviewCount} avis)</span>
              )}
              <span className="sr-only">
                {rating} sur 5
                {typeof reviewCount === "number"
                  ? `, ${reviewCount} avis`
                  : ""}
              </span>
            </p>
          )}

          <p className="mt-auto pt-1 text-sm font-bold text-tt-ink">
            {formatFCFA(room.price ?? 0)}
            <span className="ml-1 text-xs font-normal text-tt-ink-60">
              {priceSuffix}
            </span>
          </p>
        </div>
      </motion.article>

      {detailOpen && (
        <ListingDetailModal
          room={room}
          priceSuffix={priceSuffix}
          selectedImage={selectedImage}
          onSelectImage={setSelectedImage}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}