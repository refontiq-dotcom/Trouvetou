import { decryptCredential } from "./encryption";

// ============================================================================
// TROUVETOU — Résolution du credential SORTANT d'un provider
//
// SOURCE DE VÉRITÉ
//
// Ordre strict, du plus fiable au plus ancien :
//
//   1. `providers.outbound_api_key_encrypted` — source OFFICIELLE, chiffrée,
//      une seule fois par provider. Ne dépend d'aucune annonce.
//   2. `listings.attributes.sejoura_api_key`  — FALLBACK LEGACY, en clair,
//      dupliqué par annonce.
//
// POURQUOI LE FALLBACK EXISTE ENCORE
//
// Parce que la migration est PROGRESSIVE. Le backfill chiffre la valeur au
// niveau du provider ; tant qu'un provider n'a pas été backfillé, la lecture
// doit fonctionner. Retirer ce chemin ferait casser la réservation de tous les
// providers non migrés.
//
// Il est temporaire et sera supprimé quand une phase ultérieure aura vérifié
// que 100 % des providers concernés possèdent le credential officiel.
//
// RÈGLE ABSOLUE : PRIORITÉ AU PROVIDER
//
// Même si le listing porte une valeur legacy DIFFÉRENTE, c'est le credential
// du provider qui gagne. C'est ce qui rend la migration déterministe : le
// résultat ne dépend pas de l'annonce consultée.
//
// AUCUN FALLBACK DE TYPE
//
// Un provider `unknown` ou d'un autre type ne doit JAMAIS emprunter le
// credential d'un autre logiciel. La fonction ne connaît pas Séjour@ : elle
// reçoit une valeur déjà résolue par l'appelant, qui a, lui, le type.
//
// SÉCURITÉ
//
// Aucun secret n'est journalisé, renvoyé ou inclus dans un message d'erreur.
// L'erreur de déchiffrement est propagée telle quelle : elle décrit la panne
// sans rien révéler de réutilisable.
// ============================================================================

/**
 * Source brute du credential, telle que relue en base.
 */
export interface OutboundCredentialSources {
  /** Colonne `providers.outbound_api_key_encrypted`, si non vide. */
  encrypted: string | null;
  /** Attributs du listing, pour le repli legacy. */
  listingAttributes: Record<string, unknown> | null;
}

/**
 * Nom de l'attribut legacy dans `listings.attributes`.
 *
 * Constante isolée : c'est le dernier endroit du code applicatif où le nom
 * d'un produit apparaît. Il disparaîtra avec le fallback.
 */
const LEGACY_ATTRIBUTE_KEY = "sejoura_api_key";

/**
 * Résout le credential sortant d'un provider.
 *
 * @returns Le secret en clair, ou `null` si aucune source n'est exploitable.
 * @throws {CredentialEncryptionError} Si le credential officiel est présent mais
 *         illisible — on ne retombe JAMAIS silencieusement sur le legacy dans
 *         ce cas : ce serait masquer une panne de configuration par un secret
 *         périmé.
 */
export function resolveOutboundCredential(sources: OutboundCredentialSources): string | null {
  const encrypted = sources.encrypted;

  if (typeof encrypted === "string" && encrypted !== "") {
    return decryptCredential(encrypted);
  }

  const legacy = sources.listingAttributes?.[LEGACY_ATTRIBUTE_KEY];
  if (typeof legacy === "string" && legacy !== "") {
    return legacy;
  }

  return null;
}

/**
 * `true` si le credential provient du fallback legacy.
 *
 * Permet d'observer la migration en production sans jamais lire la valeur :
 * le support peut suivre l'avancement du backfill par ce seul indicateur.
 */
export function usesLegacyCredential(sources: OutboundCredentialSources): boolean {
  const encrypted = sources.encrypted;
  if (typeof encrypted === "string" && encrypted !== "") return false;

  const legacy = sources.listingAttributes?.[LEGACY_ATTRIBUTE_KEY];
  return typeof legacy === "string" && legacy !== "";
}
