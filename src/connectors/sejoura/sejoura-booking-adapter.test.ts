import { describe, expect, it } from "vitest";
import {
  SejouraBookingAdapter,
  SEJOURA_PROVIDER_TYPE,
  type HttpTransport,
} from "./sejoura-booking-adapter";
import { BookingError } from "@/lib/booking/errors";
import type { BookingRequest } from "@/lib/providers/contract";
import type { ProviderContext } from "@/lib/providers/context";

// ============================================================================
// Tests de l'adapter Séjoura — SANS RÉSEAU.
//
// Le transport HTTP est injecté et remplacé par un double : aucun appel ne
// sort du processus. Ces tests vérifient les deux sens de la traduction :
//
//   TrouveTout générique  →  Séjour@     (payload, URL, en-têtes)
//   Séjour@               →  générique  (réponse, erreur)
//
// C'est ce que la Phase 2B laissera passer en production, donc c'est ce qui
// doit être verrouillé.
// ============================================================================

const BASE_URL = "https://sejoura.test";

/** Appels HTTP enregistrés, pour vérifier URL, méthode, en-têtes et corps. */
interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/** Double de transport : renvoie une réponse programmable et enregistre l'appel. */
function stubTransport(
  response: { ok: boolean; status: number; json: unknown },
  calls: RecordedCall[] = []
): HttpTransport {
  return async (input, init) => {
    calls.push({ url: input, method: init.method, headers: init.headers, body: init.body });
    return { ok: response.ok, status: response.status, json: async () => response.json };
  };
}

function makeContext(overrides: Partial<ProviderContext> = {}): ProviderContext {
  return {
    providerId: "provider-1",
    listing: { listingId: "listing-1", externalId: "rt:room-type-42", basePrice: 25_000 },
    credentials: { apiKey: "secret-sejoura-key" },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    schedule: { startDate: "2026-10-01", endDate: "2026-10-04" },
    partySize: 2,
    items: [{ itemId: "room-type-42" }],
    notes: null,
    guest: { fullName: "Awa N'Guessan", phone: "+2250700000000", email: "awa@test.ci" },
    ...overrides,
  };
}

function makeAdapter(transport: HttpTransport): SejouraBookingAdapter {
  return new SejouraBookingAdapter({ baseUrl: BASE_URL, transport });
}

function withExternalId(externalId: string): Partial<ProviderContext> {
  return { listing: { listingId: "l", externalId, basePrice: null } };
}

describe("SejouraBookingAdapter — identité et capacités", () => {
  it("s'identifie par un identifiant technique stable", () => {
    expect(makeAdapter(stubTransport({ ok: true, status: 200, json: {} })).id).toBe(
      SEJOURA_PROVIDER_TYPE
    );
  });

  it("déclare réserver et annuler, et rien de plus", () => {
    const adapter = makeAdapter(stubTransport({ ok: true, status: 200, json: {} }));
    expect(adapter.capabilities).toEqual({ booking: true, cancellation: true });
  });
});

describe("SejouraBookingAdapter — external_id vers room_type_id", () => {
  it("extrait l'identifiant de type de chambre du préfixe rt:", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(
      stubTransport({ ok: true, status: 200, json: { available: true } }, calls)
    );

    await adapter.quote(makeRequest(), makeContext());

    // L'identifiant voyage en query param, sans le préfixe.
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/api/v1/external/availability");
    expect(url.searchParams.get("room_type_id")).toBe("room-type-42");
  });

  it.each([
    ["school-42", "identifiant d'école"],
    ["", "identifiant vide"],
    ["rt:", "préfixe sans valeur"],
    ["RT:room-1", "mauvaise casse"],
  ])("refuse l'external_id « %s » (%s)", async (externalId) => {
    const adapter = makeAdapter(stubTransport({ ok: true, status: 200, json: {} }));

    await expect(
      adapter.quote(makeRequest(), makeContext(withExternalId(externalId)))
    ).rejects.toMatchObject({ kind: "invalid_request", code: "NOT_BOOKABLE" });
  });

  it("ne fait AUCUN appel réseau quand l'annonce n'est pas réservable", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(stubTransport({ ok: true, status: 200, json: {} }, calls));

    await expect(
      adapter.quote(makeRequest(), makeContext(withExternalId("school-1")))
    ).rejects.toBeInstanceOf(BookingError);

    expect(calls).toHaveLength(0);
  });
});

describe("SejouraBookingAdapter — authentification", () => {
  it("transmet la clé en en-tête x-api-key, jamais dans l'URL", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(
      stubTransport({ ok: true, status: 200, json: { available: true } }, calls)
    );

    await adapter.quote(makeRequest(), makeContext());

    expect(calls[0].headers["x-api-key"]).toBe("secret-sejoura-key");
    expect(calls[0].url).not.toContain("secret-sejoura-key");
  });

  it("déclare le type de contenu JSON", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(
      stubTransport({ ok: true, status: 200, json: { available: true } }, calls)
    );

    await adapter.quote(makeRequest(), makeContext());

    expect(calls[0].headers["Content-Type"]).toBe("application/json");
  });
});

describe("SejouraBookingAdapter — quote", () => {
  it("appelle GET sur /api/v1/external/availability avec les bonnes dates", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(
      stubTransport({ ok: true, status: 200, json: { available: true, available_rooms: 3 } }, calls)
    );

    await adapter.quote(makeRequest(), makeContext());

    const url = new URL(calls[0].url);
    expect(calls[0].method).toBe("GET");
    expect(url.searchParams.get("check_in")).toBe("2026-10-01");
    expect(url.searchParams.get("check_out")).toBe("2026-10-04");
  });

  it("privilégie le montant du provider et le marque comme tel", async () => {
    const adapter = makeAdapter(
      stubTransport({ ok: true, status: 200, json: { available: true, estimated_total: 90_000 } })
    );

    const quote = await adapter.quote(makeRequest(), makeContext());

    // 90 000 vient du PMS : c'est la source de vérité, pas une estimation.
    expect(quote.totalAmount).toBe(90_000);
    expect(quote.amountSource).toBe("provider");
  });

  it("retombe sur une estimation et le signale si le provider ne chiffre pas", async () => {
    const adapter = makeAdapter(stubTransport({ ok: true, status: 200, json: { available: true } }));

    // 3 nuits × 25 000 FCFA.
    const quote = await adapter.quote(makeRequest(), makeContext());

    expect(quote.totalAmount).toBe(75_000);
    expect(quote.amountSource).toBe("estimated");
  });

  it("refuse une date de fin manquante : Séjour@ exige une date de sortie", async () => {
    const adapter = makeAdapter(stubTransport({ ok: true, status: 200, json: {} }));

    await expect(
      adapter.quote(
        makeRequest({ schedule: { startDate: "2026-10-01", endDate: null } }),
        makeContext()
      )
    ).rejects.toMatchObject({ kind: "invalid_request", code: "MISSING_DATES" });
  });

  it("traduit une erreur amont en BookingError normalisée", async () => {
    const adapter = makeAdapter(
      stubTransport({ ok: false, status: 500, json: { error: "Panne du PMS" } })
    );

    await expect(adapter.quote(makeRequest(), makeContext())).rejects.toMatchObject({
      kind: "upstream_unavailable",
    });
  });

  it("traduit 401 amont en « credentials refusées », exposée en 409", async () => {
    // Réessayer ne sert à rien tant que la configuration n'est pas corrigée :
    // un 502 ferait croire à une panne transitoire.
    const adapter = makeAdapter(
      stubTransport({ ok: false, status: 401, json: { error: "Clé invalide" } })
    );

    await expect(adapter.quote(makeRequest(), makeContext())).rejects.toMatchObject({
      kind: "upstream_unauthorized",
      httpStatus: 409,
    });
  });
});

describe("SejouraBookingAdapter — create", () => {
  it("envoie le payload au format Séjour@ sur POST /api/v1/external/bookings", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(
      stubTransport(
        { ok: true, status: 201, json: { booking: { booking_code: "RES-1", status: "confirmed" } } },
        calls
      )
    );

    await adapter.create(makeRequest(), makeContext());

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(`${BASE_URL}/api/v1/external/bookings`);
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual({
      room_type_id: "room-type-42",
      check_in_date: "2026-10-01",
      check_out_date: "2026-10-04",
      number_of_guests: 2,
      special_requests: null,
      guest: {
        full_name: "Awa N'Guessan",
        phone: "+2250700000000",
        email: "awa@test.ci",
      },
    });
  });

  it("normalise la réponse Séjour@ en confirmation générique", async () => {
    const adapter = makeAdapter(
      stubTransport({
        ok: true,
        status: 201,
        json: { booking: { booking_code: "RES-1", status: "confirmed", total_amount: 90_000 } },
      })
    );

    const confirmation = await adapter.create(makeRequest(), makeContext());

    expect(confirmation.bookingId).toBe("RES-1");
    expect(confirmation.status).toBe("confirmed");
    expect(confirmation.totalAmount).toBe(90_000);
  });

  it("convertit un 409 amont en conflit métier, pas en panne", async () => {
    // C'est le cas « plus de chambres disponibles » : le message doit le dire.
    const adapter = makeAdapter(
      stubTransport({ ok: false, status: 409, json: { error: "Aucune chambre disponible" } })
    );

    await expect(adapter.create(makeRequest(), makeContext())).rejects.toMatchObject({
      kind: "conflict",
      httpStatus: 409,
      message: "Aucune chambre disponible",
    });
  });

  it("reporte le code d'erreur amont quand le provider en fournit un", async () => {
    const adapter = makeAdapter(
      stubTransport({ ok: false, status: 409, json: { code: "NO_ROOM", error: "Complet" } })
    );

    await expect(adapter.create(makeRequest(), makeContext())).rejects.toMatchObject({
      code: "NO_ROOM",
    });
  });

  it("retombe sur BOOKING_FAILED si le provider ne fournit pas de code", async () => {
    const adapter = makeAdapter(stubTransport({ ok: false, status: 500, json: {} }));

    await expect(adapter.create(makeRequest(), makeContext())).rejects.toMatchObject({
      code: "BOOKING_FAILED",
    });
  });
});

describe("SejouraBookingAdapter — cancel", () => {
  it("appelle POST /api/v1/external/bookings/cancel avec le booking_id", async () => {
    const calls: RecordedCall[] = [];
    const adapter = makeAdapter(
      stubTransport({ ok: true, status: 200, json: { booking: { status: "cancelled" } } }, calls)
    );

    await adapter.cancel("RES-1", makeContext());

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(`${BASE_URL}/api/v1/external/bookings/cancel`);
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual({ booking_id: "RES-1", reason: null });
  });

  it("traduit un 404 en BOOKING_NOT_FOUND", async () => {
    const adapter = makeAdapter(
      stubTransport({ ok: false, status: 404, json: { error: "Réservation introuvable" } })
    );

    await expect(adapter.cancel("RES-X", makeContext())).rejects.toMatchObject({
      kind: "not_found",
      code: "BOOKING_NOT_FOUND",
      httpStatus: 404,
    });
  });

  it("traduit un 403 en BOOKING_ACTION_FORBIDDEN", async () => {
    const adapter = makeAdapter(stubTransport({ ok: false, status: 403, json: {} }));

    await expect(adapter.cancel("RES-1", makeContext())).rejects.toMatchObject({
      code: "BOOKING_ACTION_FORBIDDEN",
    });
  });

  it("retombe sur CANCEL_FAILED pour une panne amont", async () => {
    const adapter = makeAdapter(stubTransport({ ok: false, status: 500, json: {} }));

    await expect(adapter.cancel("RES-1", makeContext())).rejects.toMatchObject({
      code: "CANCEL_FAILED",
      kind: "upstream_unavailable",
    });
  });
});
