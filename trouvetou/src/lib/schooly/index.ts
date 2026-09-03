// ============================================================================
// TROUVETOU ↔ SCHOOLY — Barrel
//
// Réexporte le client, les types et la sonde de configuration. Import depuis
// `@/lib/schooly` (jamais directement depuis un sous-fichier) pour faciliter
// les refactors.
// ============================================================================

export {
  fetchSchoolyCatalog,
  createSchoolyReservation,
  confirmSchoolyReservationPayment,
  getSchoolyConfig,
  isSchoolyConfigured,
} from "./client";

export {
  SchoolyApiError,
  SchoolyConfigError,
  type SchoolyAdvertisement,
  type SchoolyCatalog,
  type SchoolyCategory,
  type SchoolyConfirmPaymentPayload,
  type SchoolyCreateReservationPayload,
  type SchoolyEstablishment,
  type SchoolyLevelAvailability,
  type SchoolyReservation,
  type SchoolyReservationStatus,
} from "./types";
