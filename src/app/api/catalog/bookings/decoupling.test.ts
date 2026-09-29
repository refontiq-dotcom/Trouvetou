import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findAdapter, registerAdapter, resetRegistry } from "@/lib/providers/registry";
import { executeBooking } from "@/lib/booking/service";
import { SejouraBookingAdapter } from "@/connectors/sejoura/sejoura-booking-adapter";
import type { ProviderContext } from "@/lib/providers/context";
import type { BookingRequest } from "@/lib/providers/contract";

// ============================================================================
// Non-régression du DÉCOUPLAGE de la route Booking.
//
// Ces tests ne testent pas la route HTTP (elle reste couche mince, testée par
// les tests de l'adapter et du service) mais une PROPRIÉTÉ STRUCTURELLE : la
// route ne doit plus contenir de logique Séjour@ pour check / create / cancel.
//
// Un test de source est atypique, mais c'est le seul moyen de PRÉVENIR une
// régression de couplage : un test comportemental passerait aussi bien avec un
// `fetch` direct codé en dur qu'avec un adapter. Celui-ci échoue dès qu'une
// ligne réintroduit le couplage, ce qui est exactement le risque.
// ============================================================================

const ROUTE_PATH = resolve(process.cwd(), "src/app/api/catalog/bookings/route.ts");
const routeSource = readFileSync(ROUTE_PATH, "utf8");

/** Extrait le bloc d'une action, de son commentaire jusqu'au `if` suivant. */
function actionBlock(marker: string, endMarker?: string): string {
  const start = routeSource.indexOf(marker);
  if (start === -1) return "";
  const end = endMarker === undefined ? -1 : routeSource.indexOf(endMarker, start);
  return routeSource.slice(start, end === -1 ? undefined : end);
}

describe("Route Booking — absence de fetch direct vers Séjour@", () => {
  it("n'appelle plus /api/v1/external/availability", () => {
    // `check` passe désormais par `executeBooking` -> registry -> adapter.
    expect(routeSource).not.toContain("/api/v1/external/availability");
  });

  it("n'appelle plus /api/v1/external/bookings", () => {
    expect(routeSource).not.toContain("/api/v1/external/bookings");
  });

  it("n'appelle plus /api/v1/external/bookings/cancel", () => {
    expect(routeSource).not.toContain("/api/v1/external/bookings/cancel");
  });

  it("ne construit plus d'URL Séjour@ dans l'opération migrée", () => {
    // `new URL(...)` était le mécanisme de l'endpoint availability.
    const migrated = actionBlock('if (action === "check")', 'if (action === "cancel")');
    expect(migrated).not.toContain("new URL(");
    expect(migrated).not.toContain("SEJOURA_API_URL");
  });

  it("ne construit plus de payload Séjour@ dans check et create", () => {
    const check = actionBlock('if (action === "check")', 'if (action === "cancel")');
    const create = actionBlock('// ── Action "create"');

    // Ces clés n'existent que dans le contrat de Séjour@.
    expect(check).not.toContain("check_in=");
    expect(create).not.toContain("room_type_id");
    expect(create).not.toContain("check_in_date:");
    expect(create).not.toContain("full_name:");
  });
});

describe("Route Booking — absence de parsing métier Séjour@", () => {
  it("ne définit plus parseRoomTypeId", () => {
    expect(routeSource).not.toContain("parseRoomTypeId");
  });

  it("ne teste plus le préfixe rt: pour décider de la réservabilité", () => {
    // Avant, la route refusait l'annonce si l'external_id ne commençait pas
    // par `rt:`. Ce contrôle appartient à l'adapter.
    const beforeCheck = routeSource.slice(0, routeSource.indexOf('if (action === "check")'));
    expect(beforeCheck).not.toContain('startsWith("rt:")');
  });

  it("délègue effectivement les trois opérations au BookingService", () => {
    // Preuve positive : la route appelle bien le service pour chaque
    // opération migrée, et non pas par hasard.
    expect(routeSource).toContain('"quote",');
    expect(routeSource).toContain('"cancel",');
    expect(routeSource).toContain('"create",');
    expect(routeSource.match(/executeBooking\(/g)?.length).toBe(3);
  });

  it("résout le type depuis providers.type, jamais depuis le nom", () => {
    expect(routeSource).toContain("providers!inner(id, type, is_active)");
    expect(routeSource).not.toMatch(/provider\.name\s*===\s*["']S/);
  });
});

describe("Route Booking — arrival tracking laissé intact", () => {
  it("conserve l'endpoint de tracking (hors périmètre de cette phase)", () => {
    // Le tracking n'est PAS migré : il reste branché comme avant, et c'est
    // volontaire. Ce test verrouille ce choix pour qu'on ne l'oublie pas.
    expect(routeSource).toContain("/api/v1/external/arrival-tracking");
  });

  it("conserve ses quatre actions", () => {
    for (const action of ["start_tracking", "update_tracking", "stop_tracking", "status_tracking"]) {
      expect(routeSource).toContain(action);
    }
  });
});

describe("Route Booking — registre et types de provider", () => {
  it("n'enregistre que l'adapter Séjour@", () => {
    expect(routeSource).toContain("registerAdapter(new SejouraBookingAdapter");
    // Aucun fallback : un seul enregistrement.
    expect(routeSource.match(/registerAdapter\(/g)).toHaveLength(1);
  });

  it("ne déduit jamais un type depuis un nom de provider", () => {
    // Interdit explicite de la mission : le fallback `unknown -> sejoura`
    // ferait réserver chez un PMS qui n'est pas le bon.
    expect(routeSource).not.toMatch(/type\s*===\s*["']unknown["']\s*\?\s*["']sejoura/);
  });
});

// ============================================================================
// Résolution effective via le registre, avec un adapter simulé.
// ============================================================================

const CONTEXT: ProviderContext = {
  providerId: "a5101284-2d97-46e0-a0f2-fa6a008588f2",
  listing: { listingId: "l1", externalId: "rt:42", basePrice: 20_000 },
  credentials: { apiKey: "secret" },
};

const REQUEST: BookingRequest = {
  schedule: { startDate: "2026-10-01", endDate: "2026-10-03" },
  partySize: 2,
  items: [],
  guest: { fullName: "Kouassi" },
};

describe("Résolution registry — type sejoura", () => {
  it("sélectionne SejouraBookingAdapter pour un provider de type sejoura", async () => {
    resetRegistry();
    let called = false;
    registerAdapter(
      new SejouraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => {
          called = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({ available: true, estimated_total: 50_000 }),
          };
        },
      })
    );

    // `sejoura` est l'identifiant technique issu de `providers.type`.
    await executeBooking("sejoura", "quote", CONTEXT, REQUEST);

    expect(called).toBe(true);
    expect(findAdapter("sejoura")).toBeInstanceOf(SejouraBookingAdapter);
    resetRegistry();
  });
});

describe("Résolution registry — type unknown", () => {
  it("refuse un provider unknown avec PROVIDER_NOT_CONNECTED", async () => {
    resetRegistry();
    registerAdapter(new SejouraBookingAdapter({ baseUrl: "https://sejoura.test" }));

    // Un provider `unknown` ne doit JAMAIS tomber sur Séjour@.
    await expect(executeBooking("unknown", "quote", CONTEXT, REQUEST)).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONNECTED",
      kind: "capability_unsupported",
      httpStatus: 409,
    });
    resetRegistry();
  });

  it("ne déclenche aucun appel HTTP pour un provider unknown", async () => {
    resetRegistry();
    let networkCalls = 0;
    registerAdapter(
      new SejouraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => {
          networkCalls += 1;
          return { ok: true, status: 200, json: async () => ({}) };
        },
      })
    );

    await expect(executeBooking("unknown", "create", CONTEXT, REQUEST)).rejects.toBeDefined();
    await expect(executeBooking("unknown", "cancel", CONTEXT, undefined, "R1")).rejects.toBeDefined();

    // C'est LA garantie centrale de la phase : aucun fallback, aucun appel.
    expect(networkCalls).toBe(0);
    resetRegistry();
  });
});
