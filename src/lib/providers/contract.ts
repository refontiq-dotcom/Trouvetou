// ============================================================================
// TROUVETOU — Contrat fournisseur générique
//
// Ce fichier ne connaît AUCUN logiciel métier. Il ne contient ni URL, ni
// schéma de payload, ni concept de « type de chambre » : uniquement des
// notions valables pour l'hôtellerie, la restauration, le transport, les
// services et le commerce.
//
// PRINCIPE
//
//   TrouveTout orchestre, le SaaS métier décide.
//   Le core parle en « séjour » ; l'adapter traduit en « nuit ».
//
// `StayDates` est le point de friction assumé : une réservation d'hôtel se
// décrit par un intervalle de dates, alors qu'une réservation de restaurant se
// décrit par un créneau et qu'un transport par un trajet. Plutôt que de
// multiplier les contrats (`HotelBookingAdapter`, `RestaurantBookingAdapter`,
// `TransportBookingAdapter`… tous identiques sauf les dates), le contrat générique
// expose un `schedule` libre, et chaque adapter impose ses propres contraintes
// à l'ingestion. Un seul contrat couvre les cinq secteurs ; les deux seules
// notions non optionnelles sont la période et le nombre de personnes, que tout
// service réservable partage.
// ============================================================================

/**
 * Période de la réservation, exprimée en dates ISO (YYYY-MM-DD).
 *
 * `checkOut` est optionnel : un service qui n'a pas de notion de fin (une
 * séance de kinésithérapie, une course) n'a qu'une date. Un hôtelier l'exige,
 * et c'est son adapter qui le valide.
 */
export interface StaySchedule {
  /** Date de début, incluse. */
  startDate: string;
  /** Date de fin, exclue. Absente = service ponctuel. */
  endDate?: string | null;
}

/** Personne à l'origine de la demande. Aucun stockage côté TrouveTout. */
export interface BookingGuest {
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

/**
 * Contenu et options demandés par l'utilisateur.
 *
 * `items` reste générique (`[itemId, label?, quantity?]`) : « une chambre »,
 * « une table de 4 », « un siège », « une prestation » sont tous une ligne de
 * commande. C'est l'adapter qui sait ce qu'un `itemId` désigne chez son
 * fournisseur.
 */
export interface BookingRequest {
  schedule: StaySchedule;
  partySize: number;
  items: BookingRequestItem[];
  notes?: string | null;
  guest: BookingGuest;
}

/** Ligne demandée, sans sémantique métier. */
export interface BookingRequestItem {
  itemId: string;
  label?: string | null;
  quantity?: number | null;
}

/** Devis / disponibilité, avec la source du montant quand elle est connue. */
export interface BookingQuote {
  available: boolean;
  /** Nombre d'unités encore réservables, ou `null` si le fournisseur ne le dit pas. */
  availabilityCount: number | null;
  /** Devis total. `null` = le fournisseur ne chiffre pas. */
  totalAmount: number | null;
  currency: string;
  /**
   * Le montant provient-il du fournisseur (PMS) ou a-t-il été estimé par
   * TrouveTout ?
   *
   * Cette distinction est un enjeu de CONFIANCE, pas de confort : le montant
   * encaissé doit venir de la source de vérité du métier. Un total estimé ne
   * doit jamais être présenté à l'utilisateur comme un devis ferme.
   */
  amountSource: "provider" | "estimated";
  /**
   * Référence de la ressource devisée, telle que le fournisseur la désigne.
   *
   * Question posée : « sur quoi porte ce devis ? ». Un hôtelier répond « le type
   * de chambre 42 », une agence de voyage « le vol AF1234 », un restaurant « la
   * table de 4 personnes ». Le core ne connaît aucun de ces concepts : il
   * transporte l'IDENTIFIANT opaque et le restitue tel quel.
   *
   * Cette valeur alimente le champ historique `room_type_id` de la réponse
   * publique de `check`. C'est un nom de COLONNE_HTTP historique, pas un
   * concept métier du cœur : la route ne fait que le renommer, elle ne
   * l'interprète jamais.
   */
  resourceRef: string | null;
  /** Infos libres et non sensibles fournies par le fournisseur. */
  details?: Record<string, unknown> | null;
}

/** Réservation créée, telle que le fournisseur la décrit. */
export interface BookingConfirmation {
  /** Identifiant de la réservation CHEZ LE FOURNISSEUR, réutilisé pour annuler. */
  bookingId: string;
  status: string;
  totalAmount?: number | null;
  currency?: string | null;
  details?: Record<string, unknown> | null;
}

/** Résultat d'une annulation. */
export interface BookingCancellation {
  status: string;
  /**
   * Réservation telle que le fournisseur la décrit APRÈS annulation.
   *
   * Conservée pour que la route puisse restituer la réponse historique, qui
   * exposait un objet `booking`. Le core transporte l'objet opaque du
   * fournisseur sans en connaître les champs.
   */
  details?: Record<string, unknown> | null;
}

// ============================================================================
// CONTRAT D'ADAPTER
// ============================================================================

import type { ProviderContext } from "./context";

/**
 * Ce qu'un fournisseur sait faire.
 *
 * Seule la réservation est implémentée à ce jour, mais la déclaration des
 * autres capacités est VOLONTAIRE : c'est elle qui empêche un
 * `RestaurantAdapter` sans annulation d'hériter d'un `cancelBooking` qui ne
 * ferait rien. Le `BookingService` refuse l'appel AVANT d'atteindre l'adapter.
 */
export interface ProviderCapabilities {
  booking: boolean;
  cancellation: boolean;
  /**
   * Le provider sait-il suivre un client qui voyage vers lui ?
   *
   * Vrai pour un hôtel ou un transporteur, faux pour un restaurant ou une
   * clinique : le suivi GPS n'a de sens que là où le client se déplace.
   *
   * Cette capacité est interrogée par l'`ArrivalTrackingService` via le
   * REGISTRE, qui ne contient un adapter que si le provider sait suivre. Le
   * booléen documente la même réalité à un niveau lisible, sans créer une
   * source de vérité concurrente.
   */
  arrivalTracking: boolean;
}

/**
 * Contrat implémenté par chaque connecteur métier.
 *
 * Les méthodes sont `async` sans exception, même celles triviales : un
 * connecteur distant l'est toujours, et cela évite au `BookingService` de
 * connaître la nature de l'implémentation.
 *
 * Les méthodes DOIVENT lever une `BookingError` (voir `errors.ts`) et ne
 * doivent jamais propager une erreur HTTP brute du fournisseur : c'est
 * l'adapter qui traduit, pour que le core n'ait rien à traduire.
 */
export interface ProviderAdapter {
  /** Identifiant technique du connecteur. Jamais un nom commercial. */
  readonly id: string;

  /** Capacités déclarées, interrogables SANS appeler l'adapter. */
  readonly capabilities: ProviderCapabilities;

  /** Disponibilité et devis. */
  quote(request: BookingRequest, context: ProviderContext): Promise<BookingQuote>;

  /** Création de la réservation. */
  create(request: BookingRequest, context: ProviderContext): Promise<BookingConfirmation>;

  /** Annulation. À appeler uniquement si `capabilities.cancellation` est vrai. */
  cancel(bookingId: string, context: ProviderContext, reason?: string | null): Promise<BookingCancellation>;
}
