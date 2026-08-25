import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * TROUVETOU — Réservation en ligne (création d'une réservation Séjour@)
 *
 * Sert de passerelle : le portail ne stocke aucune donnée client, il transmet
 * la demande au logiciel métier de l'établissement (Séjour@) via l'API externe
 * de Séjour@, authentifiée par la clé API de l'établissement stockée dans
 * `listings.attributes.sejoura_api_key` (masquée des réponses publiques).
 *
 * Trois actions :
 *   action = "check"   → vérifie la disponibilité temps réel et calcule le prix
 *                        (GET /api/v1/external/availability côté Séjour@).
 *   action = "create"  → crée la réservation côté Séjour@
 *                        (POST /api/v1/external/bookings). Le statut est
 *                        `confirmed` dès la création (anti double-book).
 *   action = "cancel"  → annule une réservation côté Séjour@
 *                        (POST /api/v1/external/bookings/cancel).
 *
 *   POST /api/catalog/bookings
 *   { "action": "check"|"create"|"cancel",
 *     "listing_id": "<uuid listing trouvetou>",
 *     "booking_id": "<uuid réservation séjour@>",   // requis pour cancel
 *     "reason": "..." | null,                        // optionnel pour cancel
 *     "check_in_date": "YYYY-MM-DD",
 *     "check_out_date": "YYYY-MM-DD",
 *     "number_of_guests": 2,
 *     "special_requests": "..." | null,
 *     "guest": { "full_name": "...", "phone": "...", "email": "..." } }
 */

export const runtime = "nodejs";

const SEJOURA_API_URL =
  process.env.SEJOURA_API_URL ?? "https://sejoura-lemon.vercel.app";

interface BookingRequestBody {
  action?: string;
  listing_id?: string;
  booking_id?: string;
  reason?: string | null;
  check_in_date?: string;
  check_out_date?: string;
  number_of_guests?: number;
  special_requests?: string | null;
  guest?: {
    full_name?: string;
    phone?: string | null;
    email?: string | null;
  };
}

function jsonError(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, ...(code ? { code } : {}) },
    { status }
  );
}

/** Extrait le type de chambre Séjour@ depuis l'external_id (`rt:<uuid>`). */
function parseRoomTypeId(externalId: string): string | null {
  if (!externalId.startsWith("rt:")) return null;
  const id = externalId.slice(3);
  return id.length > 0 ? id : null;
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

  let body: BookingRequestBody;
  try {
    body = (await req.json()) as BookingRequestBody;
  } catch {
    return jsonError("Le corps de la requête doit être un JSON valide.", 400, "INVALID_JSON");
  }

  const action =
    body.action === "create" ? "create" : body.action === "cancel" ? "cancel" : "check";
  const { listing_id, check_in_date, check_out_date, number_of_guests } = body;

  if (!listing_id) {
    return jsonError("listing_id est requis.", 400, "MISSING_LISTING");
  }

  // 1. Lire l'annonce en base (service_role) pour récupérer la clé API Séjour@
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, external_id, attributes")
    .eq("id", listing_id)
    .maybeSingle();

  if (listingError) {
    return jsonError("Erreur lors de la lecture de l'annonce.", 500, "LISTING_LOOKUP");
  }
  if (!listing) {
    return jsonError("Annonce introuvable.", 404, "LISTING_NOT_FOUND");
  }

  const roomTypeId = parseRoomTypeId(listing.external_id);
  if (!roomTypeId) {
    return jsonError("Cette annonce ne permet pas la réservation en ligne.", 400, "NOT_BOOKABLE");
  }

  const attrs = listing.attributes as Record<string, unknown> | null;
  const sejouraApiKey = typeof attrs?.sejoura_api_key === "string"
    ? attrs.sejoura_api_key
    : null;
  if (!sejouraApiKey) {
    return jsonError(
      "La réservation en ligne n'est pas activée pour cet établissement (clé API Séjour@ absente).",
      409,
      "BOOKING_NOT_AVAILABLE"
    );
  }

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": sejouraApiKey,
  };

  // ── Action "check" : disponibilité temps réel + estimation du prix ────────
  if (action === "check") {
    if (!check_in_date || !check_out_date) {
      return jsonError("check_in_date et check_out_date sont requis.", 400, "MISSING_DATES");
    }
    if (check_in_date >= check_out_date) {
      return jsonError("check_out_date doit être postérieur à check_in_date.", 400, "INVALID_DATES");
    }

    const nights = Math.max(
      1,
      Math.round(
        (new Date(check_out_date).getTime() - new Date(check_in_date).getTime()) / 86_400_000
      )
    );

    const url = new URL("/api/v1/external/availability", SEJOURA_API_URL);
    url.searchParams.set("room_type_id", roomTypeId);
    url.searchParams.set("check_in", check_in_date);
    url.searchParams.set("check_out", check_out_date);

    const res = await fetch(url, { headers });
    const data = (await res.json().catch(() => ({}))) as {
      available?: boolean;
      available_rooms?: number;
      error?: string;
    };

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          error: data.error ?? `Erreur de vérification (HTTP ${res.status})`,
        },
        { status: res.status === 401 || res.status === 403 ? 409 : 502 }
      );
    }

    const available = data.available === true;
    return NextResponse.json({
      success: true,
      available,
      available_rooms: data.available_rooms ?? 0,
      nights,
      room_type_id: roomTypeId,
    });
  }

  // ── Action "cancel" : annulation d'une réservation Séjour@ ─────────────────
  if (action === "cancel") {
    const { booking_id, reason } = body;
    if (!booking_id || typeof booking_id !== "string") {
      return jsonError("booking_id est requis pour annuler.", 400, "MISSING_BOOKING_ID");
    }

    const cancelRes = await fetch(
      `${SEJOURA_API_URL}/api/v1/external/bookings/cancel`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          booking_id,
          reason: reason ? String(reason) : null,
        }),
      }
    );

    const cancelData = (await cancelRes.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      booking?: {
        booking_code?: string;
        status?: string;
      };
    };

    if (!cancelRes.ok) {
      const status = cancelRes.status;
      if (status === 404) {
        return NextResponse.json(
          { success: false, code: "BOOKING_NOT_FOUND", error: cancelData.error ?? "Réservation introuvable." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          code: status === 401 || status === 403 ? "BOOKING_ACTION_FORBIDDEN" : "CANCEL_FAILED",
          error: cancelData.error ?? `Erreur d'annulation (HTTP ${status})`,
        },
        { status: status === 401 || status === 403 ? 409 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: cancelData.booking ?? null,
    });
  }

  // ── Action "create" : création de la réservation Séjour@ ──────────────────
  const { guest, special_requests } = body;
  if (!check_in_date || !check_out_date) {
    return jsonError("check_in_date et check_out_date sont requis.", 400, "MISSING_DATES");
  }
  if (check_in_date >= check_out_date) {
    return jsonError("check_out_date doit être postérieur à check_in_date.", 400, "INVALID_DATES");
  }
  if (!guest?.full_name || typeof guest.full_name !== "string" || !guest.full_name.trim()) {
    return jsonError("guest.full_name est requis.", 400, "MISSING_GUEST_NAME");
  }

  const createRes = await fetch(
    `${SEJOURA_API_URL}/api/v1/external/bookings`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        room_type_id: roomTypeId,
        check_in_date,
        check_out_date,
        number_of_guests: parseInt(String(number_of_guests), 10) || 1,
        special_requests: special_requests ? String(special_requests) : null,
        guest: {
          full_name: guest.full_name.trim(),
          phone: guest.phone ? String(guest.phone).trim() : null,
          email: guest.email ? String(guest.email).trim() : null,
        },
      }),
    }
  );

  const createData = (await createRes.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    code?: string;
    booking?: {
      booking_code?: string;
      status?: string;
      check_in_date?: string;
      check_out_date?: string;
      total_amount?: number;
      number_of_guests?: number;
      room_id?: string;
    };
  };

  if (!createRes.ok) {
    const status = createRes.status;
    if (status === 409) {
      return NextResponse.json(
        {
          success: false,
          code: createData.code ?? "CONFLICT",
          error: createData.error ?? "Aucune chambre disponible pour ces dates.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        code: createData.code ?? "BOOKING_FAILED",
        error: createData.error ?? `Erreur de création (HTTP ${status})`,
      },
      { status: status === 401 || status === 403 ? 409 : 502 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      booking: createData.booking ?? null,
    },
    { status: 201 }
  );
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return jsonError("Méthode non autorisée. Utilisez POST /api/catalog/bookings.", 405, "METHOD_NOT_ALLOWED");
}
