import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  bookingsRateLimiter,
  getClientKey,
  safeSecretEqual,
  verifySameOrigin,
} from "@/lib/http/request-guard";
import { executeBooking } from "@/lib/booking/service";
import { isBookingError } from "@/lib/booking/errors";
import type { BookingConfirmation, BookingQuote } from "@/lib/providers/contract";
import type { ProviderContext } from "@/lib/providers/context";
import { findAdapter, registerAdapter } from "@/lib/providers/registry";
import { SejouraBookingAdapter, parseSejouraRoomTypeId } from "@/connectors/sejoura/sejoura-booking-adapter";
import type { ProviderType } from "@/lib/supabase/database.types";

/**
 * Enregistrement des connecteurs au chargement du module.
 *
 * L'adapter est construit à partir de `SEJOURA_API_URL` : c'est le seul endroit
 * du dépôt où cette variable est lue pour la réservation. La route ignore
 * désormais totalement Séjour@ pour `check`, `create` et `cancel` — elle ne
 * connaît plus que `provider.type`.
 *
 * L'enregistrement est idempotent : `findAdapter` évite de lever une erreur de
 * doublon si le module était évalué deux fois (utile en développement à chaud).
 */
function ensureSejouraAdapter(): void {
  if (findAdapter("sejoura") !== null) return;
  registerAdapter(new SejouraBookingAdapter({
    baseUrl: process.env.SEJOURA_API_URL ?? "https://sejoura-lemon.vercel.app",
  }));
}

/**
 * TROUVETOU — Réservation en ligne
 *
 * Cette route est une COUCHE HTTP : elle valide la requête, applique les
 * garde-fous (CSRF, débit, secret d'annulation), résout l'annonce et son
 * provider, puis délègue l'opération métier.
 *
 * Elle ne connaît plus AUCUN détail de Séjour@ pour `check`, `create` et
 * `cancel`. Le chemin d'exécution est :
 *
 *   route → executeBooking → ProviderRegistry → SejouraBookingAdapter → Séjour@
 *
 * La résolution se fait par `providers.type`, jamais par le nom du provider.
 * Un provider `unknown` n'a aucun connecteur et la requête est refusée : il
 * n'existe AUCUN repli automatique vers Séjour@.
 *
 * Sept actions, dont trois migrées vers l'architecture générique :
 *   action = "check"  → disponibilité temps réel + estimation du prix
 *                       (BookingService → quote)
 *   action = "create" → crée la réservation (BookingService → create). Le
 *                       statut est `confirmed` dès la création (anti
 *                       double-book).
 *   action = "cancel" → annule une réservation (BookingService → cancel)
 *
 *   action = "start_tracking" | "update_tracking" | "stop_tracking"
 *          | "status_tracking"
 *                       → suivi d'arrivée du client. ENCORE DIRECT : c'est une
 *                         fonctionnalité propre à Séjour@, extraite dans une
 *                         phase dédiée (ArrivalTrackingService).
 *
 *   POST /api/catalog/bookings
 *   { "action": "check"|"create"|"cancel",
 *     "listing_id": "<uuid listing trouvetou>",
 *     "booking_id": "<uuid réservation>",
 *     "reason": "..." | null,                        // optionnel pour cancel
 *     "check_in_date": "YYYY-MM-DD",
 *     "check_out_date": "YYYY-MM-DD",
 *     "number_of_guests": 2,
 *     "special_requests": "..." | null,
 *     "guest": { "full_name": "...", "phone": "...", "email": "..." } }
 */

export const runtime = "nodejs";

/**
 * URL de Séjour@, encore utilisée par le suivi d'arrivée.
 *
 * Elle ne sert plus qu'au bloc arrival-tracking, qui n'est pas migré. Elle
 * disparaîtra avec l'extraction d'`ArrivalTrackingService`. Les opérations
 * booking lisent leur URL dans leur adapter.
 */
const SEJOURA_API_URL =
  process.env.SEJOURA_API_URL ?? "https://sejoura-lemon.vercel.app";

/** Limites de débit par action et par IP (fenêtre de 1 minute). */
const RATE_LIMITS = {
  check: { limit: 20, windowMs: 60_000 },
  create: { limit: 5, windowMs: 60_000 },
  cancel: { limit: 10, windowMs: 60_000 },
  start_tracking: { limit: 3, windowMs: 60_000 },
  update_tracking: { limit: 12, windowMs: 60_000 },
  stop_tracking: { limit: 5, windowMs: 60_000 },
  status_tracking: { limit: 20, windowMs: 60_000 },
} as const;

interface BookingRequestBody {
  action?: string;
  listing_id?: string;
  booking_id?: string;
  public_token?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
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

/**
 * Traduit une erreur interne en réponse HTTP PUBLIQUE.
 *
 * Les `BookingError` portent un `kind` technique et un `code` métier. Le
 * client, lui, attend les codes historiques de l'API. Ce mapping est le seul
 * endroit qui fait le lien, ce qui évite de faire circuler les deux
 * vocabulaires dans le reste du code.
 *
 * Règle de sécurité : le message d'une `BookingError` a été construit pour
 * être affichable (jamais d'URL interne, jamais de secret). Une erreur non
 * typée ne laisse passer qu'un message générique.
 */
function bookingErrorResponse(error: unknown): NextResponse {
  if (!isBookingError(error)) {
    return jsonError("Erreur interne du service de réservation.", 500, "BOOKING_INTERNAL");
  }

  // `check` renvoie historiquement `available: false` en cas d'échec amont :
  // le frontend lit ce champ pour ne pas afficher de prix. On le conserve.
  return NextResponse.json(
    {
      success: false,
      available: false,
      code: error.code,
      error: error.message,
    },
    { status: error.httpStatus }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Les connecteurs doivent exister avant toute résolution. L'enregistrement
  // est explicite et centralisé : ajouter un provider consiste à écrire son
  // adapter puis à l'enregistrer ici, sans qu'aucune autre règle ne bouge.
  ensureSejouraAdapter();

  // ── Garde 1 : même origine (CSRF) ──────────────────────────────────────────
  // Avant toute autre chose : une requête cross-site ne doit jamais atteindre
  // la logique métier, quel que soit l'état de la configuration serveur.
  const origin = verifySameOrigin(req.headers);
  if (!origin.ok) {
    return jsonError(
      "Requête refusée : origine non autorisée.",
      403,
      origin.reason === "origin_missing" ? "ORIGIN_MISSING" : "ORIGIN_FORBIDDEN"
    );
  }

  // ── Garde 2 : débit par IP et par action ──────────────────────────────────
  const client = getClientKey(req.headers);

  let body: BookingRequestBody;
  try {
    body = (await req.json()) as BookingRequestBody;
  } catch {
    return jsonError("Le corps de la requête doit être un JSON valide.", 400, "INVALID_JSON");
  }

  const action = body.action;
  const trackingActions = ["start_tracking", "update_tracking", "stop_tracking", "status_tracking"] as const;
  if (action !== "check" && action !== "create" && action !== "cancel" && !trackingActions.includes(action as (typeof trackingActions)[number])) {
    return jsonError("action est invalide.", 400, "INVALID_ACTION");
  }

  const quota = RATE_LIMITS[action as keyof typeof RATE_LIMITS];
  const decision = bookingsRateLimiter(`${action}:${client}`, quota.limit, quota.windowMs);
  if (!decision.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Trop de requêtes. Merci de réessayer dans un instant.",
        code: "RATE_LIMITED",
      },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }
    );
  }

  // ── Garde 3 : l'annulation exige un secret serveur ─────────────────────────
  // `cancel` n'est appelé par aucune interface : l'exposer publiquement
  // permettait à un tiers d'annuler des réservations réelles en devinant un
  // booking_id. Elle reste disponible pour l'outillage (scripts, support),
  // via un secret dédié.
  if (action === "cancel") {
    const expectedSecret = process.env.BOOKING_MANAGEMENT_SECRET;
    const providedSecret = req.headers.get("x-booking-management-secret") ?? "";
    if (!expectedSecret) {
      return jsonError(
        "L'annulation n'est pas configurée sur ce déploiement.",
        503,
        "CANCEL_DISABLED"
      );
    }
    if (!safeSecretEqual(expectedSecret, providedSecret)) {
      return jsonError("Action non autorisée.", 403, "FORBIDDEN");
    }
  }

  const admin = getAdminClient();
  if (!admin) {
    return jsonError(
      "Configuration serveur incomplète (TROUVETOU_SUPABASE_URL / TROUVETOU_SUPABASE_SERVICE_ROLE_KEY).",
      500,
      "SERVER_CONFIG"
    );
  }

  const { listing_id, check_in_date, check_out_date, number_of_guests } = body;

  if (!listing_id) {
    return jsonError("listing_id est requis.", 400, "MISSING_LISTING");
  }

  // 1. Lire l'annonce en base (service_role).
  //
  // `providers!inner(type)` : l'identité technique du connecteur vient
  // EXCLUSIVEMENT de `providers.type`. Elle n'est jamais déduite de `name`,
  // de la catégorie ni du webhook.
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, external_id, base_price, attributes, providers!inner(id, type, is_active)")
    .eq("id", listing_id)
    .eq("is_available", true)
    .eq("providers.is_active", true)
    .maybeSingle();

  if (listingError) {
    return jsonError("Erreur lors de la lecture de l'annonce.", 500, "LISTING_LOOKUP");
  }
  if (!listing) {
    return jsonError("Annonce introuvable.", 404, "LISTING_NOT_FOUND");
  }

  // La relation `providers!inner` est un objet ou un tableau selon la
  // cardinalité déduite par le client Supabase : les deux formes sont
  // tolérées, comme dans `listings.ts`.
  const provider = (Array.isArray(listing.providers) ? listing.providers[0] : listing.providers) as
    | { id: string; type: ProviderType }
    | null;
  const providerType: ProviderType = provider?.type ?? "unknown";
  const providerId = provider?.id ?? "";

  const attrs = listing.attributes as Record<string, unknown> | null;

  // 2. Clé d'API du provider.
  //
  // La lecture de `sejoura_api_key` reste ici : c'est le MÉCANISME DE
  // STOCKAGE EXISTANT, volontairement conservé pour la parité. Le stockage
  // des credentials est un chantier séparé. Cette valeur ne quitte jamais le
  // serveur : elle n'est ni journalisée, ni renvoyée au client, ni inscrite
  // dans un message d'erreur.
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

  const providerContext: ProviderContext = {
    providerId,
    listing: {
      listingId: listing.id,
      externalId: listing.external_id,
      basePrice: listing.base_price === null ? null : Number(listing.base_price),
    },
    credentials: { apiKey: sejouraApiKey },
  };

  // Suivi d’arrivée : la clé Séjoura reste côté serveur Trouvetou.
  // Le navigateur ne reçoit qu’un jeton de session de suivi, jamais la clé API.
  if (action === "start_tracking" || action === "update_tracking" || action === "stop_tracking" || action === "status_tracking") {
    const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
    if (!bookingId) return jsonError("booking_id est requis.", 400, "MISSING_BOOKING_ID");

    const upstreamAction =
      action === "start_tracking" ? "start" :
      action === "update_tracking" ? "update" :
      action === "stop_tracking" ? "stop" : "status";

    const payload: Record<string, unknown> = { action: upstreamAction, booking_id: bookingId };
    if (body.public_token) payload.public_token = body.public_token;
    if (upstreamAction === "update") {
      payload.latitude = Number(body.latitude);
      payload.longitude = Number(body.longitude);
      if (body.accuracy != null) payload.accuracy = Number(body.accuracy);
    }

    const upstream = await fetch(
      `${SEJOURA_API_URL}/api/v1/external/arrival-tracking`,
      { method: "POST", headers, body: JSON.stringify(payload), cache: "no-store" }
    );
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  // ── Action "check" : disponibilité temps réel + estimation du prix ────────
  //
  // ORCHESTRATION : la route valide l'entrée HTTP, l'adapter interroge Séjour@.
  // Aucune URL, aucun `room_type_id`, aucun payload Séjour@ ici.
  if (action === "check") {
    if (!check_in_date || !check_out_date) {
      return jsonError("check_in_date et check_out_date sont requis.", 400, "MISSING_DATES");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in_date) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out_date)) {
      return jsonError("Les dates doivent respecter le format YYYY-MM-DD.", 400, "INVALID_DATE_FORMAT");
    }
    const checkIn = new Date(check_in_date + "T00:00:00Z");
    const checkOut = new Date(check_out_date + "T00:00:00Z");
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || check_in_date >= check_out_date) {
      return jsonError("check_out_date doit être postérieur à check_in_date.", 400, "INVALID_DATES");
    }

    const nights = Math.max(
      1,
      Math.round(
        (new Date(check_out_date).getTime() - new Date(check_in_date).getTime()) / 86_400_000
      )
    );

    try {
      const quote = (await executeBooking(
        providerType,
        "quote",
        providerContext,
        {
          schedule: { startDate: check_in_date, endDate: check_out_date },
          partySize: 1,
          items: [],
          notes: null,
          guest: { fullName: "" },
        }
      )) as BookingQuote;

      // Structure de réponse INCHANGÉE, y compris `room_type_id` : il est
      // désormais dérivé de l'external_id par l'adapter, mais reste exposé
      // pour ne pas casser les clients qui le consomment.
      return NextResponse.json({
        success: true,
        available: quote.available,
        available_rooms: quote.availabilityCount ?? 0,
        nights,
        estimated_total: quote.totalAmount,
        room_type_id: parseSejouraRoomTypeId(listing.external_id),
      });
    } catch (error: unknown) {
      return bookingErrorResponse(error);
    }
  }

  // ── Action "cancel" : annulation d'une réservation ─────────────────────────
  //
  // Les validations HTTP (longueur, motif) restent ici. L'appel provider part
  // par l'adapter, qui construit la requête Séjour@.
  if (action === "cancel") {
    const { booking_id, reason } = body;
    if (!booking_id || typeof booking_id !== "string") {
      return jsonError("booking_id est requis pour annuler.", 400, "MISSING_BOOKING_ID");
    }
    if (booking_id.length > 100) {
      return jsonError("booking_id est invalide.", 400, "INVALID_BOOKING_ID");
    }
    if (reason && String(reason).length > 500) {
      return jsonError("Le motif d'annulation est trop long.", 400, "INVALID_CANCEL_REASON");
    }

    try {
      await executeBooking(
        providerType,
        "cancel",
        providerContext,
        undefined,
        booking_id
      );

      return NextResponse.json({ success: true, booking: null });
    } catch (error: unknown) {
      return bookingErrorResponse(error);
    }
  }

  // ── Action "create" : création de la réservation ──────────────────────────
  //
  // Toute la validation HTTP du voyageur reste ici (nom, e-mail, téléphone,
  // demandes, nombre d'occupants) : ce sont des règles PUBLIQUES de TrouveTout,
  // indépendantes du PMS. Seul l'assemblage de la requête Séjour@ est délégué.
  const { guest, special_requests } = body;
  if (!check_in_date || !check_out_date) {
    return jsonError("check_in_date et check_out_date sont requis.", 400, "MISSING_DATES");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in_date) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out_date)) {
    return jsonError("Les dates doivent respecter le format YYYY-MM-DD.", 400, "INVALID_DATE_FORMAT");
  }
  const checkIn = new Date(check_in_date + "T00:00:00Z");
  const checkOut = new Date(check_out_date + "T00:00:00Z");
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || check_in_date >= check_out_date) {
    return jsonError("check_out_date doit être postérieur à check_in_date.", 400, "INVALID_DATES");
  }
  if (number_of_guests !== undefined) {
    const guests = Number(number_of_guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 50) {
      return jsonError("number_of_guests doit être compris entre 1 et 50.", 400, "INVALID_GUEST_COUNT");
    }
  }
  if (!guest?.full_name || typeof guest.full_name !== "string" || !guest.full_name.trim()) {
    return jsonError("guest.full_name est requis.", 400, "MISSING_GUEST_NAME");
  }

  const guestName = guest.full_name.trim();
  const guestPhone = guest.phone ? String(guest.phone).trim() : null;
  const guestEmail = guest.email ? String(guest.email).trim().toLowerCase() : null;
  const specialRequests = special_requests ? String(special_requests).trim() : null;

  if (guestName.length > 120) {
    return jsonError("Le nom du client est trop long.", 400, "INVALID_GUEST_NAME");
  }
  if (guestPhone && guestPhone.length > 30) {
    return jsonError("Le numéro de téléphone est trop long.", 400, "INVALID_PHONE");
  }
  if (guestEmail && (guestEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))) {
    return jsonError("L'adresse e-mail est invalide.", 400, "INVALID_EMAIL");
  }
  if (specialRequests && specialRequests.length > 2000) {
    return jsonError("La demande spéciale est trop longue.", 400, "INVALID_SPECIAL_REQUEST");
  }

  try {
    const confirmation = (await executeBooking(
      providerType,
      "create",
      providerContext,
      {
        schedule: { startDate: check_in_date, endDate: check_out_date },
        partySize: parseInt(String(number_of_guests), 10) || 1,
        items: [],
        notes: specialRequests,
        guest: { fullName: guestName, phone: guestPhone, email: guestEmail },
      }
    )) as BookingConfirmation;

    // `details` porte la réservation telle que Séjour@ l'a décrite : c'est
    // exactement l'objet `booking` renvoyé auparavant, donc la structure
    // publique reste identique.
    return NextResponse.json(
      { success: true, booking: confirmation.details ?? null },
      { status: 201 }
    );
  } catch (error: unknown) {
    return bookingErrorResponse(error);
  }
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return jsonError("Méthode non autorisée. Utilisez POST /api/catalog/bookings.", 405, "METHOD_NOT_ALLOWED");
}
