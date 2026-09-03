// ============================================================================
// TROUVETOU ↔ SCHOOLY — Types du contrat API partenaire
//
// Ces types reflètent fidèlement le contrat documenté dans
// https://github.com/refontiq-dotcom/schooly (TROUVETOU_INTEGRATION.md) et les
// routes /api/trouvetou/* du dépôt Schooly.
//
// Toute modification côté Schooly DOIT être répercutée ici.
// ============================================================================

/** Catégorie de l'annonce (réservée à `ecoles` côté Schooly). */
export type SchoolyCategory = "ecoles";

/** Disponibilité d'un niveau pour un établissement donné. */
export interface SchoolyLevelAvailability {
  level_id: string;
  establishment_id: string;
  level_name: string;
  total_capacity: number;
  total_taken: number;
  seats_available: number;
}

/** Publicité active sur la période en cours. */
export interface SchoolyAdvertisement {
  id: string;
  establishment_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_url: string | null;
  starts_at: string;
  ends_at: string | null;
}

/** Établissement scolaire publié sur Trouvetou. */
export interface SchoolyEstablishment {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  school_type: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  cover_image_url: string | null;
  reservation_fee_amount: number | null;
  category: SchoolyCategory;
  availability: SchoolyLevelAvailability[];
  advertisements: SchoolyAdvertisement[];
}

/** Réponse de `GET /api/trouvetou` (catalogue). */
export interface SchoolyCatalog {
  establishments: SchoolyEstablishment[];
}

/**
 * Statut d'une réservation Schooly.
 * `pending_payment` est l'état initial après création côté Trouvetou ;
 * Schooly applique la transition `pending_payment` → `reserved` via la
 * confirmation de paiement.
 */
export type SchoolyReservationStatus =
  | "pending_payment"
  | "reserved"
  | "confirmed"
  | "expired"
  | "cancelled"
  | "rejected_fraud"
  | "waitlisted";

/** Réservation telle que renvoyée par Schooly. */
export interface SchoolyReservation {
  id: string;
  status: SchoolyReservationStatus;
  qr_code_token: string | null;
  expires_at: string | null;
  [key: string]: unknown;
}

/** Charge utile pour la création d'une réservation (`POST /api/trouvetou`). */
export interface SchoolyCreateReservationPayload {
  establishment_id: string;
  level_id: string;
  student_full_name: string;
  parent_full_name: string;
  parent_phone: string;
  student_birthdate?: string | null;
  parent_email?: string | null;
}

/** Charge utile pour la confirmation de paiement. */
export interface SchoolyConfirmPaymentPayload {
  payment_reference: string;
  amount_paid: number;
}

/** Erreur normalisée renvoyée par le client. */
export class SchoolyApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string = "SCHOOLY_ERROR") {
    super(message);
    this.name = "SchoolyApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Erreur levée lorsque la configuration côté Trouvetou est incomplète.
 * Le code appelant doit afficher un fallback (catalogue générique) et
 * journaliser l'incident côté serveur.
 */
export class SchoolyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchoolyConfigError";
  }
}
