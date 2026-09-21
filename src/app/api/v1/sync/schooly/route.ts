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

interface SchoolContactPayload {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface SchoolPayload {
  id: string;
  schooly_instance_url: string;
  nom: string;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description_publique?: string | null;
  itineraire?: string | null;
  // Schooly envoie la photo de couverture et la galerie sous ces deux clés
  // (distinctes de `photos_360`, qui ne sert qu'aux visites virtuelles).
  // Historiquement seul `photos_360` était lu ici, donc une école qui n'a
  // qu'une photo de couverture (cas courant, ex. ITES) se retrouvait sans
  // aucune image dans le catalogue public malgré une fiche "publiée".
  cover_photo?: string | null;
  gallery?: unknown[] | null;
  photos_360?: unknown[] | null;
  video_url?: string | null;
  grille_tarifaire_publique?: unknown[] | null;
  contact?: SchoolContactPayload | null;
  highlights?: unknown[] | null;
  admission_notes?: string | null;
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

  // 5. Le catalogue public de Trouvetou repose sur la table polymorphe
  // listings. Le RPC Schooly synchronise les données dédiées schooly_*,
  // mais ne crée pas automatiquement la fiche catalogue. On maintient donc
  // ici une fiche idempotente, liée au provider + school.id.
  const { data: schoolCategory, error: categoryError } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "school")
    .maybeSingle();

  if (categoryError) {
    console.error("[schooly-sync] category school:", categoryError.message);
    return jsonError("Impossible de résoudre la catégorie école.", 502, "SCHOOL_CATEGORY_LOOKUP");
  }

  if (!schoolCategory) {
    return jsonError("La catégorie 'school' est introuvable dans Trouvetou.", 502, "SCHOOL_CATEGORY_MISSING");
  }

  // Une école peut n'avoir qu'une photo de couverture (pas de galerie ni de
  // visite 360°) — c'est le cas le plus courant. On agrège les 3 sources
  // possibles, couverture en premier, dédupliquées, filtrées aux chaînes
  // non vides. Auparavant seul `photos_360` alimentait `images`, donc une
  // école avec uniquement `cover_photo` n'affichait aucune photo.
  const rawImageSources = [
    school.cover_photo,
    ...(Array.isArray(school.gallery) ? school.gallery : []),
    ...(Array.isArray(school.photos_360) ? school.photos_360 : []),
  ];
  const images = Array.from(
    new Set(
      rawImageSources
        .filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0)
    )
  );

  const contact = school.contact ?? {};

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .upsert(
      {
        provider_id: provider.id,
        category_id: schoolCategory.id,
        external_id: school.id,
        title: school.nom,
        description: school.description_publique ?? null,
        city: school.ville ?? null,
        base_price: null,
        images,
        attributes: {
          school_id: school.id,
          latitude: school.latitude ?? null,
          longitude: school.longitude ?? null,
          itineraire: school.itineraire ?? null,
          video_url: school.video_url ?? null,
          grille_tarifaire_publique: school.grille_tarifaire_publique ?? null,
          // Ces 3 clés sont celles lues par l'adaptateur d'affichage
          // (src/lib/supabase/listing-view.ts) : attrs.address,
          // attrs.contact_phone, attrs.contact_email. Elles n'étaient
          // jamais écrites ici, donc la fiche catalogue n'affichait jamais
          // l'adresse ni le contact, même quand Schooly les envoyait.
          address: contact.address ?? null,
          contact_phone: contact.phone ?? null,
          contact_email: contact.email ?? null,
          contact_website: contact.website ?? null,
          highlights: Array.isArray(school.highlights) ? school.highlights : [],
          admission_notes: school.admission_notes ?? null,
          levels: levels.map((level) => ({
            id: level.id,
            label: level.label,
            capacity: level.capacity ?? null,
            prix_min: level.prix_min ?? null,
            prix_max: level.prix_max ?? null,
            places_disponibles: level.places_disponibles ?? null,
          })),
        },
        is_available: school.published !== false,
      },
      { onConflict: "provider_id,external_id" }
    )
    .select("id, external_id, is_available")
    .single();

  if (listingError || !listing) {
    console.error("[schooly-sync] listing upsert:", listingError?.message ?? "listing introuvable après upsert");
    return jsonError("La fiche école n'a pas pu être publiée dans le catalogue Trouvetou.", 502, "LISTING_UPSERT_FAILED");
  }

  return NextResponse.json({
    ok: true,
    provider: provider.name,
    school_id: school.id,
    listing_id: listing.id,
    listing_available: listing.is_available,
    levels_count: levels.length,
    result: data,
  });
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return jsonError("Méthode non autorisée. Utilisez POST /api/v1/sync/schooly.", 405, "METHOD_NOT_ALLOWED");
}