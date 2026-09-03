import type { ListedListing } from "./listings";

// ============================================================================
// TROUVETOU — Vue d'affichage d'une annonce (`listings` polymorphe)
//
// Adaptateur qui transforme une `ListedListing` (base dédiée Trouvetou) en un
// objet plat consommable par les composants du catalogue. Les champs propres
// au secteur sont lus depuis `attributes JSONB` :
//   amenities, capacity, is_boosted, address, country,
//   latitude, longitude, contact_phone, whatsapp, contact_email
// ============================================================================

export interface EstablishmentView {
  id: string;
  name: string;
  /** Slug de catégorie : hotel, residence, clinic, school, other. */
  type: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_phone: string | null;
  whatsapp: string | null;
  contact_email: string | null;
}

export interface ListingView {
  id: string;
  external_id: string;
  name: string;
  /** Prix de base en FCFA (par nuit). */
  price: number | null;
  images: string[];
  description: string | null;
  amenities: string[];
  capacity: number | null;
  is_boosted: boolean;
  category_slug: string;
  establishment: EstablishmentView;
  updated_at: string;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
}

export function toListingView(listing: ListedListing): ListingView {
  const attrs = listing.attributes ?? {};

  return {
    id: listing.id,
    external_id: listing.external_id,
    name: listing.title,
    price: listing.base_price,
    images: Array.isArray(listing.images) ? listing.images : [],
    description: listing.description,
    amenities: asStringArray(attrs.amenities),
    capacity: asNumber(attrs.capacity),
    is_boosted: attrs.is_boosted === true,
    category_slug: listing.category.slug,
    establishment: {
      id: listing.provider_id,
      name: listing.provider.name,
      type: listing.category.slug,
      city: listing.city,
      country: asString(attrs.country),
      address: asString(attrs.address),
      latitude: asNumber(attrs.latitude),
      longitude: asNumber(attrs.longitude),
      contact_phone: asString(attrs.contact_phone),
      whatsapp: asString(attrs.whatsapp),
      contact_email: asString(attrs.contact_email),
    },
    updated_at: listing.updated_at,
  };
}

export function toListingViews(listings: ListedListing[]): ListingView[] {
  return listings.map(toListingView);
}
