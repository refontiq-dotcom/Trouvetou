import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { findAdapter, registerAdapter, resetRegistry } from "@/lib/providers/registry";
import { executeBooking } from "@/lib/booking/service";
import { SejouraBookingAdapter } from "@/connectors/sejoura/sejoura-booking-adapter";
import type { ProviderContext } from "@/lib/providers/context";
import type {
  BookingCancellation,
  BookingQuote,
  BookingRequest,
} from "@/lib/providers/contract";

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

/** Faute du nom officiel du provider, à ne jamais réintroduire. */
const TYPO_PATTERN = /sejo" + "urra|Sejo" + "urra/;

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

describe("Route Booking — arrival tracking désormais extrait", () => {
  it("n'appelle plus l'endpoint de tracking Séjour@", () => {
    // Phase 2C.1 : le suivi est passé par l'ArrivalTrackingService. Ce test
    // affirmait l'inverse ; il vérifie maintenant l'absence de couplage —
    // c'est la preuve que l'extraction a eu lieu.
    expect(routeSource).not.toContain("/api/v1/external/arrival-tracking");
  });

  it("ne construit plus la charge utile de tracking Séjour@", () => {
    // Ni le discriminant `action`, ni les noms de champs propres à Séjour@.
    const block = actionBlock('if (action === "start_tracking"');
    expect(block).not.toContain('payload.public_token');
    expect(block).not.toContain('payload.latitude');
  });

  it("délègue le suivi à l'ArrivalTrackingService", () => {
    expect(routeSource).toContain("executeTracking(");
    // Les quatre actions restent routées, mais ne construisent plus de payload.
    for (const action of ["start_tracking", "update_tracking", "stop_tracking", "status_tracking"]) {
      expect(routeSource).toContain(action);
    }
  });

  it("restitue le JSON et le statut du fournisseur sans enveloppe", () => {
    // Passe-through : c'est la contrainte de compatibilité de la phase.
    expect(routeSource).toContain("NextResponse.json(result.body, { status: result.status })");
  });

  it("conserve la validation booking_id et ses quotas propres", () => {
    // Les protections ne migrent pas avec la logique métier.
    expect(routeSource).toContain('"MISSING_BOOKING_ID"');
    for (const quota of ["start_tracking:", "update_tracking:", "stop_tracking:", "status_tracking:"]) {
      expect(routeSource).toContain(quota);
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

describe("Route Booking — absence de couplage via parseur Séjour@", () => {
  it("n'importe plus aucun parseur Séjour@", () => {
    // Le format `rt:` est un détail du PMS : seul l'adapter le connaît.
    expect(routeSource).not.toContain("parseSejouraRoomTypeId");
    expect(routeSource).not.toContain("parseRoomTypeId");
  });

  it("n'importe plus que l'IDENTITÉ de l'adapter, pas son outillage interne", () => {
    // Importer `SejouraBookingAdapter` est nécessaire : c'est l'enregistrement.
    // Ce qui est interdit, c'est d'appeler un utilitaire métier de Séjour@.
    const imports = routeSource
      .split("\n")
      .filter((line) => line.includes("sejoura-booking-adapter"));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain("SejouraBookingAdapter");
    expect(imports[0]).not.toContain("parse");
  });

  it("reçoit room_type_id par resourceRef, pas par un parseur", () => {
    // La route RENOMME une donnée générique : elle ne l'interprète pas.
    expect(routeSource).toContain("room_type_id: quote.resourceRef");
    expect(routeSource).not.toMatch(/room_type_id:\s*parse/);
  });

  it("n'expose plus aucun préfixe rt: dans la route", () => {
    expect(routeSource).not.toContain('"rt:"');
    expect(routeSource).not.toContain("rt:");
  });
});

describe("Réponse check — parité du champ room_type_id", () => {
  it("restitue exactement l'identifiant fourni par l'adapter", async () => {
    resetRegistry();
    // L'adapter produit la référence. Avant la Phase 2B.1, la route la
    // recalculait elle-même depuis l'external_id : le test verrouille que la
    // valeur est désormais TRANSPORTÉE, pas réinterprétée.
    registerAdapter(
      new SejouraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ available: true, available_rooms: 2, estimated_total: 50_000 }),
        }),
      })
    );

    const quote = (await executeBooking("sejoura", "quote", CONTEXT, REQUEST)) as BookingQuote;

    // CONTEXT.listing.externalId vaut "rt:42" : la référence doit être "42".
    expect(quote.resourceRef).toBe("42");
    expect(quote.available).toBe(true);
    expect(quote.availabilityCount).toBe(2);
    expect(quote.totalAmount).toBe(50_000);
    resetRegistry();
  });

  it("expose la référence quand le provider ne renvoie pas de montant", async () => {
    resetRegistry();
    registerAdapter(
      new SejouraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => ({ ok: true, status: 200, json: async () => ({ available: true }) }),
      })
    );

    // Sans montant Séjour@, TrouveTout estime depuis `base_price` — mais la
    // RÉFÉRENCE vient toujours du provider, jamais d'une estimation.
    const quote = (await executeBooking("sejoura", "quote", CONTEXT, REQUEST)) as BookingQuote;

    expect(quote.amountSource).toBe("estimated");
    expect(quote.resourceRef).toBe("42");
    resetRegistry();
  });
});

describe("Réponse cancel — parité de l'objet booking", () => {
  it("transporte l'objet booking décrit par le provider", async () => {
    resetRegistry();
    // Avant la migration, `cancel` renvoyait l'objet `booking` brut de Séjour@.
    // La route doit le restituer à l'identique.
    const upstreamBooking = { booking_code: "RES-7", status: "cancelled" };
    registerAdapter(
      new SejouraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => ({ ok: true, status: 200, json: async () => ({ booking: upstreamBooking }) }),
      })
    );

    const cancellation = (await executeBooking(
      "sejoura",
      "cancel",
      CONTEXT,
      undefined,
      "RES-7"
    )) as BookingCancellation;

    // La route répond `booking: cancellation.details ?? null`.
    expect(cancellation.details).toEqual(upstreamBooking);
    expect(cancellation.status).toBe("cancelled");
    resetRegistry();
  });

  it("expose details vide quand le provider ne renvoie pas de booking", async () => {
    resetRegistry();
    registerAdapter(
      new SejouraBookingAdapter({
        baseUrl: "https://sejoura.test",
        transport: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      })
    );

    const cancellation = (await executeBooking(
      "sejoura",
      "cancel",
      CONTEXT,
      undefined,
      "RES-8"
    )) as BookingCancellation;

    // Un objet vide reste un objet : la route produit `{}`, pas `null` Brut.
    expect(cancellation.details).toEqual({});
    resetRegistry();
  });
});

describe("Aucun typo sejorra dans le code applicatif", () => {
  it("n'apparaît dans aucun fichier de src/", () => {
    // Le nom officiel est `sejoura`. Un typo dans un nom de fichier ou de
    // symbole deviendrait une faute permanente dans l'architecture.
    //
    // `readdirSync` + `readFileSync` plutôt que `execSync` : pas de dépendance
    // à un shell externe, et le test reste déterministe.
    const offenders: string[] = [];
    // Ce fichier CONTIENT le motif qu'il traque : il doit s'exclure, sinon il
    // se signale lui-même et le test échouerait toujours.
    const self = resolve(process.cwd(), "src/app/api/catalog/bookings/decoupling.test.ts");

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (full !== self && /\.(ts|tsx)$/.test(entry.name) && TYPO_PATTERN.test(readFileSync(full, "utf8"))) {
          offenders.push(full.replace(`${process.cwd()}/`, ""));
        }
      }
    };

    walk(resolve(process.cwd(), "src"));
    expect(offenders).toEqual([]);
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
