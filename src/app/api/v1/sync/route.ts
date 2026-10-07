import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { safeHttpUrl, safeHttpUrlList } from "@/lib/http/url";
import { normalizePanoramaTour } from "@/types/panorama";
import {
  hashApiKey,
  parseProviderIdFromKey,
  secureCompare,
} from "@/lib/sync/api-key";
import {
  canCreateListing,
  resolveScope,
  ScopeError,
  type ResolvedScope,
  type ScopeAdminLike,
} from "@/lib/integration/scope";

/**
 * Nombre maximal d'images synchronisées par annonce.
 *
 * Reprend la limite appliquée jusqu'ici côté route, afin que ce durcissement
 * de sécurité n'introduise aucun changement de comportement sur la longueur
 * des galeries. La décision architecturale de conserver ou d'assouplir cette
 * limite est volontairement DIFFÉRÉE : la valeur est isolée ici pour être
 * modifiable en un seul endroit le jour où la question est tranchée.
 */
const MAX_SYNC_IMAGES = 4;

/**
 * Assainit les `attributes` d'une annonce avant écriture.
 *
 * Point de passage OBLIGATOIRE pour tout média externe stocké en JSONB :
 * `attributes` accepte n'importe quel objet, donc n'importe quelle URL. On
 * applique ici les mêmes règles de validation que pour `images`, aux champs
 * dont la valeur part dans le navigateur du visiteur :
 *
 *   - `panorama_tour`   → re-normalisé (scènes et URLs non http(s) écartées)
 *   - `panorama_360_url` / `cover_image_url` → validés par `safeHttpUrl`
 *
 * Tout AUTRE champ est conservé tel quel : `attributes` est l'espace
 * d'extension du cœur générique (lits/wifi, spécialités, niveaux scolaires…),
 * et le vider ici reviendrait à casser des providers qui l'utilisent déjà
 * correctement. Le durcissement progressif se fera champ par champ, jamais
 * par un rejet global.
 *
 * CREDENTIAL SORTANT — VOIR LA MIGRATION 20260929150000
 *
 * La protection contre la perte silencieuse du credential lors d'une
 * synchronisation N'EST PAS implémentée ici, mais dans `ingest_listings`.
 *
 * Raison : c'est la seule fonction qui dispose à la fois de la nouvelle
 * charge utile ET de la valeur déjà en base pour cette annonce. Cette
 * fonction, elle, prépare le payload AVANT l'upsert, sans connaître l'état
 * actuel. Y mettre la règle obligerait à relire la base une fois par annonce
 * et déplacerait la correction au mauvais endroit : la perte se produit
 * exactement dans le `ON CONFLICT ... DO UPDATE`, donc c est la qu elle doit
 * etre prevenuee.
 */
export function sanitizeSyncAttributes(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...input };

  if ("panorama_tour" in output) {
    const tour = normalizePanoramaTour(output.panorama_tour);
    // Un tour sans scène exploitable est retiré : le viewer n'a rien à
    // afficher et une entrée vide ferait croire à une visite disponible.
    output.panorama_tour = tour.scenes.length > 0 ? tour : null;
  }

  for (const key of ["panorama_360_url", "cover_image_url"] as const) {
    if (!(key in output)) continue;
    output[key] = safeHttpUrl(output[key]);
  }

  return output;
}

/**
 * TROUVETOU — API d'ingestion multi-sources
 *
 * Reçoit les annonces de Séjoura (hôtels) ou de tout autre logiciel métier
 * (PMS clinique, SIS école, ...), valide la clé API du provider puis exécute
 * un UPSERT atomique dans `listings` sur le couple (provider_id, external_id).
 *
 *   POST /api/v1/sync
 *   Authorization / x-trouvetou-api-key: tv_live_<providerId>.<secret>
 *   Content-Type: application/json
 *
 * ── CONTRAT : SNAPSHOT COMPLET ──────────────────────────────────────────────
 *
 * Un appel représente l'état COMPLET, à cet instant, des annonces publiques
 * que le provider veut exposer. Ce n'est PAS un PATCH : un champ omis est
 * traité comme absent, jamais comme « conserver l'ancienne valeur ». Le lot
 * est atomique (accepté ou rejeté en entier) et idempotent sur l'identité
 * `(provider_id, external_id)`.
 *
 * Cette route ne peut pas rendre un PATCH correct : `ingest_listings` applique
 * `attributes = EXCLUDED.attributes`, donc toute logique de merge devrait vivre
 * dans la fonction SQL, pas ici. C'est pourquoi aucun indicateur `partial` ou
 * `merge` n'existe — et ne doit pas être ajouté sans décision d'architecture.
 *
 * ⚠️  AVANT D'IMPLÉMENTER UN CONNECTEUR, LIRE : docs/sync-contract.md
 *
 *     Le document normatif détaille le contrat du payload (champs obligatoires
 *     et optionnels), la sémantique des champs omis, le sort des annonces
 *     absentes, et l'exception des credentials. L'implémenter sans le lire
 *     produira une perte de données silencieuse, pas une erreur visible.
 *
 * Les credentials techniques (`sejoura_api_key`) sont volontairement HORS du
 * miroir public : leur préservation en cas de snapshot partiel est gérée dans
 * `ingest_listings`, pas ici.
 */

export const runtime = "nodejs";

const MAX_ITEMS_PER_BATCH = 500;

interface SyncItem {
  external_id: string;
  title: string;
  description?: string | null;
  city?: string | null;
  base_price?: number | string | null;
  images?: string[] | null;
  attributes?: Record<string, unknown> | null;
  is_available?: boolean | null;
  category_slug?: string | null;
}

interface SyncPayload {
  items?: SyncItem[];
  /**
   * Portée DÉCLARÉE par le client.
   *
   * Ce n'est PAS une source d'autorité : elle est confrontée au scope
   * authentifié, et tout écart vaut 403. Un client qui déclare le tenant d'un
   * autre se voit refuser — il ne peut ni élargir son périmètre, ni écrire
   * chez autrui.
   */
  scope?: { tenant_ref?: string | null } | null;
}

/**
 * Trace un refus de scope dans `sync_logs`.
 *
 * Aucun secret n'est journalisé : ni la clé, ni son empreinte — seulement le
 * code d'erreur, qui suffit à diagnostiquer sans rien révéler.
 */
async function logAuthFailure(providerId: string, code: string): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    await admin.from("sync_logs").insert({
      provider_id: providerId,
      status: "error",
      items_count: 0,
      message: `SCOPE_DENIED: ${code}`,
      ip_address: null,
    });
  } catch {
    // Un journal ne doit jamais faire échouer une réponse d'autorisation.
  }
}

function jsonError(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, ...(code ? { code } : {}) },
    { status }
  );
}

function extractApiKey(req: NextRequest, body: SyncPayload): string | null {
  const fromHeader =
    req.headers.get("x-trouvetou-api-key") ??
    req.headers.get("x-api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    null;
  if (fromHeader) return fromHeader;
  return typeof body === "object" && body !== null && "api_key" in body
    ? String((body as unknown as { api_key: string }).api_key)
    : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = getAdminClient();
  if (!admin) {
    return jsonError(
      "Configuration serveur incomplète (TROUVETOU_SUPABASE_URL / TROUVETOU_SUPABASE_SERVICE_ROLE_KEY).",
      500,
      "SERVER_CONFIG"
    );
  }
  if (!process.env.TROUVETOU_API_KEY_PEPPER) {
    return jsonError(
      "Configuration serveur incomplète (TROUVETOU_API_KEY_PEPPER).",
      500,
      "SERVER_CONFIG"
    );
  }

  let payload: SyncPayload;
  try {
    payload = (await req.json()) as SyncPayload;
  } catch {
    return jsonError("Le corps de la requête doit être un JSON valide.", 400, "INVALID_JSON");
  }

  // 1. Récupération et validation de la clé API du provider
  const apiKey = extractApiKey(req, payload);
  if (!apiKey) {
    return jsonError(
      "Clé API manquante. Passez-la via l'en-tête 'x-trouvetou-api-key' ou le champ 'api_key'.",
      401,
      "MISSING_API_KEY"
    );
  }

  const providerId = parseProviderIdFromKey(apiKey);
  if (!providerId) {
    return jsonError("Format de clé API invalide.", 401, "INVALID_API_KEY_FORMAT");
  }

  const { data: directProvider, error: providerError } = await admin
    .from("providers")
    .select("id, name, category_id, api_key_hash, is_active")
    .eq("id", providerId)
    .maybeSingle();

  if (providerError) {
    return jsonError("Erreur interne lors de la validation du provider.", 500, "PROVIDER_LOOKUP");
  }

  const candidateHash = hashApiKey(apiKey);
  let provider = directProvider;
  let expectedHash = directProvider?.api_key_hash ?? null;

  // A legacy provider may still exist as an inactive database record after a
  // migration. In that case its active alias must be checked BEFORE returning
  // PROVIDER_INACTIVE so the legacy key can continue ingesting into the
  // canonical provider without recreating duplicate listings.
  const { data: alias, error: aliasError } = await admin
    .from("provider_api_key_aliases")
    .select("canonical_provider_id, api_key_hash, is_active")
    .eq("legacy_provider_id", providerId)
    .maybeSingle();

  if (aliasError) {
    return jsonError(
      "Erreur interne lors de la validation de la clé API.",
      500,
      "PROVIDER_ALIAS_LOOKUP"
    );
  }

  if (alias?.is_active && (!directProvider || directProvider.is_active === false)) {
    const { data: canonicalProvider, error: canonicalError } = await admin
      .from("providers")
      .select("id, name, category_id, api_key_hash, is_active")
      .eq("id", alias.canonical_provider_id)
      .maybeSingle();

    if (canonicalError) {
      return jsonError(
        "Erreur interne lors de la validation du provider canonique.",
        500,
        "CANONICAL_PROVIDER_LOOKUP"
      );
    }

    provider = canonicalProvider;
    expectedHash = alias.api_key_hash;
  }

  if (!provider) {
    return jsonError("Provider inconnu.", 401, "UNKNOWN_PROVIDER");
  }
  if (!provider.is_active) {
    return jsonError("Ce provider est désactivé.", 403, "PROVIDER_INACTIVE");
  }

  // 2. Vérification de l'empreinte HMAC (comparaison en temps constant)
  if (!expectedHash || !secureCompare(expectedHash, candidateHash)) {
    return jsonError("Clé API invalide.", 401, "INVALID_API_KEY");
  }

  // ── 2.bis RÉSOLUTION DU SCOPE D'INTÉGRATION ────────────────────────────
  //
  // Le provider est authentifié, mais ce n'est PAS lui qui dit quel tenant est
  // visé : c'est le SCOPE. Un même provider sert plusieurs tenants, et c'est la
  // credential qui porte cette distinction.
  //
  // Le `tenant_ref` éventuellement fourni par le client est une ASSERTION DE
  // COHÉRENCE : il est comparé au scope authentifié, et tout écart est un 403.
  // Il ne peut JAMAIS élargir l'autorisation.
  let scope: ResolvedScope;
  try {
    scope = await resolveScope({
      admin: admin as unknown as ScopeAdminLike,
      providerId: provider.id,
      apiKey,
      claimedTenantRef: payload.scope?.tenant_ref ?? null,
    });
  } catch (e) {
    if (e instanceof ScopeError) {
      await logAuthFailure(provider.id, e.code);
      return jsonError(e.message, e.status, e.code);
    }
    throw e;
  }

  // 3. Validation du payload
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) {
    return jsonError(
      "Le payload doit contenir un tableau 'items' non vide.",
      400,
      "EMPTY_PAYLOAD"
    );
  }
  if (items.length > MAX_ITEMS_PER_BATCH) {
    return jsonError(
      `Trop d'annonces dans un seul appel (max ${MAX_ITEMS_PER_BATCH}).`,
      413,
      "PAYLOAD_TOO_LARGE"
    );
  }

  const errors: string[] = [];
  const cleanItems = items.map((item, index) => {
    const externalId = typeof item.external_id === "string" ? item.external_id.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";

    if (!externalId) errors.push(`items[${index}].external_id est requis.`);
    if (!title) errors.push(`items[${index}].title est requis.`);

    // SÉCURITÉ — point d'entrée des médias externes.
    // Ces URLs sont stockées puis rendues dans `src`/`href` chez le visiteur.
    // On filtre par ALLOWLISTE http/https : `javascript:`, `data:` et URL
    // relatives sont écartés ici, à l'ingestion, donc ils n'atteignent JAMAIS
    // la base. Une URL invalide est retirée silencieusement plutôt que de faire
    // échouer tout le lot : une photo cassée ne doit pas empêcher la
    // publication d'une annonce par ailleurs valide.
    const images = safeHttpUrlList(item.images).slice(0, MAX_SYNC_IMAGES);

    const rawAttributes =
      item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)
        ? item.attributes
        : {};

    // Le tour 360° est re-normalisé : `normalizePanoramaTour` écarte toute
    // scène dont l'URL n'est pas http(s), donc un `javascript:` glissé dans
    // `attributes.panorama_tour` est éliminé avant écriture.
    const attributes = sanitizeSyncAttributes(rawAttributes);

    const basePrice =
      item.base_price === null ||
      item.base_price === undefined ||
      item.base_price === ""
        ? null
        : Number(item.base_price);

    return {
      external_id: externalId,
      title,
      description: item.description ?? null,
      city: item.city ?? null,
      base_price: basePrice !== null && Number.isFinite(basePrice) ? basePrice : null,
      images,
      attributes,
      is_available: item.is_available ?? true,
      category_slug: typeof item.category_slug === "string" ? item.category_slug.trim() : null,
    };
  });

  if (errors.length > 0) {
    return jsonError(errors.join(" "), 400, "INVALID_ITEMS");
  }

  // ── Garde cross-tenant ──────────────────────────────────────────────────────
  //
  // Pour chaque item, on relève le tenant déjà associé. Un item existant dont
  // le `tenant_ref` DIFFÈRE du scope est un refus (403) : le tenant A ne peut
  // pas réécrire le listing de B, même si ce listing partage son external_id.
  // `listing_tenant_scopes` est une table PRIVEE introduite par la migration
  // 2D.39 : absente de `database.types.ts` tant que la migration n'a pas ete
  // appliquee. Le cast est donc delimite a CET appel et Retire des que la
  // migration sera appliquee et les types regeneres.
  const privateAdmin = admin as unknown as {
    from(t: "listing_tenant_scopes"): {
      select(cols: string): {
        eq(col: string, val: unknown): {
          in(col: string, vals: readonly string[]): PromiseLike<{
            data: unknown;
            error: unknown;
          }>;
        };
      };
    };
  };

  const { data: scopedRows, error: scopedError } = await privateAdmin
    .from("listing_tenant_scopes")
    .select("tenant_ref, listings!inner(external_id)")
    .eq("provider_id", provider.id)
    .in("listings.external_id", cleanItems.map((item) => item.external_id));

  if (scopedError) {
    return jsonError("Vérification du routage tenant impossible.", 500, "SCOPE_ROUTING_LOOKUP_FAILED");
  }

  const tenantByExternalId = new Map<string, string>();
  for (const row of (scopedRows ?? []) as Array<{
    tenant_ref: string;
    listings: { external_id: string } | null;
  }>) {
    const externalId = (row.listings as { external_id?: string } | null)?.external_id;
    if (externalId) tenantByExternalId.set(externalId, row.tenant_ref);
  }

  for (const item of cleanItems) {
    const owner = tenantByExternalId.get(item.external_id);
    if (owner !== undefined && scope.tenantRef !== null && owner !== scope.tenantRef) {
      return jsonError(
        "Cette annonce appartient à un autre tenant du provider.",
        403,
        "CROSS_TENANT_CONFLICT",
      );
    }
  }

  // external_id connus et déjà routés : GLOBAL peut les mettre à jour, pas les créer.
  const existingScopedIds = new Set(tenantByExternalId.keys());

  // Un scope GLOBAL est une compatibilité legacy : il met à jour ce qui
  // existe, mais ne CRÉE pas de listing orphelin. Un listing sans `tenant_ref`
  // échouerait à tout soft-removal tenant-scoped ultérieur — il deviendrait
  // indéfini. Le refus est explicite, jamais silencieux.
  if (!canCreateListing(scope)) {
    const unknownExternalIds = cleanItems.filter((item) => !existingScopedIds.has(item.external_id));
    if (unknownExternalIds.length > 0) {
      return jsonError(
        "Portée globale : impossible de créer une annonce sans tenant. " +
          "Utilisez une credential de portée tenant.",
        403,
        "GLOBAL_CANNOT_CREATE",
      );
    }
  }

  // 4. UPSERT atomique (INSERT ... ON CONFLICT) via la fonction SQL `ingest_listings`
  //
  // `p_items` est déclaré `Json` par la signature RPC : le lot est déjà
  // normalisé (URLs filtrées, attributs sanitizés) et JSON-sérialisable —
  // le cast ne fait qu'aligner les types, sans assouplir la validation.
  // `p_tenant_ref` accepte `NULL` (portée GLOBAL) : `?? undefined` traduit
  // simplement `string | null` vers l'argument optionnel du générérateur.
  const { data, error: upsertError } = await admin.rpc("ingest_listings", {
    p_provider_id: provider.id,
    p_category_id: provider.category_id,
    p_items: cleanItems as unknown as Json,
    p_tenant_ref: scope.tenantRef ?? undefined,
  });

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

  if (upsertError) {
    const isPartial = /items\[\d+\]|external_id|title/.test(upsertError.message);
    await admin.from("sync_logs").insert({
      provider_id: provider.id,
      status: isPartial ? "partial" : "error",
      items_count: cleanItems.length,
      message: upsertError.message,
      ip_address: ipAddress,
    });
    return jsonError(`Échec de la synchronisation : ${upsertError.message}`, 400, "UPSERT_FAILED");
  }

  const inserted = Number(data?.[0]?.inserted ?? 0);
  const updated = Number(data?.[0]?.updated ?? 0);

  // 5. Soft-removal BORNÉ AU SCOPE.
  //
  // L'ancien code faisait `.eq("provider_id", …)` : sur un provider multi-tenant,
  // un POST du tenant A désactivait les listings de B. `apply_soft_removal`
  // porte le bornage dans la fonction SQL, seule à connaître le routage privé.
  const externalIds = cleanItems.map((item) => item.external_id);
  await (admin as unknown as {
    rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
  }).rpc("apply_soft_removal", {
    p_provider_id: provider.id,
    // NULL = portee GLOBAL : seuls les listings SANS routage tenant sont
    // concernes. Les listings scopes restent hors de portee de GLOBAL.
    p_tenant_ref: scope.tenantRef,
    p_external_ids: externalIds,
  });

  await admin.from("sync_logs").insert({
    provider_id: provider.id,
    status: "success",
    items_count: cleanItems.length,
    inserted,
    updated,
    ip_address: ipAddress,
  });

  return NextResponse.json({
    ok: true,
    provider: provider.name,
    processed: cleanItems.length,
    inserted,
    updated,
  });
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return jsonError("Méthode non autorisée. Utilisez POST /api/v1/sync.", 405, "METHOD_NOT_ALLOWED");
}
