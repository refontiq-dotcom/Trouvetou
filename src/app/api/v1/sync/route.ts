import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { safeHttpUrl, safeHttpUrlList } from "@/lib/http/url";
import { normalizePanoramaTour } from "@/types/panorama";
import {
  hashApiKey,
  parseProviderIdFromKey,
  secureCompare,
} from "@/lib/sync/api-key";

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

  // 4. UPSERT atomique (INSERT ... ON CONFLICT) via la fonction SQL `ingest_listings`
  const { data, error: upsertError } = await admin.rpc("ingest_listings", {
    p_provider_id: provider.id,
    p_category_id: provider.category_id,
    p_items: cleanItems,
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

  // 5. Soft-removal : toute annonce du provider absente du lot courant devient
  // indisponible (elle disparaît du catalogue public sans être supprimée,
  // l'historique reste consultable).
  const externalIds = cleanItems.map((item) => item.external_id);
  if (externalIds.length > 0) {
    await admin
      .from("listings")
      .update({ is_available: false })
      .eq("provider_id", provider.id)
      .filter("external_id", "not.in", `(${externalIds.join(",")})`);
  }

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
