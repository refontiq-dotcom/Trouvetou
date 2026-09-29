import { describe, expect, it } from "vitest";
import { SejouraArrivalTrackingAdapter, type TrackingTransport } from "./sejoura-arrival-tracking-adapter";
import { SEJOURA_PROVIDER_TYPE } from "./sejoura-booking-adapter";
import type { ProviderContext } from "@/lib/providers/context";
import type { TrackingRequest } from "@/lib/arrival-tracking/contract";

// ============================================================================
// Tests du connecteur Séjour@ pour le suivi d'arrivée — SANS RÉSEAU.
//
// Le transport HTTP est injecté : aucun appel ne sort du processus. Ces tests
// verrouillent le CONTRAT PUBLIC du fournisseur, qui ne doit pas bouger :
// URL, endpoint, charge utile discriminée par `action`, en-têtes, passe-through
// du JSON et du statut HTTP.
// ============================================================================

const BASE_URL = "https://sejoura.test";

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function stubTransport(
  response: { ok: boolean; status: number; json?: unknown; throwOnJson?: boolean },
  calls: RecordedCall[] = []
): TrackingTransport {
  return async (input, init) => {
    calls.push({ url: input, method: init.method, headers: init.headers, body: init.body });
    return {
      ok: response.ok,
      status: response.status,
      json: response.throwOnJson
        ? () => Promise.reject(new SyntaxError("Unexpected token < in JSON"))
        : async () => response.json ?? {},
    };
  };
}

const CONTEXT: ProviderContext = {
  providerId: "a5101284-2d97-46e0-a0f2-fa6a008588f2",
  listing: { listingId: "l1", externalId: "rt:42", basePrice: 20_000 },
  credentials: { apiKey: "secret-sejoura-key" },
};

function request(overrides: Partial<TrackingRequest> = {}): TrackingRequest {
  return { bookingId: "RES-42", publicToken: null, ...overrides };
}

function adapter(transport: TrackingTransport): SejouraArrivalTrackingAdapter {
  return new SejouraArrivalTrackingAdapter({ baseUrl: BASE_URL, transport });
}

function payloadOf(call: RecordedCall): Record<string, unknown> {
  return JSON.parse(call.body ?? "{}") as Record<string, unknown>;
}

describe("SejouraArrivalTrackingAdapter — identité", () => {
  it("expose le même providerType que le connecteur de réservation", () => {
    // Les deux adaptateurs doivent partager la clé de registre, sans quoi un
    // provider fonctionnel serait vu comme deux connecteurs distincts.
    expect(adapter(stubTransport({ ok: true, status: 200 })).providerType).toBe(
      SEJOURA_PROVIDER_TYPE
    );
  });

  it("ignore le slash final de l'URL de base", () => {
    const calls: RecordedCall[] = [];
    const withSlash = new SejouraArrivalTrackingAdapter({
      baseUrl: "https://sejoura.test/",
      transport: stubTransport({ ok: true, status: 200 }, calls),
    });

    void withSlash.start(request(), CONTEXT);
    expect(calls[0].url).toBe("https://sejoura.test/api/v1/external/arrival-tracking");
  });
});

describe("SejouraArrivalTrackingAdapter — endpoint et méthode", () => {
  it("appelle POST sur /api/v1/external/arrival-tracking pour les quatre verbes", async () => {
    for (const operation of ["start", "update", "stop", "status"] as const) {
      const calls: RecordedCall[] = [];
      const a = adapter(stubTransport({ ok: true, status: 200 }, calls));

      await a[operation](
        request({ position: { latitude: 5.35, longitude: -3.98, accuracy: 10 }, publicToken: "tok" }),
        CONTEXT
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe("POST");
      expect(calls[0].url).toBe(`${BASE_URL}/api/v1/external/arrival-tracking`);
    }
  });
});

describe("SejouraArrivalTrackingAdapter — charges utiles", () => {
  it("start envoie action, booking_id et public_token", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).start(
      request({ publicToken: "session-token" }),
      CONTEXT
    );

    expect(payloadOf(calls[0])).toEqual({
      action: "start",
      booking_id: "RES-42",
      public_token: "session-token",
    });
  });

  it("stop envoie action, booking_id et public_token", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).stop(
      request({ publicToken: "session-token" }),
      CONTEXT
    );

    expect(payloadOf(calls[0])).toEqual({
      action: "stop",
      booking_id: "RES-42",
      public_token: "session-token",
    });
  });

  it("status envoie action, booking_id et public_token", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).status(
      request({ publicToken: "session-token" }),
      CONTEXT
    );

    expect(payloadOf(calls[0])).toEqual({
      action: "status",
      booking_id: "RES-42",
      public_token: "session-token",
    });
  });

  it("update envoie latitude, longitude et accuracy", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).update(
      request({ position: { latitude: 5.35, longitude: -3.98, accuracy: 12 } }),
      CONTEXT
    );

    expect(payloadOf(calls[0])).toEqual({
      action: "update",
      booking_id: "RES-42",
      latitude: 5.35,
      longitude: -3.98,
      accuracy: 12,
    });
  });

  it("omet public_token quand il est absent", async () => {
    // Le champ était OPTIONNEL avant l'extraction : le rendre obligatoire
    // changerait le contrat d'origine.
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).start(
      request({ publicToken: null }),
      CONTEXT
    );

    expect(payloadOf(calls[0])).not.toHaveProperty("public_token");
  });

  it("omet accuracy quand elle est absente", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).update(
      request({ position: { latitude: 5.35, longitude: -3.98, accuracy: null } }),
      CONTEXT
    );

    const payload = payloadOf(calls[0]);
    expect(payload).not.toHaveProperty("accuracy");
    expect(payload.latitude).toBe(5.35);
    expect(payload.longitude).toBe(-3.98);
  });

  it("n'envoie pas de position sur start, stop et status", async () => {
    // Comportement d'origine : latitude/longitude uniquement sur `update`.
    for (const operation of ["start", "stop", "status"] as const) {
      const calls: RecordedCall[] = [];
      await adapter(stubTransport({ ok: true, status: 200 }, calls))[operation](
        request({ position: { latitude: 5.35, longitude: -3.98, accuracy: 5 } }),
        CONTEXT
      );

      const payload = payloadOf(calls[0]);
      expect(payload).not.toHaveProperty("latitude");
      expect(payload).not.toHaveProperty("longitude");
    }
  });
});

describe("SejouraArrivalTrackingAdapter — authentification", () => {
  it("transmet la clé du contexte en en-tête x-api-key", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).start(request(), CONTEXT);

    expect(calls[0].headers["x-api-key"]).toBe("secret-sejoura-key");
  });

  it("ne place jamais la clé dans l'URL ni dans le corps", async () => {
    // La clé ne doit pas fuiter dans un journal d'URL ou un corps tracé.
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).start(request(), CONTEXT);

    expect(calls[0].url).not.toContain("secret-sejoura-key");
    expect(calls[0].body).not.toContain("secret-sejoura-key");
  });

  it("déclare le type de contenu JSON", async () => {
    const calls: RecordedCall[] = [];
    await adapter(stubTransport({ ok: true, status: 200 }, calls)).start(request(), CONTEXT);

    expect(calls[0].headers["Content-Type"]).toBe("application/json");
  });
});

describe("SejouraArrivalTrackingAdapter — passe-through", () => {
  it.each([
    [200, { success: true, token: "abc" }],
    [201, { success: true }],
    [400, { error: "Réservation inconnue" }],
    [401, { error: "Clé invalide" }],
    [409, { error: "Suivi déjà démarré" }],
    [500, { error: "Panne" }],
  ])("propage le statut %i et le JSON sans transformation", async (status, json) => {
    const a = adapter(stubTransport({ ok: status < 400, status, json }));

    const result = await a.status(request(), CONTEXT);

    // AUCUNE normalisation : c'est la contrainte de compatibilité de la phase.
    expect(result.status).toBe(status);
    expect(result.body).toEqual(json);
  });

  it("renvoie un objet vide si la réponse n'est pas du JSON", async () => {
    // Comportement d'origine (`json().catch(() => ({}))`) : une page d'erreur
    // HTML ne doit pas faire échouer l'appel.
    const a = adapter(stubTransport({ ok: true, status: 200, throwOnJson: true }));

    const result = await a.status(request(), CONTEXT);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({});
  });
});
