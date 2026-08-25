"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Wallet,
  Sparkles,
  Star,
} from "lucide-react";
import { BookingModal } from "@/components/hotels/booking-modal";
import { useLocation } from "@/contexts/location-context";
import { useFavorites } from "@/contexts/favorites-context";
import { useCompare } from "@/contexts/compare-context";
import { haversineDistance, formatDistance } from "@/lib/geo";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import {
  buildGoogleMapsUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  getCategoryLabel,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

/** Couleurs par catégorie pour les badges */
const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  clinic: { bg: "bg-emerald-500", text: "text-emerald-500", ring: "ring-emerald-500/20" },
  school: { bg: "bg-primary", text: "text-primary", ring: "ring-primary/20" },
  restaurant: { bg: "bg-orange-500", text: "text-orange-500", ring: "ring-orange-500/20" },
  hotel: { bg: "bg-amber-500", text: "text-amber-500", ring: "ring-amber-500/20" },
  residence: { bg: "bg-amber-500", text: "text-amber-500", ring: "ring-amber-500/20" },
};

interface RoomCardProps {
  room: ListingView;
  index?: number;
  priceSuffix?: string;
}

export function RoomCard({ room, index = 0, priceSuffix = "par nuit" }: RoomCardProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { location: userLocation } = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { toggleCompare, isSelected: isCompared } = useCompare();

  const establishment = room.establishment;
  const coverImage = room.images[0] ?? PLACEHOLDER_IMAGE;
  const amenities = getAmenitiesInfo(room.amenities ?? []).slice(0, 6);
  const mapsUrl = buildGoogleMapsUrl(
    establishment?.latitude,
    establishment?.longitude,
    establishment?.address ?? establishment?.city
  );
  const liked = isFavorite(room.id);
  const compared = isCompared(room.id);
  const catSlug = establishment?.type ?? room.category_slug ?? "";
  const catColor = CATEGORY_COLORS[catSlug] ?? CATEGORY_COLORS.hotel;

  const location = [establishment?.city, establishment?.address]
    .filter(Boolean)
    .join(" · ");

  const distance =
    userLocation && establishment?.latitude != null && establishment?.longitude != null
      ? haversineDistance(userLocation, { lat: establishment.latitude, lng: establishment.longitude })
      : null;

  const listingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${catSlug === "school" ? "ecoles" : catSlug === "clinic" ? "cliniques" : catSlug === "restaurant" ? "restaurants" : "hotels"}?q=${encodeURIComponent(room.name)}`
      : "";

  const whatsappUrl = buildWhatsAppShareUrl({
    name: room.name,
    city: establishment?.city,
    price: room.price,
    priceSuffix,
    url: listingUrl,
  });

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
        {/* Image */}
        <div className="relative w-[130px] sm:w-[200px] lg:w-[240px] flex-shrink-0 overflow-hidden">
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
            {getCategoryLabel(catSlug)}
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
              onClick={(e) => { e.stopPropagation(); toggleFavorite(room.id); }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all",
                liked
                  ? "bg-red-500/90 text-white shadow-md"
                  : "bg-black/30 text-white/80 hover:bg-black/50 hover:text-white"
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCompare({ id: room.id, name: room.name, city: establishment?.city, price: room.price, image: coverImage });
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all text-[10px] font-bold",
                compared
                  ? "bg-primary/90 text-white shadow-md"
                  : "bg-black/30 text-white/80 hover:bg-black/50 hover:text-white"
              )}
            >
              ↔
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex flex-1 flex-col justify-between min-w-0 p-3 sm:p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-semibold text-foreground text-sm sm:text-base lg:text-lg leading-tight">
                {room.name}
              </h3>
            </div>

            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{location}</span>
                {distance != null && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-primary">
                    📍 {formatDistance(distance)}
                  </span>
                )}
              </p>
            )}

            {/* Tags */}
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

            {/* Description */}
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

          {/* Bas : prix visuel + actions avec icônes */}
          <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
            {/* Prix avec icône wallet */}
            <div className="min-w-0 flex items-center gap-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10">
                <Wallet className="h-3.5 w-3.5 text-accent" />
              </div>
              <div>
                <p className="text-sm sm:text-base lg:text-lg font-bold text-foreground leading-tight">
                  {formatFCFA(room.price ?? 0)}{" "}
                  <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                    F CFA
                  </span>
                </p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">{priceSuffix}</p>
              </div>
            </div>

            {/* Boutons avec icônes */}
            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 h-8 w-8 text-[#25D366] transition-colors hover:bg-[#25D366]/10"
                aria-label="Partager sur WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              {/* Itinéraire */}
              <button
                onClick={(e) => { e.stopPropagation(); window.open(mapsUrl, "_blank", "noopener,noreferrer"); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 sm:px-2.5 h-8 text-[10px] sm:text-xs font-medium text-slate-600 transition-colors hover:text-foreground"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Itinéraire</span>
              </button>
              {/* Réserver */}
              <button
                onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 sm:px-3 h-8 text-[10px] sm:text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
              >
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Réserver</span>
              </button>
            </div>
          </div>

          {/* Expand indicator */}
          <div className="mt-1 flex justify-center sm:hidden">
            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", expanded && "rotate-180")} />
          </div>
        </div>
      </motion.article>

      <BookingModal room={room} open={bookingOpen} onClose={() => setBookingOpen(false)} priceSuffix={priceSuffix} />
    </>
  );
}
