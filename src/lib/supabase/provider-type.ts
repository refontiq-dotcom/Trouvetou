import type { Database } from "./database.types";

/**
 * Type technique du logiciel métier porté par `providers.type`.
 *
 * Dérivé du schéma généré plutôt que ré-exporté par `database.types.ts` :
 * le fichier est régénéré (`supabase gen types`) et ne produit pas d'alias
 * nommé pour les énumérations. Ce module est le point unique de dérivation,
 * pour que la prochaine régénération ne casse aucun import.
 */
export type ProviderType = Database["public"]["Enums"]["provider_type"];
