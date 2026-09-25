"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Heart,
  X,
  ArrowLeft,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Wallet,
} from "lucide-react";
import { BookingModal } from "@/components/hotels/booking-modal";
import { useLocation } from "@/contexts/location-context";
import { useFavorites } from "@/contexts/favorites-context";
import { useCompare } from "@/contexts/compare-context";
import { haversineDistance, formatDistance } from "@/lib/geo";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  getCategoryLabel,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

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
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
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

  // Une réservation (nuits × prix) n'a de sens que pour l'hôtellerie.
  // Les autres catégories proposent un simple contact WhatsApp.
  const isBookable = catSlug === "hotel" || catSlug === "residence";
  const contactPhone = establishment?.whatsapp ?? establishment?.contact_phone;
  const contactUrl =
    contactPhone && !isBookable
      ? buildWhatsAppUrl(
          contactPhone,
          `Bonjour, je vous contacte depuis Trouvetou à propos de « ${room.name} ».`,
          establishment?.country
        )
      : null;

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
          "group flex h-full cursor-pointer flex-row overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md",
          room.is_boosted
            ? "border-accent/60 shadow-accent/20 ring-1 ring-accent/40"
            : "border-border hover:shadow-primary/10"
        )}
        onClick={() => setDetailOpen(true)}
      >
        {/* Image */}
        <div className="relative w-[130px] sm:w-[200px] lg:w-[240px] flex-shrink-0 overflow-hidden">
          <Image
            src={coverImage}
            alt={room.name}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 640px) 200px, 130px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            layoutId={"listing-image-" + room.id}
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
              <h3 className="truncate font-semibold text-foreground text-sm sm:text-base leading-snug">
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
              <div className="flex flex-wrap gap-1 mt-1.5">
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

          {/* Bas : prix visuel + actions avec icônes */}
          <div className="mt-1.5 flex items-end justify-between gap-1.5 border-t border-slate-100 pt-1.5">
            {/* Prix avec icône wallet */}
            <div className="min-w-0 flex items-center gap-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10">
                <Wallet className="h-3 w-3 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">
                  {formatFCFA(room.price ?? 0)}
                </p>
                <p className="text-[8px] text-muted-foreground">{priceSuffix}</p>
              </div>
            </div>

            {/* Boutons avec icônes */}
            <div className="flex flex-shrink-0 items-center gap-0.5">
              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 h-7 w-7 text-[#25D366] transition-colors hover:bg-[#25D366]/10"
                aria-label="Partager sur WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
              {/* Itinéraire */}
              <button
                onClick={(e) => { e.stopPropagation(); window.open(mapsUrl, "_blank", "noopener,noreferrer"); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 h-7 text-[10px] font-medium text-slate-600 transition-colors hover:text-foreground"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Itinéraire</span>
              </button>
              {/* Réserver (hôtels/résidences) ou Contacter (autres catégories) */}
              {isBookable ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setBookingOpen(true); }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 h-7 text-[10px] font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Réserver</span>
                </button>
              ) : contactUrl ? (
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 h-7 text-[10px] font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Contacter</span>
                </a>
              ) : null}
            </div>
          </div>
      </motion.article>

      <AnimatePresence>
        {detailOpen && (
          <motion.div className="fixed inset-0 z-[100] bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} role="dialog" aria-modal="true" aria-label={"Détails de " + room.name}>
            <div className="flex h-[100dvh] w-screen flex-col overflow-y-auto bg-white">
              <motion.div className="relative h-[42dvh] min-h-[280px] w-screen shrink-0 overflow-hidden bg-slate-100" layoutId={"listing-image-" + room.id} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
                <Image src={coverImage} alt={room.name} fill priority sizes="100vw" className="object-cover" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
                  <button type="button" onClick={() => setDetailOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md" aria-label="Retour aux annonces"><ArrowLeft className="h-5 w-5" /></button>
                  <button type="button" onClick={() => setDetailOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md" aria-label="Fermer"><X className="h-5 w-5" /></button>
                </div>
                <span className={cn("absolute bottom-4 left-4 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm", catColor.bg)}>{getCategoryLabel(catSlug)}</span>
              </motion.div>
              <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ delay: 0.08, duration: 0.28 }} className="relative -mt-1 flex min-h-[58dvh] flex-1 flex-col rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-2xl font-bold leading-tight text-foreground">{room.name}</h2>{location && <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{location}</span></p>}</div><div className="shrink-0 text-right"><p className="text-lg font-extrabold text-foreground">{formatFCFA(room.price ?? 0)}</p><p className="text-xs text-muted-foreground">{priceSuffix}</p></div></div>
                {amenities.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{getAmenitiesInfo(room.amenities ?? []).map(({ label, icon: Icon }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"><Icon className="h-3.5 w-3.5 text-slate-400" />{label}</span>)}</div>}
                {room.description && <div className="mt-6"><h3 className="text-sm font-bold text-foreground">À propos de cette annonce</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{room.description}</p></div>}
                <div className="mt-auto grid grid-cols-2 gap-3 pt-7"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#25D366]"><MessageCircle className="h-5 w-5" />WhatsApp</a>{isBookable ? <button type="button" onClick={() => setBookingOpen(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm"><Phone className="h-5 w-5" />Réserver</button> : contactUrl ? <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm"><MessageCircle className="h-5 w-5" />Contacter</a> : <button type="button" onClick={() => setDetailOpen(false)} className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm">Fermer</button>}</div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BookingModal room={room} open={bookingOpen} onClose={() => setBookingOpen(false)} priceSuffix={priceSuffix} />
    </>
  );
}
