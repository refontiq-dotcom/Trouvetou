// ============================================================================
// TROUVETOUT — Résolution du scope d'intégration d'un POST /api/v1/sync
// ============================================================================
// Phase 2D.39.
//
// LE PRINCIPE
//
// `provider` est une CONNEXION SaaS, pas un tenant. Une même connexion
// (provider `a510`) sert plusieurs tenants Séjour@ : c'est le SCOPE qui
// dit « cette credential agit au nom de CE tenant ».
//
// L'AUTORITÉ EST LA CREDENTIAL, JAMAIS LE PAYLOAD
//
// Un client peut déclarer `"tenant_ref": "…"` dans son corps de requête.
// Cette valeur est une ASSERTION DE COHÉRENCE : elle est comparée au scope
// authentiqué, et un écart vaut 403. Elle ne peut jamais élargir
// l'autorisation — un tenant A ne peut pas écrire chez B en l'annonçant.
//
// CLOISONNEMENT
//
//  credential → provider (via l'UUID en clair de la clé)
//   credential → credential_hash → scope → tenant_ref
//
// Ce module ne connaît aucun secret en clair : il ne manipule que des
// empreintes HMAC, jamais la clé elle-même.
// ============================================================================

import { hashApiKey } from "@/lib/sync/api-key";

/**
 * Sous-ensemble du client Supabase nécessaire à la résolution.
 *
 * `rpc` renvoie `unknown` : la forme de la réponse est portée par la fonction
 * SQL, pas par le client. Le cast est donc assumé et localisé ici.
 */
export interface ScopeAdminLike {
  rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
}

/** Réponse de `resolve_integration_scope`, telle que la fonction la définit. */
interface ScopeRpcResult {
  data: unknown;
  error: unknown;
}

export type ScopeType = "GLOBAL" | "TENANT";

/**
 * Portée effective d'un POST, une fois l'authentification établie.
 *
 * `tenant_ref` est non-null EXACTEMENT pour un scope TENANT : c'est cette
 * garantie que le soft-removal borné consomme.
 */
export interface ResolvedScope {
  scopeId: string;
  scopeType: ScopeType;
  tenantRef: string | null;
}

/**
 * Erreur d'autorisation. Distincte d'une erreur d'authentification :
 * 401 = « qui êtes-vous ? », 403 = « votre scope ne permet pas cela ».
 */
export class ScopeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ScopeError";
    this.status = status;
    this.code = code;
  }
}

/** Empreinte d'une credential — jamais la credential. */
export function credentialFingerprint(apiKey: string): string {
  return hashApiKey(apiKey);
}

export interface ResolveScopeParams {
  admin: ScopeAdminLike;
  /** Provider déjà authentifié. */
  providerId: string;
  /** Clé brute présentée dans l'en-tête. */
  apiKey: string;
  /**
   * `tenant_ref` annoncé par le client, s'il en transmet un.
   *
   * Ce n'est PAS une source d'autorité : c'est une assertion que l'on
   * confronte au scope. Toute incohérence est un 403, jamais un ajustement.
   */
  claimedTenantRef?: string | null;
}

/**
 * Résout le scope d'un POST authentifié.
 *
 * ORDRE DE VÉRIFICATION (fail-closed, chaque étape peut lever un ScopeError) :
 *
 *   1. la credential correspond-elle à un enregistrement ACTIF ?
 *   2. ce scope est-il rattaché à CE provider ?        → 403 sinon
 *   3. le scope est-il actif ?                          → 403 sinon
 *   4. un tenant est-il annoncé ? alors le scope doit être TENANT → 403 sinon
 *   5. le tenant annoncé correspond-il au scope ?        → 403 sinon
 *
 * Le tenant retourné vient TOUJOURS du scope authentifié. Le payload n'a
 * aucune capacité de le modifier.
 */
export async function resolveScope(params: ResolveScopeParams): Promise<ResolvedScope> {
  const { admin, providerId, apiKey, claimedTenantRef } = params;

  const fingerprint = credentialFingerprint(apiKey);

  const { data, error } = (await admin.rpc("resolve_integration_scope", {
    p_provider_id: providerId,
    p_credential_hash: fingerprint,
  })) as ScopeRpcResult;

  if (error) {
    throw new ScopeError(
      500,
      "SCOPE_LOOKUP_FAILED",
      "Impossible de résoudre le scope d'intégration.",
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        scope_id?: string | null;
        scope_type?: string | null;
        tenant_ref?: string | null;
        scope_is_active?: boolean | null;
        provider_matches?: boolean | null;
      }
    | null
    | undefined;

  // Aucune credential connue → authentification refusée.
  if (!row || !row.scope_id) {
    throw new ScopeError(
      401,
      "UNKNOWN_CREDENTIAL",
      "Credential inconnue ou révoquée.",
    );
  }

  // La credential existe mais pour un AUTRE provider : ne rien révéler de plus.
  if (row.provider_matches === false) {
    throw new ScopeError(
      403,
      "SCOPE_PROVIDER_MISMATCH",
      "Cette credential n'est pas autorisée pour ce provider.",
    );
  }

  if (row.scope_is_active === false) {
    throw new ScopeError(
      403,
      "SCOPE_INACTIVE",
      "Le scope d'intégration est désactivé.",
    );
  }

  const scopeType: ScopeType = row.scope_type === "TENANT" ? "TENANT" : "GLOBAL";
  const scopeTenant = row.tenant_ref ?? null;

  // Un tenant annoncé sur un scope GLOBAL : le client tente d'élargir.
  if (claimedTenantRef && scopeType !== "TENANT") {
    throw new ScopeError(
      403,
      "SCOPE_TYPE_MISMATCH",
      "Cette credential est de portée globale : elle ne peut pas porter de tenant.",
    );
  }

  // Assertion de cohérence — jamais une source d'autorité.
  if (claimedTenantRef && claimedTenantRef !== scopeTenant) {
    throw new ScopeError(
      403,
      "SCOPE_TENANT_MISMATCH",
      "Le tenant déclaré ne correspond pas au scope authentifié.",
    );
  }

  return {
    scopeId: row.scope_id,
    scopeType,
    tenantRef: scopeTenant,
  };
}

/**
 * Le scope permet-il de CRÉER un listing ?
 *
 * Un scope GLOBAL est une compatibilité legacy : il peut mettre à jour ce
 * qui existe, mais ne crée pas de listing orphelin. Un listing créé sans
 * `tenant_ref` échouerait à toute tentative de soft-removal ultérieur — il
 * deviendrait indéfini. Le refus est donc explicite, jamais silencieux.
 */
export function canCreateListing(scope: ResolvedScope): boolean {
  return scope.scopeType === "TENANT" && scope.tenantRef !== null;
}