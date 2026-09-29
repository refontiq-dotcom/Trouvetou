import { beforeEach, describe, expect, it } from "vitest";
import { executeTracking } from "./service";
import { registerTrackingAdapter, resetRegistry, hasTrackingAdapter } from "@/lib/providers/registry";
import { SejouraArrivalTrackingAdapter } from "@/connectors/sejoura/sejoura-arrival-tracking-adapter";
import type { ArrivalTrackingAdapter } from "./contract";
import type { ProviderContext } from "@/lib/providers/context";

// ============================================================================
// Tests du service de suivi — il ignore tout fournisseur particulier.
// ============================================================================

const CONTEXT: ProviderContext = {
  providerId: "p1",
  listing: { listingId: "l1", externalId: "rt:1", basePrice: 10_000 },
  credentials: { apiKey: "secret" },
};

const REQUEST = { bookingId: "RES-1", publicToken: "tok" } as const;

beforeEach(() => {
  resetRegistry();
});

describe("executeTracking — résolution du provider", () => {
  it("sélectionne l'adapter correspondant à provider.type", async () => {
    registerTrackingAdapter(
      new SejouraArrivalTrackingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }),
      })
    );

    const result = await executeTracking("sejoura", "start", REQUEST, CONTEXT);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true });
    expect(hasTrackingAdapter("sejoura")).toBe(true);
  });

  it("refuse un provider unknown sans jamais basculer vers Séjour@", async () => {
    let networkCalls = 0;
    registerTrackingAdapter(
      new SejouraArrivalTrackingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => {
          networkCalls += 1;
          return { ok: true, status: 200, json: async () => ({}) };
        },
      })
    );

    // Un provider non typé ne doit jamais être traité comme Séjour@.
    await expect(executeTracking("unknown", "start", REQUEST, CONTEXT)).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONNECTED",
      httpStatus: 409,
    });
    expect(networkCalls).toBe(0);
  });

  it("refuse un provider qui réserve mais ne sait pas suivre", async () => {
    // Cas réel : un PMS sans suivi GPS. L'absence dans le registre de suivi
    // EST l'information.
    const result = await executeTracking("restaurant", "start", REQUEST, CONTEXT).catch(
      (error: unknown) => error
    );

    expect(result).toMatchObject({ code: "PROVIDER_NOT_CONNECTED" });
  });
});

describe("executeTracking — les quatre opérations", () => {
  it("transmet chaque verbe au bon appel de l'adapter", async () => {
    const seen: string[] = [];
    const adapter: ArrivalTrackingAdapter = {
      providerType: "spy",
      start: async () => {
        seen.push("start");
        return { status: 200, body: {} };
      },
      update: async () => {
        seen.push("update");
        return { status: 200, body: {} };
      },
      stop: async () => {
        seen.push("stop");
        return { status: 200, body: {} };
      },
      status: async () => {
        seen.push("status");
        return { status: 200, body: {} };
      },
    };
    registerTrackingAdapter(adapter);

    for (const operation of ["start", "update", "stop", "status"] as const) {
      await executeTracking("spy", operation, REQUEST, CONTEXT);
    }

    expect(seen).toEqual(["start", "update", "stop", "status"]);
  });

  it("propage le statut et le corps sans transformation", async () => {
    // Le suivi est un PASSE-THROUGH : un 409 fournisseur reste un 409.
    registerTrackingAdapter({
      providerType: "raw",
      start: async () => ({ status: 409, body: { error: "Suivi déjà démarré" } }),
      update: async () => ({ status: 200, body: {} }),
      stop: async () => ({ status: 200, body: {} }),
      status: async () => ({ status: 200, body: {} }),
    });

    const result = await executeTracking("raw", "start", REQUEST, CONTEXT);

    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: "Suivi déjà démarré" });
  });

  it("traduit une panne réseau en erreur 502 identifiée", async () => {
    registerTrackingAdapter({
      providerType: "broken",
      start: async () => {
        throw new Error("ECONNREFUSED https://internal.test/api");
      },
      update: async () => ({ status: 200, body: {} }),
      stop: async () => ({ status: 200, body: {} }),
      status: async () => ({ status: 200, body: {} }),
    });

    // L'appel n'a pas atteint le fournisseur : pas de statut amont, donc 502.
    // Le détail technique ne doit pas fuiter au client.
    await expect(executeTracking("broken", "start", REQUEST, CONTEXT)).rejects.toMatchObject({
      status: 502,
      code: "TRACKING_UNAVAILABLE",
    });
    await expect(executeTracking("broken", "start", REQUEST, CONTEXT)).rejects.not.toThrow(
      /internal\.test/
    );
  });
});

describe("Registry — cloisonnement par domaine", () => {
  it("conserve les deux registres lors d'une remise à zéro", () => {
    // Réinitialiser le tracking ne doit pas désenregistrer la réservation.
    registerTrackingAdapter(
      new SejouraArrivalTrackingAdapter({ baseUrl: "https://sejoura.test" })
    );
    expect(hasTrackingAdapter("sejoura")).toBe(true);

    resetRegistry();

    expect(hasTrackingAdapter("sejoura")).toBe(false);
  });

  it("refuse deux adapters de suivi pour le même provider", () => {
    registerTrackingAdapter(new SejouraArrivalTrackingAdapter({ baseUrl: "https://a.test" }));

    expect(() =>
      registerTrackingAdapter(new SejouraArrivalTrackingAdapter({ baseUrl: "https://b.test" }))
    ).toThrow(/déjà enregistré/);
  });
});
