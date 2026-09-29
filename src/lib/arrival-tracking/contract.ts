// ============================================================================

import type { ProviderContext } from "@/lib/providers/context";

// ============================================================================
// TROUVETOU — Contrat générique de suivi d'arrivée
// DOMAINE DISTINCT DE LA RÉSERVATION
//
// Le suivi d'arrivée répond à « où est le client ? », pas à « a-t-il
// réservé ? ». Un restaurant n'a aucun client qui voyage, un transporteur n'a
// aucune chambre : le suivi n'appartient donc PAS à `ProviderAdapter`. Il a
// son propre contrat, sa propre capacité et son propre registre.
//
// CE FICHIER NE CONNAÎT AUCUN FOURNISSEUR
//
// Aucun nom de logiciel, aucun endpoint, aucun format d'identifiant. Le core
// décrit une INTENTION ; l'adapter décide comment la réaliser.
//
// CONTRAT DE PASSE-THROUGH
//
// `TrackingResult` transporte volontairement la réponse BRUTE du fournisseur
// (`body: unknown`) et son statut HTTP d'origine. C'est un choix de
// compatibilité assumé : le suivi d'arrivée a toujours renvoyé au navigateur
// la réponse du fournisseur telle quelle, et le client en dépend. Normaliser
// cette charge utile casserait des intégrations externes vivantes.
//
// Conséquence à garder en tête : tant que ce contrat est un passe-through, un
// nouveau fournisseur DOIT exposer la même forme de réponse, ou l'API publique
// devra être versionnée. Le jour où le suivi mergera vers un modèle commun à
// tous les connecteurs, ce contrat pourra évoluer — pas avant.
// ============================================================================

/** Opérations de suivi exposées par un connecteur. */
export type TrackingOperation = "start" | "update" | "stop" | "status";

/**
 * Position transmise au fournisseur pendant un trajet.
 *
 * `accuracy` est optionnel : tous les appareils ne le fournissent pas, et
 * rendre le champ obligatoire ferait échouer des envois par ailleurs valides.
 */
export interface TrackingPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

/**
 * Ce que le fournisseur répond, transmis sans transformation.
 *
 * `body` est `unknown` et non un type métier : c'est la charge utile du
 * fournisseur, indéfinie par contrat. `status` est le code HTTP d'origine, à
 * restituer tel quel.
 */
export interface TrackingResult {
  status: number;
  body: unknown;
}

/** Paramètres communs aux quatre opérations. */
export interface TrackingRequest {
  /** Réservation suivie, identifiée chez le fournisseur. */
  bookingId: string;
  /**
   * Jeton de session de suivi.
   *
   * Émis par le fournisseur au démarrage, il est renvoyé au client et
   * présenté aux appels suivants. Ce n'est PAS un secret d'authentification :
   * la clé API reste côté serveur, dans le contexte provider.
   */
  publicToken?: string | null;
  /** Position courante, requise uniquement par `update`. */
  position?: TrackingPosition;
}

/**
 * Contrat implémenté par les connecteurs sachant suivre un client.
 *
 * Un connecteur sans suivi ne l'implémente pas du tout : l'absence dans le
 * registre EST l'information, pas un booléen `supportsTracking: false` qu'il
 * faudrait maintenir en plus.
 */
export interface ArrivalTrackingAdapter {
  /** Identifiant technique du fournisseur. Doit correspondre à celui du connecteur de réservation. */
  readonly providerType: string;

  /** Démarre le suivi. Peut renvoyer le jeton de session. */
  start(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult>;

  /** Transmets une position. */
  update(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult>;

  /** Arrête le suivi. */
  stop(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult>;

  /** État courant du suivi. */
  status(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult>;
}

/**
 * Contexte transmis à l'adapter de suivi.
 *
 * ALIAS de `ProviderContext`, pas un nouveau type : les deux domaines ont
 * besoin du même triplet provider / annonce / credentials. Réutiliser le type
 * existant garantit qu'une évolution future bénéficie aux deux contrats sans
 * duplication ni divergence — et évite d'ajouter au contexte générique des
 * données propres à un seul domaine.
 */
export type TrackingProviderContext = ProviderContext;
