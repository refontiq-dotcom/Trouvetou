"use client";

import { useId, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Rotate3D,
  X,
} from "lucide-react";
import { BookingModal } from "@/components/hotels/booking-modal";
import { PanoramaViewer } from "@/components/media/panorama-viewer";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/contexts/auth-context";
import { useFavorites } from "@/contexts/favorites-context";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  cn,
  formatFCFA,
  getAmenitiesInfo,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import {
  categorySearchHref,
  getCategoryChipClass,
  getCategoryLabel,
  getPriceSuffix,
} from "@/lib/categories";
import { isListingBookable, resolveCategorySlug } from "@/lib/booking/eligibility";
import type { ListingView } from "@/lib/supabase/listing-view";

interface ListingDetailModalProps {
  /** Annonce à afficher ; `null` ferme la modale. */
  room: ListingView | null;
  onClose: () => void;
  /** Libellé de prix du portail d'origine (défaut : selon la catégorie). */
  priceSuffix?: string;
}

/**
 * Détail d'une annonce, partagé par l'accueil et les portails.
 *
 * - Téléphone : galerie en haut, informations empilées et défilantes.
 * - Tablette : même pile, plus haute.
 * - Desktop (≥ 1024 px) : deux colonnes 58 % / 42 %, hauteur limitée à 88 dvh,
 *   galerie dominante, informations lisibles et défilement local.
 *
 * La modale réutilise le composant `Modal` du projet (Échap, clic sur le fond,
 * piège de focus, `aria-modal`, nom accessible, retour du focus).
 */
export function ListingDetailModal({
  room,
  onClose,
  priceSuffix,
}: ListingDetailModalProps) {
  const titleId = useId();

  return (
    <Modal
      open={room !== null}
      onClose={onClose}
      size="detail"
      className="overflow-hidden"
      contentClassName="flex-1 overflow-hidden p-0"
      labelledBy={titleId}
      showClose={false}
    >
      {room && (
        <ListingDetailContent
          key={room.id}
          room={room}
          titleId={titleId}
          priceSuffix={priceSuffix ?? getPriceSuffix(room.category_slug)}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ListingDetailContent({
  room,
  titleId,
  priceSuffix,
  onClose,
}: {
  room: ListingView;
  titleId: string;
  priceSuffix: string;
  onClose: () => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [panoramaOpen, setPanoramaOpen] = useState(false);
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const pathname = usePathname();

  const establishment = room.establishment;
  const categorySlug = resolveCategorySlug(room);
  const categoryLabel = getCategoryLabel(categorySlug);
  const liked = isFavorite(room.id);
  const isBookable = isListingBookable(room);
  const panorama = room.panoramas?.[0] ?? null;

  // Photos réellement fournies, avec repli sur l'illustration locale.
  const images = useMemo(() => {
    const valid = room.images.filter(
      (src) => typeof src === "string" && src.trim().length > 0
    );
    return valid.length > 0 ? valid : [PLACEHOLDER_IMAGE];
  }, [room.images]);
  const currentImage = images[Math.min(imageIndex, images.length - 1)];
  const hasGallery = images.length > 1;

  const location = [establishment.city, establishment.address]
    .filter(Boolean)
    .join(" · ");
  const hasPrice = room.price != null && room.price > 0;
  const amenities = getAmenitiesInfo(room.amenities ?? []);
  const contactPhone = establishment.whatsapp ?? establishment.contact_phone;
  const mapsUrl = buildGoogleMapsUrl(
    establishment.latitude,
    establishment.longitude,
    establishment.address ?? establishment.city
  );
  const contactUrl =
    contactPhone && !isBookable
      ? buildWhatsAppUrl(
          contactPhone,
          `Bonjour, je vous contacte depuis Trouvetou à propos de « ${room.name} ».`,
          establishment.country
        )
      : null;

  // Lien de partage : il mène à la catégorie exacte de l'annonce.
  const listingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${categorySearchHref(categorySlug, room.name)}`
      : "";
  const whatsappShareUrl = buildWhatsAppShareUrl({
    name: room.name,
    city: establishment.city,
    price: room.price,
    priceSuffix,
    url: listingUrl,
  });

  const openBooking = () => {
    if (!user) {
      router.push(`/auth?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setBookingOpen(true);
  };

  const previousImage = () =>
    setImageIndex((i) => (i - 1 + images.length) % images.length);
  const nextImage = () => setImageIndex((i) => (i + 1) % images.length);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallback === "1") return;
    img.dataset.fallback = "1";
    img.src = PLACEHOLDER_IMAGE;
  };

  return (
    <div className="relative flex h-full flex-col lg:flex-row">
      {/* Fermer : premier élément du DOM pour être la première cible clavier. */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-neutral-900 shadow-lg ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white sm:right-4 sm:top-4"
        aria-label="Fermer le détail de l'annonce"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {panoramaOpen && panorama && (
        <PanoramaViewer
          panorama={panorama}
          label={room.name}
          onClose={() => setPanoramaOpen(false)}
        />
      )}

      {/* ─────────────── Galerie ─────────────── */}
      <div className="relative h-[38dvh] shrink-0 overflow-hidden bg-neutral-900 sm:h-[42dvh] lg:h-auto lg:w-[58%]">
        <img
          key={currentImage}
          src={currentImage}
          alt={`${room.name} — photo ${imageIndex + 1} sur ${images.length}`}
          className="h-full w-full object-cover"
          onError={handleImageError}
        />

        {hasGallery && (
          <>
            <button
              type="button"
              onClick={previousImage}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
              aria-label="Photo précédente"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
              aria-label="Photo suivante"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>

            <span className="absolute bottom-4 left-4 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
              {imageIndex + 1} / {images.length}
            </span>

            <div className="absolute inset-x-16 bottom-3 z-10 hidden justify-center gap-2 sm:flex">
              {images.slice(0, 6).map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`Afficher la photo ${i + 1}`}
                  aria-current={i === imageIndex ? "true" : undefined}
                  className={cn(
                    "h-11 w-14 overflow-hidden rounded-lg ring-2 transition-opacity",
                    i === imageIndex
                      ? "ring-white"
                      : "opacity-75 ring-white/30 hover:opacity-100"
                  )}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={handleImageError}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─────────────── Informations ─────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        {/* Contenu défilant : le pied d'actions reste toujours visible. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                  getCategoryChipClass(categorySlug)
                )}
              >
                {categoryLabel}
              </span>
              {room.is_boosted && (
                <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-white">
                  Sponsorisé
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(room.id)}
              aria-pressed={liked}
              aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
              className="-mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-neutral-700 transition-colors hover:bg-slate-50"
            >
              <Heart
                className={cn(
                  "h-5 w-5",
                  liked && "fill-rose-500 text-rose-500"
                )}
              />
            </button>
          </div>

          <h2
            id={titleId}
            className="mt-3 text-2xl font-bold leading-tight text-foreground sm:text-[28px]"
          >
            {room.name}
          </h2>

          {location && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{location}</span>
            </p>
          )}

          {hasPrice && (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">
                {formatFCFA(room.price as number)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {priceSuffix}
              </span>
            </div>
          )}

          {panorama && !panoramaOpen && (
            <button
              type="button"
              onClick={() => setPanoramaOpen(true)}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
              aria-label={`Ouvrir la visite 360° de ${room.name}`}
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Rotate3D className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">
                  Vue 360°
                </span>
                <span className="block text-xs text-muted-foreground">
                  Explorez la pièce comme si vous y étiez
                </span>
              </span>
            </button>
          )}

          <h3 className="mt-6 text-sm font-bold text-foreground">Description</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {room.description ||
              "Découvrez les informations et services proposés par cette annonce."}
          </p>

          {amenities.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold text-foreground">Services</h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map(({ label, icon: Icon }, i) => (
                  <span
                    key={`${label}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        </div>

        <div className="shrink-0 border-t border-slate-100 p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/10"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={() =>
                window.open(mapsUrl, "_blank", "noopener,noreferrer")
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Navigation className="h-5 w-5" aria-hidden="true" />
              Itinéraire
            </button>
            {isBookable ? (
              <button
                type="button"
                onClick={openBooking}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
              >
                <Phone className="h-5 w-5" aria-hidden="true" />
                Réserver
              </button>
            ) : contactUrl ? (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Contacter
              </a>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
              >
                Fermer
              </button>
            )}
          </div>
          {establishment.name && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Publié par {establishment.name}
            </p>
          )}
        </div>
      </div>

      <BookingModal
        room={room}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        priceSuffix={priceSuffix}
      />
    </div>
  );
}
