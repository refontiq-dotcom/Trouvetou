// ============================================================================
// TROUVETOU — Visites panoramiques 360° (`listings.attributes.panoramas`)
//
// Source de vérité : le contrat Schooly §12 (`docs/integration-trouvetou.md` du
// dépôt Schooly). Le champ arrive dans le jsonb `attributes` de la fiche, ce qui
// évite toute migration : `attributes` existe déjà et accepte n'importe quel
// objet (`chk_attributes_is_object`).
//
// Règle de sécurité la plus importante de ce fichier : ON NE FAIT PAS CONFIANCE
// AU JSONB. `attributes` est une donnée de base, alimentée par une ingestion
// distante. Sans filtre, une valeur `javascript:` ou une projection inconnue
// arriverait jusqu'à la WebGL du visiteur. Chaque champ est donc validé, et un
// panorama douteux est IGNORÉ — jamais affiché « en espérant que ça marche ».
//
// Ce module est PUR : aucun import React, aucun accès réseau. Testable seul.
// ============================================================================

/** Seule projection qu'une vraie image équirectangulaire peut déclarer. */
export const EQUIRECTANGULAR_2_1 = "equirectangular_2_1";

/** Seule valeur de `media_type` qui déclenche la visionneuse. */
export const MEDIA_TYPE_360 = "photo_360";

export interface PanoramaMedia {
  id: string;
  url: string;
  media_type: typeof MEDIA_TYPE_360;
  projection: typeof EQUIRECTANGULAR_2_1;
  width: number | null;
  height: number | null;
  /** Chambre Schooly à l'origine, si la visite en est rattachée. */
  room_id: string | null;
  validated_at: string | null;
}

/**
 * URL absolue http(s) sûre, ou `null`.
 *
 * `new URL` est utilisé plutôt qu'un `startsWith("https://")` : il rejette
 * `javascript:`, `data:`, les URL relatives et les schémas exotiques, sans
 * avoir à tenir une liste de ce qui serait « normalement » acceptable.
 *
 * Exporté car la synchronisation Schooly filtre les photos classiques avec la
 * MÊME règle : une galerie et un panorama sortent de la même ingestion, ils
 * doivent être jugés par le même standard.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function asPositiveIntOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Valide une entrée de `attributes.panoramas`.
 *
 * `null` si l'entrée ne décrit pas une visite 360° exploitable. On exige
 * `media_type` ET `projection` explicites : sans eux, impossible de distinguer
 * une future visite 360° d'une image ordinary stockée dans le même tableau,
 * et une image plate affichée en équirectangulaire donne exactement la
 * « photo 360° » fausse que la feature ne doit pas produire.
 */
export function parsePanorama(value: unknown): PanoramaMedia | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (raw.media_type !== MEDIA_TYPE_360) return null;
  if (raw.projection !== EQUIRECTANGULAR_2_1) return null;

  const url = safeHttpUrl(raw.url);
  if (!url) return null;

  // Un panorama DOIT être 2:1. Les dimensions font partie du contrat : si le
  // fournisseur les envoie et qu'elles ne collent pas, on refuse plutôt que
  // d'étirer l'image à l'écran.
  const width = asPositiveIntOrNull(raw.width);
  const height = asPositiveIntOrNull(raw.height);
  if (width !== null && height !== null && Math.abs(width / height - 2) > 0.02) {
    return null;
  }

  return {
    id: asStringOrNull(raw.id) ?? url,
    url,
    media_type: MEDIA_TYPE_360,
    projection: EQUIRECTANGULAR_2_1,
    width,
    height,
    room_id: asStringOrNull(raw.room_id),
    validated_at: asStringOrNull(raw.validated_at),
  };
}

/**
 * Liste des visites exploitables d'une annonce.
 *
 * Silencieux sur les entrées invalides : une annonce ne doit pas disparaître
 * du catalogue parce qu'une de ses visites est corrompue. Le reste de la
 * fiche — photos classiques comprises — reste affiché normalement.
 */
export function parsePanoramas(value: unknown): PanoramaMedia[] {
  if (!Array.isArray(value)) return [];
  return value.map(parsePanorama).filter((p): p is PanoramaMedia => p !== null);
}
