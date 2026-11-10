/**
 * Résout le secret serveur-à-serveur d'un partenaire Trouvetou.
 *
 * Convention d'environnement : TROUVETOU_BOOKING_SECRET_<PROVIDER_SLUG>.
 * Exemple : TROUVETOU_BOOKING_SECRET_SCHOOLY.
 * Le fallback SEJOURA conserve la configuration historique sans exposer
 * de secret dans les annonces.
 */
export function getPartnerBookingSecret(providerName: string): string | null {
  const suffix = providerName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!suffix) return null;

  const scopedSecret = process.env[`TROUVETOU_BOOKING_SECRET_${suffix}`]?.trim();
  if (scopedSecret) return scopedSecret;

  if (suffix === "SEJOURA") {
    return process.env.TROUVETOU_BOOKING_SHARED_SECRET?.trim() || null;
  }

  return null;
}

export function buildPartnerBookingHeaders(secret: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-trouvetou-booking-secret": secret,
  };
}
