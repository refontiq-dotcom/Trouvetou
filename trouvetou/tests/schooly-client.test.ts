import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SchoolyApiError,
  SchoolyConfigError,
  confirmSchoolyReservationPayment,
  createSchoolyReservation,
  fetchSchoolyCatalog,
  getSchoolyConfig,
  isSchoolyConfigured,
} from "@/lib/schooly";

const BASE_URL = "https://schooly.example.test";
const API_KEY = "test-pepper-123";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function mockFetchOnce(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input, init) => Promise.resolve(impl(input as RequestInfo, init)));
}

describe("schooly/config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SCHOOLY_API_URL;
    delete process.env.TROUVETOU_API_KEY_PEPPER;
    delete process.env.TROUVETOU_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("lève SchoolyConfigError si SCHOOLY_API_URL manque", () => {
    process.env.TROUVETOU_API_KEY_PEPPER = API_KEY;
    expect(() => getSchoolyConfig()).toThrow(SchoolyConfigError);
  });

  it("lève SchoolyConfigError si la clé manque", () => {
    process.env.SCHOOLY_API_URL = BASE_URL;
    expect(() => getSchoolyConfig()).toThrow(SchoolyConfigError);
  });

  it("accepte le fallback TROUVETOU_API_KEY", () => {
    process.env.SCHOOLY_API_URL = `${BASE_URL}/`;
    process.env.TROUVETOU_API_KEY = API_KEY;
    expect(isSchoolyConfigured()).toBe(true);
    expect(getSchoolyConfig()).toEqual({ baseUrl: BASE_URL, apiKey: API_KEY });
  });

  it("retourne la config normalisée (sans slash final)", () => {
    process.env.SCHOOLY_API_URL = `${BASE_URL}///`;
    process.env.TROUVETOU_API_KEY_PEPPER = API_KEY;
    expect(getSchoolyConfig().baseUrl).toBe(BASE_URL);
  });

  it("isSchoolyConfigured() renvoie false si config manquante", () => {
    expect(isSchoolyConfigured()).toBe(false);
  });
});

describe("schooly/client.fetchSchoolyCatalog", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SCHOOLY_API_URL = BASE_URL;
    process.env.TROUVETOU_API_KEY_PEPPER = API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("appelle GET /api/trouvetou avec Bearer", async () => {
    const mock = mockFetchOnce((input, init) => {
      const url = String(input);
      expect(url).toBe(`${BASE_URL}/api/trouvetou`);
      expect(init?.method).toBe("GET");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${API_KEY}`
      );
      return jsonResponse({
        establishments: [
          {
            id: "e1",
            name: "École A",
            description: null,
            city: "Abidjan",
            address: "Cocody",
            school_type: "college",
            latitude: 5.35,
            longitude: -4.01,
            website_url: null,
            cover_image_url: null,
            reservation_fee_amount: 25000,
            category: "ecoles",
            availability: [
              {
                level_id: "l1",
                establishment_id: "e1",
                level_name: "6ème",
                total_capacity: 100,
                total_taken: 60,
                seats_available: 40,
              },
            ],
            advertisements: [],
          },
        ],
      });
    });

    const catalog = await fetchSchoolyCatalog();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(catalog.establishments).toHaveLength(1);
    expect(catalog.establishments[0].name).toBe("École A");
    expect(catalog.establishments[0].availability[0].seats_available).toBe(40);
  });

  it("convertit une réponse 4xx en SchoolyApiError", async () => {
    mockFetchOnce(() =>
      jsonResponse({ error: "Clé API invalide" }, { status: 401 })
    );
    await expect(fetchSchoolyCatalog()).rejects.toMatchObject({
      name: "SchoolyApiError",
      status: 401,
      message: "Clé API invalide",
    });
  });

  it("utilise un message par défaut si la réponse 5xx n'a pas de body JSON", async () => {
    mockFetchOnce(
      () =>
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        })
    );
    await expect(fetchSchoolyCatalog()).rejects.toBeInstanceOf(SchoolyApiError);
  });

  it("convertit une erreur réseau en SchoolyApiError NETWORK", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchSchoolyCatalog()).rejects.toMatchObject({
      name: "SchoolyApiError",
      code: "NETWORK",
    });
  });

  it("supporte un body réponse `{ reservation }`", async () => {
    mockFetchOnce(() =>
      jsonResponse({
        reservation: {
          id: "r1",
          status: "pending_payment",
          qr_code_token: null,
          expires_at: null,
        },
      })
    );
    const res = await createSchoolyReservation({
      establishment_id: "e1",
      level_id: "l1",
      student_full_name: "Aïcha",
      parent_full_name: "Maman",
      parent_phone: "+22507000000",
    });
    expect(res.id).toBe("r1");
    expect(res.status).toBe("pending_payment");
  });

  it("supporte un body réponse directement la réservation", async () => {
    mockFetchOnce(() =>
      jsonResponse({
        id: "r2",
        status: "pending_payment",
        qr_code_token: null,
        expires_at: null,
      })
    );
    const res = await createSchoolyReservation({
      establishment_id: "e1",
      level_id: "l1",
      student_full_name: "Aïcha",
      parent_full_name: "Maman",
      parent_phone: "+22507000000",
    });
    expect(res.id).toBe("r2");
  });

  it("refuse un id de réservation invalide", async () => {
    await expect(
      confirmSchoolyReservationPayment("", {
        payment_reference: "tx-1",
        amount_paid: 1000,
      })
    ).rejects.toMatchObject({ code: "INVALID_ID" });
  });

  it("encode l'id de réservation dans l'URL", async () => {
    const mock = mockFetchOnce((input, init) => {
      expect(String(input)).toBe(
        `${BASE_URL}/api/trouvetou/reservations/r%20with%20space/payment`
      );
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json"
      );
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({ payment_reference: "tx-1", amount_paid: 1000 });
      return jsonResponse({
        reservation: { id: "r-1", status: "reserved", qr_code_token: "qr", expires_at: null },
      });
    });
    const res = await confirmSchoolyReservationPayment("r with space", {
      payment_reference: "tx-1",
      amount_paid: 1000,
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe("reserved");
  });
});
