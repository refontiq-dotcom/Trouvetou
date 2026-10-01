"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, MapPin, MessageCircle, Navigation, Phone, Wallet } from "lucide-react";
import { ListingDetailModal } from "@/components/hotels/listing-detail-modal";
import { useListingActions } from "@/components/hotels/use-listing-actions";
import { useCompare } from "@/contexts/compare-context";
import { formatDistance } from "@/lib/geo";
import { cn, formatFCFA, getAmenitiesInfo, getCategoryLabel } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

// Phase 6C — RoomCard.
//
// Le catalogue affiche désormais la MÊME annonce via `ListingCard`, déjà
// intégralement passé aux tokens `tt-*` (cf. `catalog/listing-card.tsx`).
// RoomCard sert la page Favoris ; aligner sa structure sur `tt-*` évite que la
// même annonce n'ait deux rendus selon la page qui l'affiche.
//
// MIGRÉES — valeur identique, aucun changement visuel :
//   --card #ffffff          -> --tt-card #ffffff      (bg-card)
//   --border #e7eaec        -> --tt-line #e7eaec      (border-border)
//   --foreground #171c22    -> --tt-ink  #171c22      (text-foreground)
//   --muted-foreground      -> --tt-ink-60 #66717c    (texte secondaire)
//   --primary #171c22       -> --tt-ink  #171c22      (boutons d'action)
//
// MIGRÉE — rôle identique, écart imperceptible :
//   bg-slate-50  #f8fafc -> bg-tt-surface #f7f8f8 (fond de pastille, 2/255)
//   text-slate-500 #64748b -> text-tt-ink-60 #66717c (icône décorative, 4/255)
//   text-slate-400 #94a3b8 -> text-tt-ink-40 #8b949e (icône décorative — le
//     token est explicitement réservé à cet usage ; le libellé porte le sens)
//
// CONSERVÉES — fonctionnelles, aucun équivalent tt-* (palette = encre/gris/lime) :
//   CATEGORY_COLORS : identité de catégorie (clinique/école/restaurant/hôtel).
//     Aucune couleur bleue, orange ou ambre n'existe dans la marque : à
//     conserver tant qu'un token de catégorie n'est pas arbitré par le
//     propriétaire. Besoin signalé, AUCUN token créé.
//   #25D366 (vert WhatsApp) : couleur de marque du canal de contact.
//   red-500/90 (état favori) : état, pas décoration.
//   black/30 / black/50 : voile assurant le contraste des boutons sur photo.
//   accent (lime) : badge « Lime » et surbrillance annonce boostée.
//   border-slate-100 #f1f5f9 : séparateur très clair. `--tt-line` #e7eaec est
//     nettement plus foncé et le rendrait visible : conservé et signalé.
//   text-slate-600 #475569 : libellés de 9 px. `--tt-ink-60` ne monte qu'à
//     4,98:1 contre 7,6:1 ici : le contraste plus faible n'est pas accepté sur
//     du texte de cette taille. Conservés et signalés.
//   to-lime-300 #bef264 : aucun token ne correspond (la marque est #c6f02d).
//
// Logique métier INCHANGÉE : favori, comparaison, réservation, WhatsApp,
// itinéraire, prix, distance, chargement et erreurs ne sont pas touchés.

/** Couleurs par catégorie pour les badges */
const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  clinic: { bg: "bg-[#0ea5e9]", text: "text-[#0284c7]", ring: "ring-sky-500/20" },
  school: { bg: "bg-[#1769e8]", text: "text-[#1769e8]", ring: "ring-[#1769e8]/20" },
  restaurant: { bg: "bg-[#f97316]", text: "text-orange-600", ring: "ring-orange-500/20" },
  hotel: { bg: "bg-[#f5a400]", text: "text-[#d97706]", ring: "ring-[#f5a400]/20" },
  residence: { bg: "bg-[#f5a400]", text: "text-[#d97706]", ring: "ring-[#f5a400]/20" },
};

interface RoomCardProps {
  room: ListingView;
  index?: number;
  priceSuffix?: string;
}

export function RoomCard({ room, index = 0, priceSuffix = "par nuit" }: RoomCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { toggleCompare, isSelected: isCompared } = useCompare();

  // Logique métier partagée avec la carte verticale du catalogue.
  const {
    establishment,
    coverImage,
    categorySlug,
    location,
    distance,
    liked,
    toggleFavorite,
    whatsappUrl,
    mapsUrl,
    contactUrl,
    isBookable,
    openBooking,
  } = useListingActions(room, priceSuffix);

  const amenities = getAmenitiesInfo(room.amenities ?? []).slice(0, 3);
  const compared = isCompared(room.id);
  const catColor = CATEGORY_COLORS[categorySlug] ?? CATEGORY_COLORS.hotel;

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: Math.min(index, 4) * 0.06 }}
        className={cn(
          "group flex h-[176px] sm:h-[190px] cursor-pointer flex-row overflow-hidden rounded-2xl border bg-tt-card shadow-sm transition-shadow duration-300 hover:shadow-md",
          room.is_boosted
            ? "border-accent/60 shadow-accent/20 ring-1 ring-accent/40"
            : "border-tt-line hover:shadow-tt-ink/10"
        )}
        onClick={() => { setSelectedImage(coverImage); setDetailOpen(true); }}
      >
        {/* Image */}
        <motion.div
          layoutId={"listing-image-" + room.id}
          className="relative w-[130px] sm:w-[200px] lg:w-[240px] flex-shrink-0 overflow-hidden"
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
        >
          <Image
            src={coverImage}
            alt={room.name}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 640px) 200px, 130px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading={index < 3 ? "eager" : "lazy"}
          />

          {/* Badge catégorie coloré */}
          <span className={cn(
            "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white shadow-sm",
            catColor.bg
          )}>
            {getCategoryLabel(categorySlug)}
          </span>

          {/* Badge Sponsorisé — pour les annonces boostées */}
          {room.is_boosted && (
            <span className="absolute left-2 top-8 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[8px] sm:text-[9px] font-bold text-white shadow-sm">
              ⭐ Sponsorisé
            </span>
          )}

          {/* Boutons favori + comparer */}
          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
              aria-pressed={liked}
              aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all",
                liked
                  ? "bg-red-500/90 text-white shadow-md"
                  : "bg-black/30 text-white/80 hover:bg-black/50 hover:text-white"
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCompare({ id: room.id, name: room.name, city: establishment?.city, price: room.price, image: coverImage });
              }}
              aria-pressed={compared}
              aria-label={compared ? "Retirer de la comparaison" : "Ajouter à la comparaison"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all text-[10px] font-bold",
                compared
                  ? "bg-tt-ink/90 text-white shadow-md"
                  : "bg-black/30 text-white/80 hover:bg-black/50 hover:text-white"
              )}
            >
              <span aria-hidden="true">↔</span>
            </button>
          </div>
        </motion.div>

        {/* Contenu */}
        <div className="flex min-w-0 flex-1 flex-col justify-between overflow-hidden p-3 sm:p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold text-tt-ink text-sm sm:text-base leading-snug">
                {room.name}
              </h3>
            </div>

            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] sm:text-xs text-tt-ink-60">
                <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
                {distance != null && (
                  <span className="shrink-0 rounded-full bg-tt-ink/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-tt-ink">
                    📍 {formatDistance(distance)}
                  </span>
                )}
              </p>
            )}

            {/* Tags */}
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {amenities.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-tt-surface px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] lg:text-[11px] font-medium text-slate-600"
                  >
                    <Icon className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-tt-ink-40" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            )}

          {/* Bas : prix visuel + actions avec icônes */}
          <div className="mt-1.5 flex items-end justify-between gap-1.5 border-t border-slate-100 pt-1.5">
            {/* Prix avec icône wallet */}
            <div className="min-w-0 flex items-center gap-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10">
                <Wallet className="h-3 w-3 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-tt-ink leading-tight">
                  {formatFCFA(room.price ?? 0)}
                </p>
                <p className="text-[8px] text-tt-ink-60">{priceSuffix}</p>
              </div>
            </div>

            {/* Boutons avec icônes */}
            <div className="grid min-w-0 flex-shrink-0 grid-cols-3 items-center gap-1">
              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-lg border border-slate-200 px-1 text-[9px] font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/10"
                aria-label="Partager sur WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              {/* Itinéraire */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); window.open(mapsUrl, "_blank", "noopener,noreferrer"); }}
                aria-label={`Itinéraire vers ${room.name}`}
                className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-lg border border-slate-200 px-1 text-[9px] font-semibold text-slate-600 transition-colors hover:text-tt-ink"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Itinéraire</span>
              </button>
              {/* Réserver (hôtels/résidences) ou Contacter (autres catégories) */}
              {isBookable ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openBooking(); }}
                  aria-label={`Réserver ${room.name}`}
                  className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-lg bg-tt-ink px-1 text-[9px] font-semibold text-white shadow-sm transition-colors hover:bg-tt-ink/90"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Réserver</span>
                </button>
              ) : contactUrl ? (
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Contacter ${room.name}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-tt-ink px-2.5 h-7 text-[10px] font-medium text-white shadow-sm transition-colors hover:bg-tt-ink/90"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Contacter</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
          </div>
      </motion.article>

      {/* Fiche partagée avec la carte verticale du catalogue : une seule
          implémentation de la modale, aucune fonctionnalité métier perdue. */}
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
