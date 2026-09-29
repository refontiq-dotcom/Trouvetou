// ============================================================================
// TROUVETOU — Contexte d'exécution d'un appel provider
//
// Ce que l'adapter reçoit pour effectuer un appel. Il ne contient AUCUN nom de
// SaaS : c'est ce qui permet d'exécuter le même `BookingService` contre un
// hôtel, un restaurant ou un transport.
//
// SÉCURITÉ — LE POINT SENSIBLE DE CE FICHIER
//
// `credentials` porte un secret. Trois règles s'imposent :
//
//   1. Il n'est jamais journalisé. `ProviderContext` n'a pas de `toJSON`, et
//      `redactContext()` est fourni pour le faire explicitement plutôt que
//      par oubli.
//   2. Il ne quitte jamais le serveur : il n'est jamais renvoyé au client.
//   3. Il n'est pas serialisable au-delà du besoin de l'adapter, ce qui évite
//      qu'il finisse dans un `JSON.stringify` de diagnostic.
//
// Le nom est volontairement GÉNÉRIQUE (`apiKey`) : c'est le rôle qui compte,
// pas le produit qui fournit la valeur. Un `sejoura_api_key` dans ce fichier
// serait exactement le couplage que la refonte supprime.
// ============================================================================

/**
 * Secret d'authentification du provider.
 *
 * Un seul secret est nécessaire aujourd'hui. Le jour où un fournisseur
 * exigera OAuth, ce type gagnera un `accessToken` optionnel sans que le core
 * change : c'est l'adapter qui décide comment l'obtenir à partir de cette
 * structure.
 */
export interface ProviderCredentials {
  apiKey: string;
}

/**
 * Ce que le core sait de l'annonce, sans rien savoir du métier du provider.
 *
 * `externalId` est l'identifiant de la ressource chez le fournisseur. SA FORME
 * EST L'AFFAIRE DE L'ADAPTER : le core le transmet tel quel sans l'interpréter,
 * pour qu'un `rt:uuid` d'hôtellerie et un `tbl_42` de restauration
 * cohabitent sans que le core ait à le savoir.
 */
export interface ProviderListingRef {
  /** Identifiant interne de l'annonce dans TrouveTout. */
  listingId: string;
  /** Identifiant de la ressource chez le fournisseur, non interprété. */
  externalId: string;
  /** Prix de référence catalogue, en FCFA. Peut servir de repli de devis. */
  basePrice: number | null;
}

/**
 * Contexte complet transmis à l'adapter.
 *
 * `requestContext` transporte les métadonnées de la requête entrante (IP
 * client, identifiant de trace) pour que l'adapter puisse, s'il le souhaite,
 * les propager. Il ne contient aucun secret et ne sert à rien d'autre.
 */
export interface ProviderContext {
  providerId: string;
  listing: ProviderListingRef;
  credentials: ProviderCredentials;
  requestContext?: Readonly<Record<string, unknown>>;
}

/**
 * Copie du contexte SANS les secrets, pour logs et diagnostics.
 *
 * À utiliser dans tout `console.error` ou trace: passer l'objet entier
 * reviendrait à écrire la clé en clair dans les logs de production, ce qui est
 * le défaut le plus facile à introduire et le plus coûteux à corriger.
 */
export function redactContext(context: ProviderContext): Record<string, unknown> {
  return {
    providerId: context.providerId,
    listing: {
      listingId: context.listing.listingId,
      externalId: context.listing.externalId,
      basePrice: context.listing.basePrice,
    },
    // Présence de la clé sans sa valeur.
    credentials: { apiKey: "[redacted]" },
    requestContext: context.requestContext,
  };
}