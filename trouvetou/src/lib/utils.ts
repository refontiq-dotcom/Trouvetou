import type { LucideIcon } from "lucide-react";
import {
  AirVent,
  Bath,
  BedDouble,
  Car,
  Coffee,
  CookingPot,
  Droplets,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Tv,
  Waves,
  Wifi,
  Zap,
} from "lucide-react";
import type { EstablishmentType } from "./supabase/database.types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Image de secours affichée quand une annonce n'a pas de photo. */
export const PLACEHOLDER_IMAGE = "/placeholder-hotel.svg";

export function formatFCFA(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) +
    " FCFA"
  );
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Indicatifs téléphoniques des pays couverts (Afrique de l'Ouest). */
const COUNTRY_DIAL_CODES: Record<string, string> = {
  BF: "226",
  BJ: "229",
  CI: "225",
  CV: "238",
  GH: "233",
  GM: "220",
  GN: "224",
  GW: "245",
  LR: "231",
  ML: "223",
  MR: "222",
  NE: "227",
  NG: "234",
  SL: "232",
  SN: "221",
  TD: "235",
  TG: "228",
};

/**
 * Normalise un numéro de téléphone pour un lien tel:/wa.me.
 * Le préfixe international est déduit du pays (attrs.country), avec la
 * Côte d'Ivoire (+225) comme défaut historique.
 */
export function normalizePhone(phone: string, country?: string | null): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);

  const dialCode =
    COUNTRY_DIAL_CODES[(country ?? "").trim().toUpperCase()] ?? "225";

  if (cleaned.startsWith("0")) return `+${dialCode}${cleaned.slice(1)}`;
  return `+${dialCode}${cleaned}`;
}

export function buildGoogleMapsUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  address?: string | null
): string {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      address
    )}`;
  }
  return "https://www.google.com/maps";
}

export function buildWhatsAppUrl(
  phone: string,
  message?: string,
  country?: string | null
): string {
  const base = `https://wa.me/${normalizePhone(phone, country).replace(/^\+/, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export interface AmenityInfo {
  label: string;
  icon: LucideIcon;
}

const AMENITY_MAP: Array<[RegExp, AmenityInfo]> = [
  [/wifi|internet/, { label: "Wifi", icon: Wifi }],
  [/clim|climatis|air.?cond/, { label: "Climatisation", icon: Snowflake }],
  [/ventilat|ventilat/, { label: "Ventilation", icon: AirVent }],
  [/tv|télé|tele/, { label: "Télévision", icon: Tv }],
  [/parking|garage/, { label: "Parking", icon: Car }],
  [/piscine|pool/, { label: "Piscine", icon: Waves }],
  [/petit.?déj|petit.?dej|breakfast/, { label: "Petit-déjeuner", icon: Coffee }],
  [/cuisine|kitchen/, { label: "Cuisine équipée", icon: CookingPot }],
  [/sécurit|securit|garde/, { label: "Sécurité", icon: ShieldCheck }],
  [/salle.?de.?bain|douche|bain|bath/, { label: "Salle de bain", icon: Bath }],
  [/eau|water/, { label: "Eau courante", icon: Droplets }],
  [/électricit|electricit/, { label: "Électricité", icon: Zap }],
  [/ménage|menage|nettoyage/, { label: "Service ménage", icon: Sparkles }],
  [/lit|bed|drap/, { label: "Literie", icon: BedDouble }],
  [/balcon|terrasse|terrace/, { label: "Balcon / Terrasse", icon: Sun }],
];

export function getAmenityInfo(name: string): AmenityInfo {
  const normalized = name.trim().toLowerCase();
  for (const [pattern, info] of AMENITY_MAP) {
    if (pattern.test(normalized)) return info;
  }
  return { label: name.trim() || "Équipement", icon: Sparkles };
}

export function getAmenitiesInfo(names: string[]): AmenityInfo[] {
  return names.map(getAmenityInfo);
}

export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  hotel: "Hôtel",
  residence: "Résidence",
  appartements: "Appartements",
  villa: "Villa",
  guesthouse: "Maison d'hôtes",
  other: "Établissement",
};

export function getEstablishmentTypeLabel(type: EstablishmentType | null): string {
  if (!type) return "Établissement";
  return ESTABLISHMENT_TYPE_LABELS[type] ?? "Établissement";
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hôtel",
  residence: "Résidence",
  clinic: "Clinique",
  school: "École",
  other: "Établissement",
};

/** Libellé d'une catégorie Trouvetou (slug : hotel, residence, clinic, school, other). */
export function getCategoryLabel(slug: string | null): string {
  if (!slug) return "Établissement";
  return CATEGORY_LABELS[slug] ?? slug;
}
