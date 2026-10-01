"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRightLeft,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import { PanoramaViewer } from "@/components/hotels/panorama-viewer";
import { BookingModal } from "@/components/hotels/booking-modal";
import { useListingActions } from "@/components/hotels/use-listing-actions";
import { useCompare } from "@/contexts/compare-context";
import { cn, formatFCFA, getAmenitiesInfo, getCategoryLabel } from "@/lib/utils";
import type { ListingView } from "@/lib/supabase/listing-view";

// ============================================================================
// TROUVETOU — Fiche détaillée d'une annonce
//
// Extraite de `RoomCard` afin que les deux représentations d'une annonce
// (carte horizontale des favoris, carte verticale du catalogue) ouvrent la
// MÊME fiche. Toute la logique métier — WhatsApp, itinéraire, réservation,
// comparaison, panorama 360°, description, services — reste disponible quel
// que soit l'écran, y compris depuis le catalogue dont la carte est allégée.
// ============================================================================

interface ListingDetailModalProps {
  room: ListingView;
  /** Libellé du prix, adapté à la catégorie (« par nuit », « par plat »…). */
  priceSuffix: string;
  /** L'image actuellement agrandie dans la galerie. */
  selectedImage: string | null;
  onSelectImage: (image: string) => void;
  onClose: () => void;
}

export function ListingDetailModal({
  room,
  priceSuffix,
  selectedImage,
  onSelectImage,
  onClose,
}: ListingDetailModalProps) {
  const {
    location,
    categorySlug,
    coverImage,
    liked,
    toggleFavorite,
    whatsappUrl,
    mapsUrl,
    contactUrl,
    isBookable,
    panoramaSrc,
    bookingOpen,
    openBooking,
    closeBooking,
  } = useListingActions(room, priceSuffix);

  const { toggleCompare, isSelected } = useCompare();
  const compared = isSelected(room.id);

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[100] overflow-y-auto bg-tt-dark/90 p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label={"Détails de " + room.name}
        >
          <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-secondary shadow-2xl sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2rem]">
            <motion.div
              className="relative h-[48dvh] min-h-[320px] shrink-0 overflow-hidden"
              layoutId={"listing-image-" + room.id}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_62%,rgba(255,255,255,.22),transparent_2px)] bg-[size:12px_12px] opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-br from-tt-dark via-primary to-primary-light" />
              <Image
                src={selectedImage ?? coverImage}
                alt={room.name}
                fill
                priority
                sizes="(min-width: 640px) 430px, 100vw"
                className="object-contain px-8 pb-5 pt-24 drop-shadow-[0_22px_18px_rgba(16,42,114,.38)]"
              />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-tt-ink shadow-sm"
                  aria-label="Retour aux annonces"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-tt-ink shadow-sm"
                  aria-label="Partager l'annonce"
                >
                  <Share2 className="h-5 w-5" />
                </a>
              </div>
              <div className="absolute left-6 right-6 top-20">
                <h2 className="font-display text-2xl font-bold leading-tight text-white">
                  {room.name}
                </h2>
                <p className="mt-1 text-sm font-medium text-white/80">
                  {getCategoryLabel(categorySlug)}
                  {location ? ` · ${location}` : ""}
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ delay: 0.08, duration: 0.28 }}
              className="relative -mt-5 flex flex-1 flex-col rounded-t-[2rem] bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_-10px_26px_rgba(16,42,114,.18)]"
            >
              <div className="absolute -top-12 left-0 rounded-tr-[2rem] bg-white px-6 pb-4 pt-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Prix
                </p>
                <p className="mt-0.5 text-xl font-extrabold leading-tight text-accent-hover">
                  {formatFCFA(room.price ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{priceSuffix}</p>
              </div>

              {/* Le comparateur reste atteignable depuis la fiche : la carte du
                  catalogue ne l'expose plus dans sa zone tactile. */}
              <div className="absolute right-6 -top-11 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    toggleCompare({
                      id: room.id,
                      name: room.name,
                      city: room.establishment?.city,
                      price: room.price,
                      image: coverImage,
                    })
                  }
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm",
                    compared ? "text-primary" : "text-tt-ink"
                  )}
                  aria-pressed={compared}
                  aria-label={
                    compared
                      ? "Retirer cette annonce du comparateur"
                      : "Comparer cette annonce"
                  }
                >
                  <ArrowRightLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm",
                    liked ? "text-rose-500" : "text-tt-ink"
                  )}
                  aria-pressed={liked}
                  aria-label={
                    liked
                      ? "Retirer cette annonce des favoris"
                      : "Ajouter cette annonce aux favoris"
                  }
                >
                  <Star className={cn("h-5 w-5", liked && "fill-current")} />
                </button>
              </div>

              {room.images.length > 1 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">Photos</h3>
                    <span className="text-xs text-muted-foreground">
                      {room.images.length} photos
                    </span>
                  </div>
                  <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                    {room.images.map((image, imageIndex) => (
                      <button
                        key={image + imageIndex}
                        type="button"
                        onClick={() => onSelectImage(image)}
                        className={cn(
                          "relative h-16 w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-secondary",
                          (selectedImage ?? coverImage) === image
                            ? "border-primary"
                            : "border-transparent"
                        )}
                        aria-label={"Afficher la photo " + (imageIndex + 1)}
                      >
                        <Image
                          src={image}
                          alt={room.name + " — photo " + (imageIndex + 1)}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-14 flex items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-foreground">Description</h3>
                <span className="flex items-center gap-1 text-xs font-semibold text-accent-hover">
                  <Star className="h-4 w-4 fill-current" /> Trouvetou
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {room.description
                  ? room.description
                  : "Découvrez les informations et services proposés par cette annonce."}
              </p>

              {getAmenitiesInfo(room.amenities ?? []).length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-bold text-foreground">Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {getAmenitiesInfo(room.amenities ?? []).map(({ label, icon: Icon }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
                      >
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {location && (
                <p className="mt-5 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{location}</span>
                </p>
              )}

              {panoramaSrc && (
                <div className="mt-5">
                  <PanoramaViewer
                    src={panoramaSrc}
                    previewSrc={coverImage}
                    title={room.name + " — visite 360°"}
                    tour={room.panorama_tour}
                    initialSceneId={
                      room.panorama_start_scene_id ?? room.panorama_tour?.startSceneId
                    }
                  />
                </div>
              )}

              <div className="mt-auto grid grid-cols-3 gap-2 pt-7">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#25D366]"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                >
                  <Navigation className="h-5 w-5" />
                  Itinéraire
                </button>
                {isBookable ? (
                  <button
                    type="button"
                    onClick={openBooking}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <Phone className="h-5 w-5" />
                    Réserver
                  </button>
                ) : contactUrl ? (
                  <a
                    href={contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Contacter
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-white shadow-sm"
                  >
                    Fermer
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <BookingModal
        room={room}
        open={bookingOpen}
        onClose={closeBooking}
        priceSuffix={priceSuffix}
      />
    </>
  );
}