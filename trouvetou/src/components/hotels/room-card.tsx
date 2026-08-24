"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import { BookingModal } from "@/components/hotels/booking-modal";
import { useLocation } from "@/contexts/location-context";
import { haversineDistance, formatDistance } from "@/lib/geo";
import {
  buildGoogleMapsUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  getCategoryLabel,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

interface RoomCardProps {
  room: ListingView;
  index?: number;
  /** Libellé du prix affiché sous le montant (défaut : "par nuit"). */
  priceSuffix?: string;
}

/**
 * Carte d'annonce horizontale — le format standard de Trouvetou :
 * image à gauche (largeur fixe), détails à droite. Les tags et la
 * description ne se déploient qu'au clic (surtout sur mobile).
 */
export function RoomCard({ room, index = 0, priceSuffix = "par nuit" }: RoomCardProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const establishment = room.establishment;
  const coverImage = room.images[0] ?? PLACEHOLDER_IMAGE;
  const amenities = getAmenitiesInfo(room.amenities ?? []).slice(0, 6);
  const mapsUrl = buildGoogleMapsUrl(
    establishment?.latitude,
    establishment?.longitude,
    establishment?.address ?? establishment?.city
  );
  const { location: userLocation } = useLocation();

  const location = [establishment?.city, establishment?.address]
    .filter(Boolean)
    .join(" · ");

  // Calcul de la distance si la position utilisateur et les coordonnées existent
  const distance =
    userLocation &&
    establishment?.latitude != null &&
    establishment?.longitude != null
      ? haversineDistance(userLocation, {
          lat: establishment.latitude,
          lng: establishment.longitude,
        })
      : null;

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: Math.min(index, 4) * 0.06 }}
        className={cn(
          "group flex cursor-pointer flex-row overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md",
          room.is_boosted
            ? "border-accent/60 shadow-accent/20 ring-1 ring-accent/40"
            : "border-border hover:shadow-primary/10"
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Image — largeur fixe, comme la maquette */}
        <div className="relative w-[130px] sm:w-[200px] lg:w-[240px] flex-shrink-0 overflow-hidden">
          <Image
            src={coverImage}
            alt={room.name}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 640px) 200px, 130px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading={index < 3 ? "eager" : "lazy"}
          />

          {room.is_boosted ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-yellow-500 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-accent-foreground shadow-sm">
              <Sparkles className="h-2.5 w-2.5" />
              Sponsorisé
            </span>
          ) : (
            <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-accent-foreground shadow-sm">
              {establishment?.type ? getCategoryLabel(establishment.type) : "Établissement"}
            </span>
          )}
        </div>

        {/* Contenu — remplit l'espace, aucun vide sous la photo */}
        <div className="flex flex-1 flex-col justify-between min-w-0 p-3 sm:p-4">
          {/* Haut : nom + établissement + localisation */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold text-foreground text-sm sm:text-base lg:text-lg leading-tight">
                {room.name}
              </h3>
              {establishment?.name && (
                <span className="hidden lg:inline flex-shrink-0 truncate max-w-[40%] text-[10px] font-medium text-muted-foreground">
                  {establishment.name}
                </span>
              )}
            </div>

            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{location}</span>
                {distance != null && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-primary">
                    {formatDistance(distance)}
                  </span>
                )}
              </p>
            )}

            {/* Tags — cachés sur mobile jusqu'au clic */}
            {amenities.length > 0 && (
              <div className={cn("flex-wrap gap-1 mt-2", expanded ? "flex" : "hidden sm:flex")}>
                {amenities.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] lg:text-[11px] font-medium text-slate-600"
                  >
                    <Icon className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-slate-400" />
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Description — visible uniquement au clic */}
            <AnimatePresence>
              {expanded && room.description && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    {room.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bas : prix + actions — toujours visibles */}
          <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
            <div className="min-w-0">
              <p className="text-sm sm:text-base lg:text-lg font-bold text-foreground leading-tight">
                {formatFCFA(room.price ?? 0)}{" "}
                <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                  F CFA
                </span>
              </p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                {priceSuffix}
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(mapsUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-slate-600 transition-colors hover:text-foreground"
              >
                <Navigation className="h-3 w-3" />
                Itinéraire
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBookingOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1565c0] px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#0d47a1]"
              >
                <Phone className="h-3 w-3" />
                Réserver
              </button>
            </div>
          </div>

          {/* Indicateur d'expand sur mobile */}
          <div className="mt-1 flex justify-center sm:hidden">
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </motion.article>

      <BookingModal
        room={room}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        priceSuffix={priceSuffix}
      />
    </>
  );
}
