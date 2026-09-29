// ============================================================================
// TROUVETOU — Erreurs du cœur générique de réservation
//
// Ces types sont VOLONTAIREMENT agnostiques : aucun nom de SaaS, aucun
// détail d'API propriétaire. Un adapter les élève en traduisant la réponse de
// son fournisseur vers ces codes, et le `BookingService` les propage au
// frontend sans jamais traduire à nouveau.
//
// POURQUOI DES CLASSES D'ERREUR PLUTÔT QUE DES CODES BRUTS
//
// Le code HTTP est la réponse HTTP. L'erreur métier est une information
// distincte : « la chambre n'est plus disponible » (conflit métier) et « le
// provider a refusé nos identifiants » (problème d'intégration) ne doivent pas
// être traités pareil. En encapsulant `kind` + `httpStatus` dans un objet, un
// adapter n'a plus à réinventer la correspondance, et le service peut
// décider sans lire la forme de la réponse amont.
// ============================================================================

/**
 * Nature de l'échec, indépendamment du fournisseur.
 *
 * `not_found` et `conflict` sont des résultats MÉTIER normaux (le client a
 * demandé l'annulation d'une réservation qui n'existe pas, ou des dates
 * devenues indisponibles entre-temps). `upstream_unavailable` et
 * `upstream_error` sont des pannes d'intégration. Les confondre ferait
 * afficher au voyageur « service indisponible » alors qu'il faut « plus de
 * chambres disponibles ».
 */
export type BookingErrorKind =
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "capability_unsupported"
  | "credentials_missing"
  | "upstream_unauthorized"
  | "upstream_unavailable"
  | "upstream_error";

/**
 * Erreur de réservation normalisée.
 *
 * `httpStatus` est proposals — c'est ce que le frontend reçoit si l'erreur
 * remonte jusqu'à une route. `message` est destiné à l'utilisateur final et
 * ne doit jamais contenir de détail d'intégration : ni URL, ni identifiant de
 * secret, ni corps de réponse brut du fournisseur (qui pourrait contenir des
 * données de tiers).
 */
export class BookingError extends Error {
  readonly kind: BookingErrorKind;
  readonly httpStatus: number;
  /** Code technique stable, à destination des logs et du support. */
  readonly code: string;

  constructor(kind: BookingErrorKind, code: string, message: string, httpStatus?: number) {
    super(message);
    this.name = "BookingError";
    this.kind = kind;
    this.code = code;
    this.httpStatus = httpStatus ?? DEFAULT_HTTP_STATUS[kind];
  }
}

/** Statut HTTP proposé par défaut pour chaque nature d'erreur. */
const DEFAULT_HTTP_STATUS: Record<BookingErrorKind, number> = {
  invalid_request: 400,
  not_found: 404,
  conflict: 409,
  capability_unsupported: 409,
  credentials_missing: 409,
  upstream_unauthorized: 409,
  upstream_unavailable: 502,
  upstream_error: 502,
};

/** Raccourci de test de type dans les `switch` et les assertions. */
export function isBookingError(value: unknown): value is BookingError {
  return value instanceof BookingError;
}

/**
 * Correspondance statut HTTP amont → nature d'erreur.
 *
 * Partagée par les adapters. 401/403 amont signifient « nos identifiants
 * provider sont refusés », ce qui côté client doit ressortir comme une
 * indisponibilité de la réservation (409) et non comme une panne réseau (502) :
 * réessayer ne sert à rien tant que la configuration n'est pas corrigée.
 */
export function classifyUpstreamStatus(status: number): BookingErrorKind {
  if (status === 401 || status === 403) return "upstream_unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  return "upstream_unavailable";
}