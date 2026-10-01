"use client";

import { useState } from "react";
import { useLocation } from "@/contexts/location-context";
import { useFavorites } from "@/contexts/favorites-context";
import { haversineDistance } from "@/lib/geo";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import {
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  PLACEHOLDER_IMAGE,
} from "@/lib/utils";
import { isListingBookable, resolveCategorySlug } from "@/lib/booking/eligibility";
import { safeHttpUrl } from "@/lib/http/url";
import type { ListingView } from "@/lib/supabase/listing-view";

// ============================================================================
// TROUVETOU — Actions métier d'une annonce, partagées par ses représentations
//
// `RoomCard` (carte horizontale, page Favoris) et `ListingCard` (carte verticale,
// catalogue) affichent la même annonce sous deux formes : la logique métier —
// favori, WhatsApp, itinéraire, réservation, panorama 360°, distance — ne doit
// donc pas être dupliquée dans chaque carte.
// ============================================================================

/** Route du portail correspondant au slug de catégorie. */
const PORTAL_BY_CATEGORY: Record<string, string> = {
  school: "/ecoles",
  clinic: "/cliniques",
  restaurant: "/restaurants",
  hotel: "/hotels",
  residence: "/hotels",
  other: "/hotels",
};

function buildListingUrl(room: ListingView, categorySlug: string): string {
  if (typeof window === "undefined") return "";
  const portal = PORTAL_BY_CATEGORY[categorySlug] ?? "/hotels";
  return `${window.location.origin}${portal}?q=${encodeURIComponent(room.name)}`;
}

export interface ListingActions {
  establishment: ListingView["establishment"];
  coverImage: string;
  /** Slug effectif de catégorie (l'établissement prime sur l'annonce). */
  categorySlug: string;
  /** Adresse lisible : « Cocody · Rue des Jardins ». */
  location: string;
  /** Distance en km si la position de l'utilisateur est connue. */
  distance: number | null;
  liked: boolean;
  toggleFavorite: () => void;
  /** Lien de partage WhatsApp de l'annonce. */
  whatsappUrl: string;
  /** Lien Google Maps de l'itinéraire. */
  mapsUrl: string;
  /** Contact WhatsApp direct, null si l'annonce est réservable ou sans numéro. */
  contactUrl: string | null;
  /** L'annonce accepte-t-elle une réservation en ligne ? */
  isBookable: boolean;
  /** Source 360° validée (WebGL : une URL `javascript:` exécuterait du script). */
  panoramaSrc: string | null;
  bookingOpen: boolean;
  openBooking: () => void;
  closeBooking: () => void;
}

/**
 * Dérive l'ensemble des actions métier d'une annonce.
 *
 * La source du panorama est résolue par ordre de priorité :
 *   1. la scène de DÉPART synchronisée (`panorama_start_scene_id`)
 *   2. la scène de DÉPART déclarée par le tour lui-même
 *   3. la première scène du tour
 * et, à défaut, l'URL 360° historique mono-scène.
 *
 * `safeHttpUrl` est appliqué ici et non seulement à l'ingestion : cette URL
 * part vers une texture WebGL, donc une `javascript:` stockée en base
 * deviendrait une exécution de script chez le visiteur.
 */
export function useListingActions(
  room: ListingView,
  priceSuffix: string
): ListingActions {
  const { location: userLocation } = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [bookingOpen, setBookingOpen] = useState(false);

  const establishment = room.establishment;
  const coverImage = room.cover_image_url ?? room.images[0] ?? PLACEHOLDER_IMAGE;
  const categorySlug = resolveCategorySlug(room);

  const isBookable = isListingBookable(room);
  const contactPhone = establishment?.whatsapp ?? establishment?.contact_phone;
  const contactUrl =
    contactPhone && !isBookable
      ? buildWhatsAppUrl(
          contactPhone,
          `Bonjour, je vous contacte depuis Trouvetou à propos de « ${room.name} ».`,
          establishment?.country
        )
      : null;

  const tourScenes = room.panorama_tour?.scenes ?? [];
  const startSceneId =
    room.panorama_start_scene_id ?? room.panorama_tour?.startSceneId ?? null;
  const panoramaSrc =
    safeHttpUrl(tourScenes.find((scene) => scene.id === startSceneId)?.src) ??
    safeHttpUrl(tourScenes[0]?.src) ??
    safeHttpUrl(room.panorama_360_url);

  const location = [establishment?.city, establishment?.address]
    .filter(Boolean)
    .join(" · ");

  const distance =
    userLocation && establishment?.latitude != null && establishment?.longitude != null
      ? haversineDistance(userLocation, {
          lat: establishment.latitude,
          lng: establishment.longitude,
        })
      : null;

  const whatsappUrl = buildWhatsAppShareUrl({
    name: room.name,
    city: establishment?.city,
    price: room.price,
    priceSuffix,
    url: buildListingUrl(room, categorySlug),
  });

  return {
    establishment,
    coverImage,
    categorySlug,
    location,
    distance,
    liked: isFavorite(room.id),
    toggleFavorite: () => toggleFavorite(room.id),
    whatsappUrl,
    mapsUrl: buildGoogleMapsUrl(
      establishment?.latitude,
      establishment?.longitude,
      establishment?.address ?? establishment?.city
    ),
    contactUrl,
    isBookable,
    panoramaSrc,
    bookingOpen,
    openBooking: () => setBookingOpen(true),
    closeBooking: () => setBookingOpen(false),
  };
}