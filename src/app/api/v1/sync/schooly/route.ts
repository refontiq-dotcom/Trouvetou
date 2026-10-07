import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { safeHttpUrl, safeHttpUrlList } from "@/lib/http/url";
import { normalizePanoramaTour, type PanoramaTour } from "@/types/panorama";
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

/**
 * Nombre maximal d'images ordinaires stockées pour une école (photo principale
 * incluse). Valeur inchangée par rapport à la branche d'origine : la limite de
 * 4 photos reste une décision ARCHITECTURALE NON TRANCHÉE, appliquée
 * provisoirement des deux côtés pour que le comportement ne bouge pas pendant
 * le durcissement sécurité. Les deux constantes sont volontairement distinctes
 * pour qu'un assouplissement ultérieur puisse les traiter indépendamment.
 */
const MAX_SCHOOLY_IMAGES = 4;

interface SchoolPayload {
  id: string;
  schooly_instance_url: string;
  nom: string;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description_publique?: string | null;
  itineraire?: string | null;
  cover_photo?: string | null;
  gallery?: unknown[] | null;
  photos_360?: unknown[] | null;
  panorama_tour?: unknown;
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

function buildSchoolPanoramaTour(school: SchoolPayload): PanoramaTour | null {
  const explicit = normalizePanoramaTour(school.panorama_tour);
  if (explicit.scenes.length > 0) {
    const scene = explicit.scenes[0];
    return normalizePanoramaTour({
      version: 1,
      startSceneId: scene.id,
      scenes: [{ ...scene, isStart: true }],
      links: [],
    });
  }

  // Schooly : une seule visite 360° par établissement.
  // On conserve uniquement la première scène/source 360°.
  const rawPhotos = Array.isArray(school.photos_360) ? school.photos_360.slice(0, 1) : [];
  const scenes = rawPhotos
    .map((photo, index) => {
      if (typeof photo === "string") {
        // SÉCURITÉ : l'URL est validée AVANT d'entrer dans le tour. Un
        // `javascript:` ici deviendrait une texture WebGL chez le visiteur.
        const src = safeHttpUrl(photo);
        if (src === null) return null;
        return {
          id: `schooly-360-${index + 1}`,
          name: `Vue 360° ${index + 1}`,
          kind: "other" as const,
          src,
          previewSrc: null,
          isStart: index === 0,
          isPublished: true,
          infoHotspots: [],
        };
      }
      if (!photo || typeof photo !== "object") return null;
      const value = photo as Record<string, unknown>;
      const src =
        safeHttpUrl(value.src) ??
        safeHttpUrl(value.url) ??
        safeHttpUrl(value.image);
      if (!src) return null;
      const id = typeof value.id === "string" && value.id.trim()
        ? value.id.trim()
        : `schooly-360-${index + 1}`;
      const name = typeof value.name === "string" && value.name.trim()
        ? value.name.trim()
        : `Vue 360° ${index + 1}`;
      const kind =
        value.kind === "room" || value.kind === "corridor" || value.kind === "lobby"
          ? value.kind
          : "other";
      return {
        id,
        name,
        kind,
        src,
        previewSrc: safeHttpUrl(value.previewSrc),
        isStart: value.isStart === true || index === 0,
        isPublished: value.isPublished !== false,
        infoHotspots: Array.isArray(value.infoHotspots) ? value.infoHotspots : [],
      };
    })
    .filter((scene): scene is NonNullable<typeof scene> => Boolean(scene));

  if (scenes.length === 0) return null;

  const links = scenes.slice(1).flatMap((scene, index) => {
    const previous = scenes[index];
    return [
      {
        id: `schooly-link-${index + 1}`,
        fromSceneId: previous.id,
        toSceneId: scene.id,
        yaw: 0,
        pitch: 0,
        label: `Aller vers ${scene.name}`,
      },
      {
        id: `schooly-link-back-${index + 1}`,
        fromSceneId: scene.id,
        toSceneId: previous.id,
        yaw: Math.PI,
        pitch: 0,
        label: `Retour vers ${previous.name}`,
      },
    ];
  });

  return normalizePanoramaTour({
    version: 1,
    startSceneId: scenes.find((scene) => scene.isStart)?.id ?? scenes[0].id,
    scenes,
    links,
  });
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

  const panoramaTour = buildSchoolPanoramaTour(school);
  const panoramaStartSceneId = panoramaTour?.startSceneId ?? null;
  const panorama360Url = panoramaTour?.scenes.find((scene) => scene.id === panoramaStartSceneId)?.src ?? panoramaTour?.scenes[0]?.src ?? null;

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

  // SÉCURITÉ : la photo principale et la galerie sont des URLs fournies par un
  // provider distant puis rendues en `src` chez le visiteur. Filtrées par
  // ALLOWLISTE http/https avant écriture en base.
  const coverPhoto = safeHttpUrl(school.cover_photo);
  const galleryPhotos = safeHttpUrlList(school.gallery);
  const ordinaryPhotos = Array.from(new Set([...(coverPhoto ? [coverPhoto] : []), ...galleryPhotos])).slice(0, MAX_SCHOOLY_IMAGES);
  const limitedGalleryPhotos = ordinaryPhotos.slice(coverPhoto ? 1 : 0);

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
        images: ordinaryPhotos,
        attributes: {
          school_id: school.id,
          latitude: school.latitude ?? null,
          longitude: school.longitude ?? null,
          itineraire: school.itineraire ?? null,
          cover_image_url:
            typeof school.cover_photo === "string" && school.cover_photo.trim()
              ? school.cover_photo.trim()
              : null,
          gallery_images: limitedGalleryPhotos,
          photos_360: panorama360Url ? [panorama360Url] : [],
          panorama_360_url: panorama360Url,
          panorama_start_scene_id: panoramaStartSceneId,
          // `PanoramaTour` est une interface TypeScript sans index signature :
          // elle n'est pas assignable à `Json`. Le tour a été normalisé par
          // `normalizePanoramaTour` (URLs http(s) uniquement) et reste
          // JSON-sérialisable — le cast n'assouplit aucune validation.
          panorama_tour: (panoramaTour as unknown as Json) ?? null,
          video_url: school.video_url ?? null,
          // `unknown[]` du payload Schooly → `Json` : la valeur provient du
          // JSON décodé du corps de requête, donc déjà JSON-sérialisable.
          grille_tarifaire_publique: (school.grille_tarifaire_publique as unknown as Json) ?? null,
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