import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  hashApiKey,
  parseProviderIdFromKey,
  secureCompare,
} from "@/lib/sync/api-key";

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

  const { data: provider, error: providerError } = await admin
    .from("providers")
    .select("id, name, category_id, api_key_hash, is_active")
    .eq("id", providerId)
    .maybeSingle();

  if (providerError) {
    return jsonError("Erreur interne lors de la validation du provider.", 500, "PROVIDER_LOOKUP");
  }
  if (!provider) {
    return jsonError("Provider inconnu.", 401, "UNKNOWN_PROVIDER");
  }
  if (!provider.is_active) {
    return jsonError("Ce provider est désactivé.", 403, "PROVIDER_INACTIVE");
  }

  // 2. Vérification de l'empreinte HMAC (comparaison en temps constant)
  const candidateHash = hashApiKey(apiKey);
  if (!secureCompare(provider.api_key_hash, candidateHash)) {
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

    const images = Array.isArray(item.images)
      ? item.images.filter((url) => typeof url === "string" && url.length > 0)
      : [];

    const attributes =
      item.attributes && typeof item.attributes === "object"
        ? item.attributes
        : {};

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
