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

/** Adapters connus, indexés par identifiant technique. */
const registry = new Map<string, ProviderAdapter>();

/**
 * Enregistre un adapter.
 *
 * Un doublon est une erreur de programmation, pas un cas d'exécution : deux
 * connecteurs ne peuvent pas revendiquer le même identifiant, sinon la
 * résolution deviendrait silencieusement dépendante de l'ordre de chargement
 * des modules.
 */
export function registerAdapter(adapter: ProviderAdapter): void {
  if (registry.has(adapter.id)) {
    throw new Error(`Un adapter "${adapter.id}" est déjà enregistré.`);
  }
  registry.set(adapter.id, adapter);
}

/** Adapter d'un provider, ou `null` s'il n'est pas connecté. */
export function findAdapter(providerType: string): ProviderAdapter | null {
  return registry.get(providerType) ?? null;
}

/** `true` si le provider possède un connecteur enregistré. */
export function hasAdapter(providerType: string): boolean {
  return registry.has(providerType);
}

/** Identifiants de tous les connecteurs enregistrés. */
export function listAdapterIds(): string[] {
  return [...registry.keys()];
}

/** Vide le registre. Réservé aux tests : le registre est sinon immuable. */
export function resetRegistry(): void {
  registry.clear();
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