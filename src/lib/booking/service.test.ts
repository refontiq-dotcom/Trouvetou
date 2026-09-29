import { beforeEach, describe, expect, it } from "vitest";
import { executeBooking } from "./service";
import { BookingError } from "./errors";
import { redactContext } from "@/lib/providers/context";
import { findAdapter, registerAdapter, resetRegistry } from "@/lib/providers/registry";
import {
  SejourraBookingAdapter,
  SEJOURA_PROVIDER_TYPE,
} from "@/connectors/sejoura/sejourra-booking-adapter";
import type {
  BookingCancellation,
  BookingConfirmation,
  BookingQuote,
  BookingRequest,
  ProviderAdapter,
} from "@/lib/providers/contract";
import type { ProviderContext } from "@/lib/providers/context";

// ============================================================================
// Tests du BookingService — le cœur ne doit connaître AUCUN SaaS.
//
// Ces tests utilisent deux doubles volontairement différents : un « faux
// Séjour@ » (transport HTTP simulé) et un « provider sans annulation ». Ils
// prouvent que le service pilote l'adapter choisi sans savoir ce qu'il y a
// derrière, et qu'il refuse une capacité absente AVANT l'appel.
// ============================================================================

const CONTEXT: ProviderContext = {
  providerId: "provider-1",
  listing: { listingId: "listing-1", externalId: "rt:room-1", basePrice: 20_000 },
  credentials: { apiKey: "secret-key" },
};

const REQUEST: BookingRequest = {
  schedule: { startDate: "2026-10-01", endDate: "2026-10-03" },
  partySize: 2,
  items: [{ itemId: "room-1" }],
  guest: { fullName: "Kouassi Yao" },
};

const NO_AVAILABILITY: BookingQuote = {
  available: true,
  availabilityCount: 0,
  totalAmount: null,
  currency: "XOF",
  amountSource: "provider",
};

/** Adapter sans annulation : sert à tester le refus de capacité. */
function bookingOnlyAdapter(): ProviderAdapter {
  return {
    id: "booking-only",
    capabilities: { booking: true, cancellation: false },
    quote: async () => NO_AVAILABILITY,
    create: async () => ({ bookingId: "B-1", status: "confirmed" }),
    // Présent pour satisfaire le contrat, mais JAMAIS appelé : c'est ce que
    // vérifie le test de capacité.
    cancel: async () => {
      throw new Error("cancel ne doit jamais être appelé sur cet adapter");
    },
  };
}

/** Adapter qui ne sait rien faire, pour tester le refus le plus précoce. */
function catalogOnlyAdapter(): ProviderAdapter {
  const forbidden = async (): Promise<never> => {
    throw new Error("ne doit jamais être appelé");
  };
  return {
    id: "catalog-only",
    capabilities: { booking: false, cancellation: false },
    quote: forbidden,
    create: forbidden,
    cancel: forbidden,
  };
}

beforeEach(() => {
  resetRegistry();
});

describe("executeBooking — résolution de l'adapter", () => {
  it("sélectionne l'adapter Séjour@ pour le provider sejoura", async () => {
    registerAdapter(
      new SejourraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ available: true, available_rooms: 2, estimated_total: 40_000 }),
        }),
      })
    );

    const quote = (await executeBooking(
      SEJOURA_PROVIDER_TYPE,
      "quote",
      CONTEXT,
      REQUEST
    )) as BookingQuote;

    expect(quote.available).toBe(true);
    expect(quote.totalAmount).toBe(40_000);
  });

  it("expose l'adapter enregistré dans le registre", () => {
    const adapter = new SejourraBookingAdapter({ baseUrl: "https://sejoura.test" });
    registerAdapter(adapter);

    expect(findAdapter(SEJOURA_PROVIDER_TYPE)).toBe(adapter);
  });

  it("échoue explicitement sur un provider inconnu", async () => {
    // Le message doit être actionnable : « pas de connecteur » et « pas de
    // provider en base » sont deux problèmes de nature différente.
    await expect(executeBooking("restaurant", "quote", CONTEXT, REQUEST)).rejects.toMatchObject({
      kind: "capability_unsupported",
      code: "PROVIDER_NOT_CONNECTED",
      httpStatus: 409,
    });
  });

  it("refuse d'enregistrer deux fois le même identifiant", () => {
    registerAdapter(new SejourraBookingAdapter({ baseUrl: "https://a.test" }));

    expect(() => registerAdapter(new SejourraBookingAdapter({ baseUrl: "https://b.test" }))).toThrow(
      /déjà enregistré/
    );
  });
});

describe("executeBooking — vérification des capacités", () => {
  it("refuse une réservation chez un provider qui ne réserve pas", async () => {
    registerAdapter(catalogOnlyAdapter());

    await expect(executeBooking("catalog-only", "create", CONTEXT, REQUEST)).rejects.toMatchObject({
      kind: "capability_unsupported",
      code: "CAPABILITY_UNSUPPORTED",
      httpStatus: 409,
    });
  });

  it("refuse une annulation chez un provider qui n'annule pas", async () => {
    registerAdapter(bookingOnlyAdapter());

    // `create` passe : seule `cancel` doit être bloquée.
    await expect(executeBooking("booking-only", "create", CONTEXT, REQUEST)).resolves.toMatchObject({
      bookingId: "B-1",
    });

    await expect(
      executeBooking("booking-only", "cancel", CONTEXT, undefined, "RES-1")
    ).rejects.toMatchObject({ kind: "capability_unsupported", code: "CAPABILITY_UNSUPPORTED" });
  });

  it("donne un message distinct pour l'absence de réservation et d'annulation", async () => {
    registerAdapter(bookingOnlyAdapter());

    await expect(
      executeBooking("booking-only", "cancel", CONTEXT, undefined, "R1")
    ).rejects.toThrow(/annulation/i);
    await expect(
      executeBooking("booking-only", "create", CONTEXT, REQUEST)
    ).resolves.toBeDefined();
  });
});

describe("executeBooking — transmission aux adapters", () => {
  it("transmet la demande de création au bon adapter", async () => {
    const received: BookingRequest[] = [];
    registerAdapter({
      id: "spy",
      capabilities: { booking: true, cancellation: true },
      quote: async () => NO_AVAILABILITY,
      create: async (request) => {
        received.push(request);
        return { bookingId: "SPY-1", status: "confirmed" };
      },
      cancel: async () => ({ status: "cancelled" }),
    });

    const result = (await executeBooking("spy", "create", CONTEXT, REQUEST)) as BookingConfirmation;

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(REQUEST);
    expect(result.bookingId).toBe("SPY-1");
  });

  it("transmet l'annulation au bon adapter avec le bon identifiant", async () => {
    const cancelled: string[] = [];
    registerAdapter({
      id: "spy",
      capabilities: { booking: true, cancellation: true },
      quote: async () => NO_AVAILABILITY,
      create: async () => ({ bookingId: "X", status: "confirmed" }),
      cancel: async (bookingId) => {
        cancelled.push(bookingId);
        return { status: "cancelled" };
      },
    });

    const result = (await executeBooking(
      "spy",
      "cancel",
      CONTEXT,
      undefined,
      "RES-42"
    )) as BookingCancellation;

    expect(cancelled).toEqual(["RES-42"]);
    expect(result.status).toBe("cancelled");
  });

  it("exige un booking_id pour annuler", async () => {
    registerAdapter(bookingOnlyAdapter());

    await expect(
      executeBooking("booking-only", "cancel", CONTEXT, undefined, "")
    ).rejects.toMatchObject({ kind: "invalid_request", code: "MISSING_BOOKING_ID" });
  });

  it("exige une demande pour réserver", async () => {
    registerAdapter(bookingOnlyAdapter());

    await expect(executeBooking("booking-only", "create", CONTEXT)).rejects.toMatchObject({
      kind: "invalid_request",
      code: "MISSING_REQUEST",
    });
  });
});

describe("executeBooking — traduction d'erreur", () => {
  it("laisse passer une BookingError de l'adapter telle quelle", async () => {
    registerAdapter({
      id: "failer",
      capabilities: { booking: true, cancellation: true },
      quote: async () => {
        throw new BookingError("conflict", "NO_ROOM", "Plus de chambres.", 409);
      },
      create: async () => ({ bookingId: "X", status: "confirmed" }),
      cancel: async () => ({ status: "cancelled" }),
    });

    // Le code métier doit survivre : le frontend en dépend.
    await expect(executeBooking("failer", "quote", CONTEXT, REQUEST)).rejects.toMatchObject({
      code: "NO_ROOM",
      httpStatus: 409,
    });
  });

  it("traduit une erreur brute en erreur générique, sans fuite de détail", async () => {
    registerAdapter({
      id: "leaky",
      capabilities: { booking: true, cancellation: true },
      quote: async () => {
        // Exemple de fuite : un message de stack trace contenant l'URL interne.
        throw new Error("connect ECONNREFUSED https://sejoura.test/api/v1/external/availability");
      },
      create: async () => ({ bookingId: "X", status: "confirmed" }),
      cancel: async () => ({ status: "cancelled" }),
    });

    // Le détail d'intégration ne doit JAMAIS atteindre le client.
    await expect(executeBooking("leaky", "quote", CONTEXT, REQUEST)).rejects.toMatchObject({
      kind: "upstream_unavailable",
      code: "PROVIDER_ERROR",
      httpStatus: 502,
      message: "Le service de réservation est momentanément indisponible.",
    });
  });
});

describe("ProviderContext — non-exposition des secrets", () => {
  it("redirige la clé dans les traces", () => {
    // Un `console.error(context)` écrirait la clé en clair dans les logs de
    // production. `redactContext` est l'outil prévu pour l'éviter.
    const redacted = redactContext(CONTEXT);

    expect(redacted.credentials).toEqual({ apiKey: "[redacted]" });
    expect(JSON.stringify(redacted)).not.toContain("secret-key");
  });

  it("conserve les informations utiles au diagnostic", () => {
    const redacted = redactContext(CONTEXT);

    // Un log de diagnostic sans provider ni annonce n'a aucun intérêt.
    expect(redacted.providerId).toBe("provider-1");
    expect(redacted.listing).toMatchObject({
      listingId: "listing-1",
      externalId: "rt:room-1",
    });
  });

  it("ne modifie pas le contexte d'origine", () => {
    redactContext(CONTEXT);
    expect(CONTEXT.credentials.apiKey).toBe("secret-key");
  });
});
