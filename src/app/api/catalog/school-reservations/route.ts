import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildPartnerBookingHeaders, getPartnerBookingSecret } from "@/lib/booking/partner-secret";
import { bookingsRateLimiter, getClientKey, verifySameOrigin } from "@/lib/http/request-guard";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_LIMITS = {
  availability: { limit: 20, windowMs: 60_000 },
  create: { limit: 5, windowMs: 60_000 },
} as const;

type RequestBody = {
  action?: string;
  listing_id?: string;
  level_id?: string;
  idempotency_key?: string;
  student_full_name?: string;
  student_birthdate?: string;
  parent_full_name?: string;
  parent_phone?: string;
  parent_email?: string | null;
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ success: false, error: message, ...(code ? { code } : {}) }, { status });
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getSchoolBaseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = verifySameOrigin(req.headers);
  if (!origin.ok) return jsonError("Requête refusée : origine non autorisée.", 403, "ORIGIN_FORBIDDEN");

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonError("Le corps de la requête doit être un JSON valide.", 400, "INVALID_JSON");
  }

  const action = body.action;
  if (action !== "availability" && action !== "create") {
    return jsonError("action doit être availability ou create.", 400, "INVALID_ACTION");
  }

  const quota = RATE_LIMITS[action];
  const decision = bookingsRateLimiter(`school-${action}:${getClientKey(req.headers)}`, quota.limit, quota.windowMs);
  if (!decision.allowed) {
    return NextResponse.json(
      { success: false, error: "Trop de demandes. Réessayez dans un instant.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }
    );
  }

  if (typeof body.listing_id !== "string" || !UUID_PATTERN.test(body.listing_id)) {
    return jsonError("listing_id invalide.", 400, "INVALID_LISTING_ID");
  }

  const admin = getAdminClient();
  if (!admin) return jsonError("Configuration serveur incomplète.", 500, "SERVER_CONFIG");

  const { data: listing, error } = await admin
    .from("listings")
    .select("id, external_id, attributes, providers!inner(name, is_active), categories!inner(slug)")
    .eq("id", body.listing_id)
    .eq("is_available", true)
    .eq("providers.is_active", true)
    .eq("categories.slug", "school")
    .maybeSingle();

  if (error) return jsonError("Erreur lors de la lecture de l'école.", 500, "SCHOOL_LOOKUP");
  if (!listing) return jsonError("École introuvable ou non publiée.", 404, "SCHOOL_NOT_FOUND");

  const attributes = listing.attributes && typeof listing.attributes === "object" && !Array.isArray(listing.attributes)
    ? listing.attributes as Record<string, unknown>
    : {};
  const schoolId = typeof attributes.school_id === "string" ? attributes.school_id : listing.external_id;
  const schoolBaseUrl = getSchoolBaseUrl(attributes.schooly_instance_url);
  if (!UUID_PATTERN.test(schoolId) || !schoolBaseUrl) {
    return jsonError("La connexion à Schooly n'est pas configurée pour cette école. Synchronisez à nouveau l'établissement.", 503, "SCHOOLY_ENDPOINT_MISSING");
  }

  const providerRelation = listing.providers as { name?: string } | { name?: string }[] | null;
  const providerName = Array.isArray(providerRelation) ? providerRelation[0]?.name : providerRelation?.name;
  const secret = providerName ? getPartnerBookingSecret(providerName) : null;
  if (!secret) return jsonError("Le secret de réservation Schooly n'est pas configuré.", 503, "BOOKING_INTEGRATION_CONFIG");

  const headers = buildPartnerBookingHeaders(secret);
  const availabilityUrl = new URL(`/api/v1/public/schools/${schoolId}/availability`, schoolBaseUrl);

  let availabilityResponse: Response;
  try {
    availabilityResponse = await fetch(availabilityUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    return jsonError("Schooly ne répond pas actuellement. Réessayez dans quelques instants.", 502, "SCHOOLY_UNAVAILABLE");
  }
  const availability = await availabilityResponse.json().catch(() => null) as {
    niveaux?: Array<{ id?: string; label?: string; places_disponibles?: number; disponible?: boolean | null }>;
  } | null;
  if (!availabilityResponse.ok || !Array.isArray(availability?.niveaux)) {
    return jsonError("Impossible de récupérer les niveaux et disponibilités de cette école.", 502, "SCHOOLY_AVAILABILITY_FAILED");
  }

  if (action === "availability") {
    return NextResponse.json({
      success: true,
      school_id: schoolId,
      school_name: listing.title,
      levels: availability.niveaux.map((level) => ({
        id: level.id,
        label: level.label,
        places_disponibles: typeof level.places_disponibles === "number" ? level.places_disponibles : null,
        disponible: typeof level.disponible === "boolean" ? level.disponible : null,
      })),
    });
  }

  const levelId = typeof body.level_id === "string" ? body.level_id : "";
  const level = availability.niveaux.find((item) => item.id === levelId);
  if (!level) return jsonError("Choisissez un niveau valide pour cette école.", 400, "INVALID_LEVEL");
  if (level.disponible === false || (typeof level.places_disponibles === "number" && level.places_disponibles <= 0)) {
    return jsonError("Ce niveau ne dispose plus de places annoncées disponibles.", 409, "LEVEL_FULL");
  }

  const idempotencyKey = typeof body.idempotency_key === "string" && UUID_PATTERN.test(body.idempotency_key)
    ? body.idempotency_key
    : null;
  if (!idempotencyKey) return jsonError("Une clé d'idempotence UUID valide est requise.", 400, "INVALID_IDEMPOTENCY_KEY");

  const studentFullName = typeof body.student_full_name === "string" ? body.student_full_name.trim() : "";
  const parentFullName = typeof body.parent_full_name === "string" ? body.parent_full_name.trim() : "";
  const parentPhone = typeof body.parent_phone === "string" ? body.parent_phone.trim() : "";
  const studentBirthdate = body.student_birthdate;
  const parentEmail = typeof body.parent_email === "string" ? body.parent_email.trim().toLowerCase() : "";

  if (!studentFullName || studentFullName.length > 180 || !parentFullName || parentFullName.length > 180 || !parentPhone || parentPhone.length > 40 || !validDate(studentBirthdate)) {
    return jsonError("Renseignez le nom de l'élève, sa date de naissance, le nom du parent et son téléphone.", 400, "INVALID_REQUEST_FIELDS");
  }
  if (parentEmail && (parentEmail.length > 160 || !/^\S+@\S+\.\S+$/.test(parentEmail))) {
    return jsonError("Adresse email invalide.", 400, "INVALID_PARENT_EMAIL");
  }

  const requestUrl = new URL(`/api/v1/public/ecoles/${schoolId}/request`, schoolBaseUrl);
  let requestResponse: Response;
  try {
    requestResponse = await fetch(requestUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        level_id: levelId,
        student_full_name: studentFullName,
        student_birthdate: studentBirthdate,
        parent_full_name: parentFullName,
        parent_phone: parentPhone,
        parent_email: parentEmail || null,
        idempotency_key: idempotencyKey,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return jsonError("La demande n'a pas pu être transmise à Schooly. Réessayez sans changer le formulaire.", 502, "SCHOOLY_UNAVAILABLE");
  }

  const result = await requestResponse.json().catch(() => null) as {
    success?: boolean;
    reservation_id?: string;
    status?: string;
    created_at?: string;
    payment_required?: boolean;
    level?: { id?: string; label?: string };
    error?: string;
    code?: string;
    reused?: boolean;
  } | null;

  if (!requestResponse.ok || result?.success !== true || !result.reservation_id) {
    const status = requestResponse.status === 409 ? 409 : requestResponse.status === 400 ? 400 : 502;
    return jsonError(result?.error ?? "Schooly n'a pas pu enregistrer la demande.", status, result?.code ?? "SCHOOLY_REQUEST_FAILED");
  }

  return NextResponse.json({
    success: true,
    reservation: {
      id: result.reservation_id,
      status: result.status ?? "requested",
      created_at: result.created_at ?? null,
      level: result.level ?? { id: levelId, label: level.label ?? "Niveau sélectionné" },
      reused: result.reused === true,
    },
    payment_required: false,
    next_step: "school_contact",
  }, { status: requestResponse.status === 200 ? 200 : 201 });
}

export async function GET(): Promise<NextResponse> {
  return jsonError("Méthode non autorisée. Utilisez POST /api/catalog/school-reservations.", 405, "METHOD_NOT_ALLOWED");
}
