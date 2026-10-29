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

// ============================================================================
// Action de contact pour les métiers NON réservables en ligne (école, clinique,
// restaurant, autre). Chaque métier a son intention propre : un parent veut une
// place, un patient un rendez-vous, un convive une table. Le libellé ET le
// message WhatsApp pré-rempli sont donc adaptés — sinon un bouton « Demander une
// place » qui envoie « je vous contacte » serait incohérent.
// ============================================================================

export interface ContactAction {
  /** Libellé du bouton (ex. « Demander une place »). */
  label: string;
  /** Message WhatsApp pré-rempli, selon le nom de l'annonce. */
  message: (name: string) => string;
}

const CONTACT_ACTIONS: Record<string, ContactAction> = {
  school: {
    label: "Demander une place",
    message: (name) =>
      `Bonjour, je souhaite demander une place dans votre établissement « ${name} ». ` +
      `Pourriez-vous me communiquer les conditions d'inscription et les places disponibles ? Merci.`,
  },
  clinic: {
    label: "Prendre RDV",
    message: (name) =>
      `Bonjour, je souhaite prendre rendez-vous au sein de « ${name} ». ` +
      `Quelles sont vos prochaines disponibilités ? Merci.`,
  },
  restaurant: {
    label: "Réserver une table",
    message: (name) =>
      `Bonjour, je souhaite réserver une table au restaurant « ${name} ». ` +
      `Pouvez-vous m'indiquer vos créneaux disponibles ? Merci.`,
  },
  other: {
    label: "Contacter",
    message: (name) =>
      `Bonjour, je vous contacte depuis Trouvetou à propos de « ${name} ».`,
  },
};

const DEFAULT_CONTACT_ACTION: ContactAction = CONTACT_ACTIONS.other;

/** Action de contact (libellé + message) adaptée au métier de l'annonce. */
export function getContactAction(slug: string | null | undefined): ContactAction {
  const key = (slug ?? "").trim().toLowerCase();
  return CONTACT_ACTIONS[key] ?? DEFAULT_CONTACT_ACTION;
}
