// ============================================================================
// TROUVETOU — Service générique de réservation
//
// CE QUE CE SERVICE NE CONNAÎT, ET NE CONNAÎTRA PAS
//
//   aucune URL de SaaS, aucun `room_type_id`, aucun `/api/v1/external/…`,
//   aucun nom de secret propriétaire.
//
// Il orchestre : il vérifie les capacités, résout le connecteur, transmet la
// demande, propage le résultat. Toute la traduction métier est dans l'adapter.
//
// Ce service n'est ENCORE PAS branché à une route de production. Le chemin de
// chemin de réservation existant (`/api/catalog/bookings`) fonctionne toujours
// sans passer par ici ; le branchement est l'étape suivante, avec ses tests de
// non-régression. Voir `docs/` ou le rapport de phase pour le détail.
// ============================================================================

import { BookingError, isBookingError } from "./errors";
import type {
  BookingCancellation,
  BookingConfirmation,
  BookingQuote,
  BookingRequest,
  ProviderAdapter,
  ProviderCapabilities,
} from "@/lib/providers/contract";
import type { ProviderContext } from "@/lib/providers/context";
import { requireAdapter } from "@/lib/providers/registry";

/** Opérations exposées par le service, alignées sur le vocabulaire métier. */
export type BookingOperation = "quote" | "create" | "cancel";

/**
 * Exécute une opération de réservation auprès du provider d'une annonce.
 *
 * @param providerType Identifiant technique du connecteur (`sejoura`, …).
 * @param operation    Opération demandée.
 * @param context      Contexte provider, SECRET INCLUS. Ne jamais journaliser.
 * @param request      Demande générique. Ignorée par `cancel`.
 * @param bookingId    Identité de réservation. Exigée par `cancel`.
 */
export async function executeBooking(
  providerType: string,
  operation: BookingOperation,
  context: ProviderContext,
  request?: BookingRequest,
  bookingId?: string
): Promise<BookingQuote | BookingConfirmation | BookingCancellation> {
  // Les arguments de la requête sont validés AVANT la capacité. Un caller qui
  // envoie une demande mal formée doit connaître la cause réelle (« booking_id
  // manquant »), pas être renvoyé vers « ce provider ne gère pas
  // l'annulation » : ce second message le ferait corriger le mauvais problème.
  const validatedBookingId = operation === "cancel" ? requireBookingId(bookingId) : undefined;
  const validatedRequest = operation === "cancel" ? undefined : requireRequest(request);

  const adapter = requireAdapter(providerType);

  // La capacité est vérifiée AVANT l'appel : un adapter sans annulation ne
  // doit jamais recevoir une demande d'annulation, même en interne.
  assertCapability(adapter, operation);

  try {
    switch (operation) {
      case "quote":
        return await adapter.quote(validatedRequest as BookingRequest, context);
      case "create":
        return await adapter.create(validatedRequest as BookingRequest, context);
      case "cancel":
        return await adapter.cancel(validatedBookingId as string, context, null);
    }
  } catch (error: unknown) {
    // Un adapter qui laisse fuiter une erreur brute (réseau, parsing JSON)
    // ferait remonter un détail d'intégration jusqu'au client. On la traduit
    // en erreur métier uniforme, en gardant le détail pour les logs.
    if (isBookingError(error)) throw error;

    throw new BookingError(
      "upstream_unavailable",
      "PROVIDER_ERROR",
      "Le service de réservation est momentanément indisponible.",
      502
    );
  }
}

/**
 * Refuse une opération non supportée par le provider.
 *
 * L'erreur est EXPLICITE (`capability_unsupported`) : elle permet au frontend
 * de masquer le bouton « Réserver » au lieu d'afficher un échec après clic.
 * C'est la différence entre une absence de fonctionnalité et un bug.
 */
function assertCapability(adapter: ProviderAdapter, operation: BookingOperation): void {
  const required: keyof ProviderCapabilities =
    operation === "cancel" ? "cancellation" : "booking";

  if (adapter.capabilities[required]) return;

  throw new BookingError(
    "capability_unsupported",
    "CAPABILITY_UNSUPPORTED",
    operation === "cancel"
      ? "L'annulation en ligne n'est pas disponible pour cet établissement."
      : "La réservation en ligne n'est pas disponible pour cet établissement.",
    409
  );
}

function requireRequest(request: BookingRequest | undefined): BookingRequest {
  if (request === undefined) {
    throw new BookingError(
      "invalid_request",
      "MISSING_REQUEST",
      "Les détails de la réservation sont requis.",
      400
    );
  }
  return request;
}

/** `bookingId` est obligatoire pour annuler : l'adapter en a besoin pour appeler le provider. */
function requireBookingId(bookingId: string | undefined): string {
  if (typeof bookingId !== "string" || bookingId.trim() === "") {
    throw new BookingError(
      "invalid_request",
      "MISSING_BOOKING_ID",
      "L'identifiant de la réservation est requis.",
      400
    );
  }
  return bookingId;
}