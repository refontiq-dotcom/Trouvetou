// ============================================================================
// TROUVETOU — Éligibilité à la réservation en ligne
//
// Source de vérité UNIQUE pour savoir si une annonce affiche (et peut ouvrir)
// le bouton « Réserver ». Avant, room-card / boosted-carousel utilisaient
// `room.category_slug` et le modal un autre calcul : un clic pouvait donc ne
// rien afficher, sans aucun message pour l'utilisateur.
// ============================================================================

/** Catégories dont la réservation « par nuit » a un sens. */
const BOOKABLE_CATEGORIES = new Set(["hotel", "residence"]);

/** Sous-ensemble de ListingView nécessaire au calcul (évite une dépendance). */
export interface BookableListing {
  category_slug: string | null | undefined;
  establishment?: { type?: string | null } | null;
}

/**
 * Slug effectif d'une annonce.
 *
 * L'établissement est prioritaire : c'est lui qui porte la vérité terrain
 * (un établissement peut être requalifié sans que le slug de l'annonce suive).
 * L'ancien code faisait déjà cette priorité côté carte, mais pas côté modal.
 */
export function resolveCategorySlug(listing: BookableListing): string {
  return listing.establishment?.type ?? listing.category_slug ?? "";
}

/** Un slug de catégorie donne-t-il droit à la réservation en ligne ? */
export function isBookableCategory(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return BOOKABLE_CATEGORIES.has(slug.trim().toLowerCase());
}

/** Cette annonce est-elle réservable en ligne ? (bouton + modal) */
export function isListingBookable(listing: BookableListing): boolean {
  return isBookableCategory(resolveCategorySlug(listing));
}
