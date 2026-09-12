import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  hashApiKey,
  parseProviderIdFromKey,
  secureCompare,
} from "@/lib/sync/api-key";

/**
 * TROUVETOU — API d'ingestion Schooly (SIS école)
 *
 * Endpoint dédié au connecteur Schooly : valide la clé API du provider
 * (même mécanisme `tv_live_<providerId>.<secret>` que /api/v1/sync) puis
 * exécute le RPC `schooly_sync_school` déjà présent sur la base Trouvetou
 * (upsert école + niveaux + log de synchronisation).
 *
 *   POST /api/v1/sync/schooly
 *   x-trouvetou-api-key: tv_live_<providerId>.<secret>
 *   Content-Type: application/json
 *   Body: { school: {...}, levels: [...] }
 *
 * Le RPC est `security definer` et le code passe par le `service_role` :
 * aucune policy d'écriture n'est requise côté RLS.
 */

export const runtime = "nodejs";

interface SchoolPayload {
  id: string;
  schooly_instance_url: string;
  nom: string;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description_publique?: string | null;
  itineraire?: string | null;
  photos_360?: unknown[] | null;
  video_url?: string | null;
  grille_tarifaire_publique?: unknown[] | null;
  published?: boolean | null;
}

interface LevelPayload {
  id: string;
  label: string;
  capacity?: number | null;
  prix_min?: number | null;
  prix_max?: number | null;
  places_disponibles?: number | null;
}

interface SyncBody {
  school?: SchoolPayload;
  levels?: LevelPayload[];
}

function jsonError(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, ...(code ? { code } : {}) },
    { status }
  );
}

function extractApiKey(req: NextRequest, body: SyncBody): string | null {
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

  let payload: SyncBody;
  try {
    payload = (await req.json()) as SyncBody;
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
    .select("id, name, api_key_hash, is_active")
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
  const school = payload.school;
  if (!school || typeof school !== "object" || !school.id || !school.nom) {
    return jsonError(
      "Le payload doit contenir un objet 'school' avec au minimum 'id' et 'nom'.",
      400,
      "INVALID_SCHOOL"
    );
  }
  const levels = payload.levels;
  if (!Array.isArray(levels)) {
    return jsonError("Le payload doit contenir un tableau 'levels' (éventuellement vide).", 400, "INVALID_LEVELS");
  }

  // 4. Upsert atomique via le RPC dédié.
  // La fonction `schooly_sync_school` a été créée par le SQL du connecteur
  // (tables schooly_*) mais n'est pas encore dans database.types.ts généré.
  // On type l'appel explicitement par une signature locale (runtime inchangé).
  type SchoolySyncRpc = (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  const rpc = admin.rpc.bind(admin) as unknown as SchoolySyncRpc;
  const { data, error } = await rpc("schooly_sync_school", {
    p_school: school,
    p_levels: levels,
  });

  if (error) {
    console.error("[schooly-sync] RPC schooly_sync_school:", error.message);
    return jsonError("Synchronisation refusée par la base.", 502, "SYNC_RPC_FAILED");
  }

  return NextResponse.json({
    ok: true,
    provider: provider.name,
    school_id: school.id,
    levels_count: levels.length,
    result: data,
  });
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return jsonError("Méthode non autorisée. Utilisez POST /api/v1/sync/schooly.", 405, "METHOD_NOT_ALLOWED");
}