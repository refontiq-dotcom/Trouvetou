// ============================================================================
// TROUVETOU — Connecteur Séjoura
//
// C'est le SEUL endroit du dépôt autorisé à connaître les détails de l'API
// Séjour@. Toute la connaissance de ce PMS est concentrée ici : URL de base,
// préfixe `rt:` des identifiants, en-têtes, chemins `/api/v1/external/…` et
// forme des réponses.
//
// POURQUOI CET ADAPTER EST MODÉLISÉ SUR LE CODE EXISTANT
//
// Il reproduit à l'identique le comportement de
// `src/app/api/catalog/bookings/route.ts`, y compris ses subtilités :
//
//   - le prix du provider prime sur l'estimation TrouveTout ;
//   - 401/403 amont deviennent 409 côté client (« indisponible »), pas 502 ;
//   - 409 amont reste un 409 (« plus de chambres ») ;
//   - le total est recalculé côté serveur à partir de `base_price × nuits`.
//
// Chaque écart serait un bug de plus à diagnostiquer en Phase 2B, quand la
// route basculera sur ce chemin. La parité est donc une exigence.
//
// Les `BookingError` levés ici reprennent les MÊMES codes que la route
// actuelle (`BOOKING_NOT_FOUND`, `BOOKING_ACTION_FORBIDDEN`, `CANCEL_FAILED`,
// `BOOKING_FAILED`) pour qu'un remplacement de route ne modifie pas les
// réponses vues par le frontend.
// ============================================================================

import {
  BookingError,
  classifyUpstreamStatus,
  type BookingErrorKind,
} from "@/lib/booking/errors";
import type {
  BookingCancellation,
  BookingConfirmation,
  BookingQuote,
  BookingRequest,
  ProviderAdapter,
  ProviderCapabilities,
} from "@/lib/providers/contract";
import type { ProviderContext } from "@/lib/providers/context";

/** Identifiant technique du connecteur. Utilisé comme type de provider. */
export const SEJOURA_PROVIDER_TYPE = "sejoura";

/** Préfixe des identifiants de type de chambre dans l'`external_id`. */
const ROOM_TYPE_PREFIX = "rt:";

/** Devise de repli quand Séjour@ n'en fournit pas. */
const DEFAULT_CURRENCY = "XOF";

/** Nombre de nuits minimal, aligné sur le comportement existant. */
const MINIMUM_NIGHTS = 1;

/**
 * Injection du transport HTTP.
 *
 * Un `fetch` injectable permet de tester l'adapter sans réseau. En
 * production, on laisse le `fetch` global.
 */
export type HttpTransport = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface SejouraAdapterOptions {
  /** URL de base de l'API Séjour@. */
  baseUrl: string;
  /** Transport HTTP injectable. Par défaut `fetch`. */
  transport?: HttpTransport;
}

/**
 * Séjour@ sait réserver et annuler.
 *
 * `availability` n'est PAS déclarée comme capacité séparée : elle est portée
 * par `quote`, qui l'implique. L'annoncer sans contrat qui la vérifie serait
 * une capacité décorative.
 */
export const SEJOURA_CAPABILITIES: ProviderCapabilities = Object.freeze({
  booking: true,
  cancellation: true,
});

/**
 * Identifiant de ressource Séjour@ extrait d'un `external_id`.
 *
 * Exporté pour un seul usage : la route doit conserver la forme historique de
 * la réponse `check`, qui expose `room_type_id`. Le principe reste inchangé —
 * c'est l'adapter qui interprète l'`external_id` — mais le routeur ne doit pas
 * réimplémenter le format : il délègue.
 *
 * `null` si l'`external_id` n'est pas un identifiant Séjour@ exploitable.
 */
export function parseSejouraRoomTypeId(externalId: string): string | null {
  if (!externalId.startsWith(ROOM_TYPE_PREFIX)) return null;
  const id = externalId.slice(ROOM_TYPE_PREFIX.length);
  return id.length > 0 ? id : null;
}

export class SejouraBookingAdapter implements ProviderAdapter {
  readonly id = SEJOURA_PROVIDER_TYPE;
  readonly capabilities = SEJOURA_CAPABILITIES;

  private readonly baseUrl: string;
  private readonly transport: HttpTransport;

  constructor(options: SejouraAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.transport = options.transport ?? defaultTransport;
  }

  // ── quote ──────────────────────────────────────────────────────────────────
  // GET /api/v1/external/availability?room_type_id=…&check_in=…&check_out=…

  async quote(request: BookingRequest, context: ProviderContext): Promise<BookingQuote> {
    const roomTypeId = this.requireRoomTypeId(context);
    const { startDate, endDate } = this.requireSchedule(request);

    const url = new URL("/api/v1/external/availability", this.baseUrl);
    url.searchParams.set("room_type_id", roomTypeId);
    url.searchParams.set("check_in", startDate);
    url.searchParams.set("check_out", endDate);

    const response = await this.transport(url.toString(), {
      method: "GET",
      headers: this.authHeaders(context),
    });

    const data = asRecord(await response.json());
    if (!response.ok) {
      throw this.upstreamError(
        response.status,
        data,
        "Erreur de vérification",
        "AVAILABILITY_FAILED"
      );
    }

    // Le montant de Séjour@ prime : c'est la source de vérité du PMS. À
    // défaut, TrouveTout estime depuis le prix catalogue — et le signale comme
    // estimation, jamais comme un devis ferme.
    const upstreamTotal = firstNumber(data.estimated_total, data.total_amount);
    const nights = this.nightsBetween(startDate, endDate);
    const basePrice = context.listing.basePrice;

    let totalAmount: number | null = null;
    let amountSource: "provider" | "estimated" = "provider";

    if (upstreamTotal !== null) {
      totalAmount = Math.round(upstreamTotal);
    } else if (basePrice !== null && Number.isFinite(basePrice)) {
      totalAmount = Math.round(basePrice * nights);
      amountSource = "estimated";
    }

    return {
      available: data.available === true,
      availabilityCount: typeof data.available_rooms === "number" ? data.available_rooms : 0,
      totalAmount,
      currency: DEFAULT_CURRENCY,
      amountSource,
      details: { nights },
    };
  }

  // ── create ─────────────────────────────────────────────────────────────────
  // POST /api/v1/external/bookings

  async create(request: BookingRequest, context: ProviderContext): Promise<BookingConfirmation> {
    const roomTypeId = this.requireRoomTypeId(context);
    const { startDate, endDate } = this.requireSchedule(request);

    const response = await this.transport(`${this.baseUrl}/api/v1/external/bookings`, {
      method: "POST",
      headers: this.authHeaders(context),
      body: JSON.stringify({
        room_type_id: roomTypeId,
        check_in_date: startDate,
        check_out_date: endDate,
        number_of_guests: request.partySize,
        special_requests: request.notes ?? null,
        guest: {
          full_name: request.guest.fullName,
          phone: request.guest.phone ?? null,
          email: request.guest.email ?? null,
        },
      }),
    });

    const data = asRecord(await response.json());
    if (!response.ok) {
      // 409 amont = « plus de chambres disponibles » : conflit métier, pas
      // panne. Le message par défaut de la route existante est conservé.
      const kind: BookingErrorKind =
        response.status === 409 ? "conflict" : classifyUpstreamStatus(response.status);
      throw new BookingError(
        kind,
        readString(data.code) ?? "BOOKING_FAILED",
        readString(data.error) ?? `Erreur de création (HTTP ${response.status})`,
        kind === "conflict" ? 409 : undefined
      );
    }

    const booking = asRecord(data.booking);
    return {
      bookingId: readString(booking.booking_code) ?? readString(booking.id) ?? "",
      status: readString(booking.status) ?? "confirmed",
      totalAmount: firstNumber(booking.total_amount),
      currency: DEFAULT_CURRENCY,
      details: booking,
    };
  }

  // ── cancel ─────────────────────────────────────────────────────────────────
  // POST /api/v1/external/bookings/cancel

  async cancel(
    bookingId: string,
    context: ProviderContext,
    reason: string | null = null
  ): Promise<BookingCancellation> {
    const response = await this.transport(`${this.baseUrl}/api/v1/external/bookings/cancel`, {
      method: "POST",
      headers: this.authHeaders(context),
      body: JSON.stringify({ booking_id: bookingId, reason }),
    });

    const data = asRecord(await response.json());
    if (!response.ok) {
      if (response.status === 404) {
        throw new BookingError(
          "not_found",
          "BOOKING_NOT_FOUND",
          readString(data.error) ?? "Réservation introuvable.",
          404
        );
      }
      const kind = classifyUpstreamStatus(response.status);
      throw new BookingError(
        kind,
        kind === "upstream_unauthorized" ? "BOOKING_ACTION_FORBIDDEN" : "CANCEL_FAILED",
        readString(data.error) ?? `Erreur d'annulation (HTTP ${response.status})`
      );
    }

    const booking = asRecord(data.booking);
    return { status: readString(booking.status) ?? "cancelled", details: booking };
  }

  /**
   * Traduit l'`external_id` TrouveTout en identifiant Séjour@.
   *
   * `rt:<uuid>` est le format produit par la synchronisation Séjour@. Tout
   * autre format signifie que l'annonce n'est pas exploitable par cet
   * adapter : information métier, pas erreur de transport.
   */
  private requireRoomTypeId(context: ProviderContext): string {
    const externalId = context.listing.externalId;
    const id = externalId.startsWith(ROOM_TYPE_PREFIX) ? externalId.slice(ROOM_TYPE_PREFIX.length) : "";

    if (id === "") {
      throw new BookingError(
        "invalid_request",
        "NOT_BOOKABLE",
        "Cette annonce ne permet pas la réservation en ligne.",
        400
      );
    }
    return id;
  }

  /**
   * Séjour@ exige une date de FIN : une nuit sans date de sortie n'a pas de
   * sens dans un PMS hôtelier. Contrainte fournisseur : elle vit ici, pas
   * dans le contrat générique.
   */
  private requireSchedule(request: BookingRequest): { startDate: string; endDate: string } {
    const { startDate, endDate } = request.schedule;
    if (
      typeof startDate !== "string" ||
      startDate === "" ||
      typeof endDate !== "string" ||
      endDate === ""
    ) {
      throw new BookingError(
        "invalid_request",
        "MISSING_DATES",
        "check_in_date et check_out_date sont requis.",
        400
      );
    }
    return { startDate, endDate };
  }

  private authHeaders(context: ProviderContext): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": context.credentials.apiKey,
    };
  }

  private nightsBetween(startDate: string, endDate: string): number {
    const from = new Date(`${startDate}T00:00:00Z`).getTime();
    const to = new Date(`${endDate}T00:00:00Z`).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) return MINIMUM_NIGHTS;
    return Math.max(MINIMUM_NIGHTS, Math.round((to - from) / 86_400_000));
  }

  private upstreamError(
    status: number,
    data: Record<string, unknown>,
    fallbackMessage: string,
    fallbackCode: string
  ): BookingError {
    return new BookingError(
      classifyUpstreamStatus(status),
      fallbackCode,
      readString(data.error) ?? `${fallbackMessage} (HTTP ${status})`
    );
  }
}

// ── Utilitaires de lecture défensive ────────────────────────────────────────
//
// Le payload de Séjour@ n'est pas typé à la compilation. On lit chaque champ
// avec une garde, plutôt qu'un `as` qui mentirait sur la forme réelle.

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

const defaultTransport: HttpTransport = async (input, init) => {
  const response = await fetch(input, init as RequestInit);
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
  };
};
