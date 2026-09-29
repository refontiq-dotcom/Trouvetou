// ============================================================================
// TROUVETOU — Résolution d'un connecteur
//
// Ce fichier ne contient qu'un registre en mémoire. Il n'est PAS un moteur
// de plugins : pas de chargement dynamique, pas de découverte, pas de
// cycle de vie. Un `Map` et deux méthodes.
//
// POURQUOI UN REGISTRE MALGRÉ UN SEUL ADAPTER
//
// Le but n'est pas l'extensibilité pour l'extensibilité (cf. §28 « ne pas
// sur-ingénier »), mais de supprimer une dépendance CONDITIONNELLE dans le
// core. Tant que le `BookingService` fait `if (providerId === X)`, il connaît
// X. Avec un registre, il ne connaît plus que des identifiants techniques.
//
// L'enregistrement est explicite et centralisé dans `registerBuiltinAdapters()`
// : ajouter un connecteur consiste à écrire un adapter et à l'enregistrer en
// une ligne, sans qu'aucun fichier du cœur soit modifié.
// ============================================================================

import { BookingError } from "@/lib/booking/errors";
import type { ProviderAdapter } from "./contract";
import type { ArrivalTrackingAdapter } from "@/lib/arrival-tracking/contract";

/**
 * Adapters de réservation, indexés par identifiant technique.
 *
 * Le registre est CLOISONNÉ PAR DOMAINE et non global. Un même provider peut
 * être connecté pour la réservation sans l'être pour le suivi d'arrivée (un
 * provider de restauration n'a pas de client qui voyage). Mélanger les deux
 * dans une seule `Map` rendrait l'absence ambiguë : impossible de distinguer
 * « pas connecté du tout » de « connecté, mais sans cette capacité ».
 *
 * Les deux `Map` partagent le même type de clé — l'identifiant technique lu
 * dans `providers.type` — donc ajouter un troisième domaine (disponibilité)
 * ne demandera qu'une troisième `Map` et trois méthodes, sans nouveau mécanisme.
 */
const bookingRegistry = new Map<string, ProviderAdapter>();
const trackingRegistry = new Map<string, ArrivalTrackingAdapter>();

/**
 * Enregistre un adapter.
 *
 * Un doublon est une erreur de programmation, pas un cas d'exécution : deux
 * connecteurs ne peuvent pas revendiquer le même identifiant, sinon la
 * résolution deviendrait silencieusement dépendante de l'ordre de chargement
 * des modules.
 */
export function registerAdapter(adapter: ProviderAdapter): void {
  if (bookingRegistry.has(adapter.id)) {
    throw new Error(`Un adapter "${adapter.id}" est déjà enregistré.`);
  }
  bookingRegistry.set(adapter.id, adapter);
}

/** Enregistre un adapter de suivi d'arrivée pour ce provider. */
export function registerTrackingAdapter(adapter: ArrivalTrackingAdapter): void {
  if (trackingRegistry.has(adapter.providerType)) {
    throw new Error(`Un adapter de suivi "${adapter.providerType}" est déjà enregistré.`);
  }
  trackingRegistry.set(adapter.providerType, adapter);
}

/** Adapter de réservation d'un provider, ou `null` s'il n'est pas connecté. */
export function findAdapter(providerType: string): ProviderAdapter | null {
  return bookingRegistry.get(providerType) ?? null;
}

/** Adapter de suivi d'un provider, ou `null` s'il ne sait pas suivre. */
export function findTrackingAdapter(providerType: string): ArrivalTrackingAdapter | null {
  return trackingRegistry.get(providerType) ?? null;
}

/** `true` si le provider possède un connecteur de réservation enregistré. */
export function hasAdapter(providerType: string): boolean {
  return bookingRegistry.has(providerType);
}

/** `true` si le provider sait suivre un client. */
export function hasTrackingAdapter(providerType: string): boolean {
  return trackingRegistry.has(providerType);
}

/** Identifiants de tous les connecteurs de réservation enregistrés. */
export function listAdapterIds(): string[] {
  return [...bookingRegistry.keys()];
}

/** Identifiants de tous les connecteurs de suivi enregistrés. */
export function listTrackingAdapterIds(): string[] {
  return [...trackingRegistry.keys()];
}

/** Vide les deux registres. Réservé aux tests : ils sont sinon immuables. */
export function resetRegistry(): void {
  bookingRegistry.clear();
  trackingRegistry.clear();
}

/**
 * Résolution stricte : lève si le provider n'est pas connecté.
 *
 * Distingue deux situations que le message doit séparer pour que le support
 * puisse agir : « aucun connecteur pour ce type » (il faut en développer un)
 * et « le provider n'existe pas en base » (il faut l'enregistrer). La seconde
 * est traitée en amont par le `BookingService`, qui connaît la base.
 */
export function requireAdapter(providerType: string): ProviderAdapter {
  const adapter = findAdapter(providerType);
  if (adapter === null) {
    throw new BookingError(
      "capability_unsupported",
      "PROVIDER_NOT_CONNECTED",
      "Ce service n'est pas encore disponible pour cet établissement.",
      409
    );
  }
  return adapter;
}

/**
 * Résolution stricte de l'adapter de suivi.
 *
 * Aucun repli n'est possible : un `providerType` absent du registre de suivi
 * signifie que ce logiciel métier ne sait pas suivre ses clients. Résoudre
 * « tant pis, Séjour@ » enverrait des positions vers le mauvais PMS, ce qui
 * est pire qu'un refus.
 */
export function requireTrackingAdapter(providerType: string): ArrivalTrackingAdapter {
  const adapter = findTrackingAdapter(providerType);
  if (adapter === null) {
    throw new BookingError(
      "capability_unsupported",
      "PROVIDER_NOT_CONNECTED",
      "Le suivi d'arrivée n'est pas disponible pour cet établissement.",
      409
    );
  }
  return adapter;
}