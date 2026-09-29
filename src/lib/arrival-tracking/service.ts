// ============================================================================
// TROUVETOU — Service générique de suivi d'arrivée
//
// ORCHESTRATION SEULE
//
// Le service ne connaît aucun fournisseur : il résout l'adapter via le
// registre, délègue l'opération et propage le résultat. Aucune URL, aucun nom
// de logiciel, aucun format de charge utile.
//
// Il ne lève pas non plus ses propres erreurs HTTP : le SUIVI EST UN
// PASSE-THROUGH. Une réponse du fournisseur — y compris son statut 4xx ou 5xx
// — est un résultat, pas une exception. Traduire un 409 fournisseur en 500
// interne masquerait au client une information utile.
//
// Seules les erreurs AVANT l'appel (provider non connecté) sont converties en
// `BookingError`, comme pour la réservation : c'est une absence de
// configuration côté TrouveTout, pas un incident chez le fournisseur.
// ============================================================================

import { isBookingError } from "@/lib/booking/errors";
import { requireTrackingAdapter } from "@/lib/providers/registry";
import type { ProviderContext } from "@/lib/providers/context";
import type { TrackingRequest, TrackingResult } from "./contract";

/**
 * Exécute une opération de suivi pour le provider d'une annonce.
 *
 * @param providerType Identifiant technique lu dans `providers.type`. Jamais
 *                     déduit d'un nom, d'une catégorie ou d'une URL.
 * @param operation    Verbe demandé.
 * @param request      Demande générique (réservation, jeton, position).
 * @param context      Contexte provider. Porte le secret, côté serveur.
 */
export async function executeTracking(
  providerType: string,
  operation: "start" | "update" | "stop" | "status",
  request: TrackingRequest,
  context: ProviderContext
): Promise<TrackingResult> {
  const adapter = requireTrackingAdapter(providerType);

  try {
    return await adapter[operation](request, context);
  } catch (error: unknown) {
    // Panne réseau ou adapter défaillant : l'appel n'a pas atteint le
    // fournisseur, donc il n'y a pas de statut amont à restituer. On renvoie
    // une erreur interne identifiée plutôt que de laisser remonter un détail
    // technique au client.
    if (isBookingError(error)) throw error;

    throw new TrackingTransportError();
  }
}

/**
 * Échec d'appel réseau, sans réponse du fournisseur.
 *
 * Le statut 502 est la convention déjà appliquée aux autres domaines : il dit
 * « la passerelle n'a pas pu joindre le service », ce qui distingue le cas d'un
 * refus métier remonté par le fournisseur avec son propre statut.
 */
export class TrackingTransportError extends Error {
  readonly status = 502;
  readonly code = "TRACKING_UNAVAILABLE";

  constructor() {
    super("Le service de suivi d'arrivée est momentanément indisponible.");
    this.name = "TrackingTransportError";
  }
}
