import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock du client Schooly : on remplace les fonctions importées par les routes
// pour pouvoir contrôler les réponses sans réseau. `vi.hoisted` permet de
// référencer le mock dans la factory `vi.mock` (qui est hoistée avant les
// imports).
const { schoolyMock } = vi.hoisted(() => {
  class SchoolyApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string = "SCHOOLY_ERROR") {
      super(message);
      this.name = "SchoolyApiError";
      this.status = status;
      this.code = code;
    }
  }
  class SchoolyConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SchoolyConfigError";
    }
  }
  return {
    schoolyMock: {
      fetchSchoolyCatalog: vi.fn(),
      createSchoolyReservation: vi.fn(),
      confirmSchoolyReservationPayment: vi.fn(),
      isSchoolyConfigured: vi.fn(),
      getSchoolyConfig: vi.fn(),
      SchoolyApiError,
      SchoolyConfigError,
    },
  };
});

vi.mock("@/lib/schooly", () => schoolyMock);

import { GET as ecolesGet } from "@/app/api/ecoles/route";
import { POST as reservationsPost } from "@/app/api/ecoles/reservations/route";
import { POST as paymentPost } from "@/app/api/ecoles/reservations/[id]/payment/route";

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("GET /api/ecoles", () => {
  it("renvoie 503 si l'intégration n'est pas configurée", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(false);
    const res = await ecolesGet(jsonRequest("http://localhost/api/ecoles", "GET") as unknown as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("NOT_CONFIGURED");
  });

  it("renvoie le catalogue si configuré", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.fetchSchoolyCatalog.mockResolvedValue({
      establishments: [
        { id: "e1", name: "A", category: "ecoles", availability: [], advertisements: [] },
      ],
    });
    const res = await ecolesGet(jsonRequest("http://localhost/api/ecoles", "GET") as unknown as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.establishments[0].id).toBe("e1");
  });

  it("propage une SchoolyApiError avec le bon status", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.fetchSchoolyCatalog.mockRejectedValue(
      new schoolyMock.SchoolyApiError("Plus de place", 409, "NO_SEAT")
    );
    const res = await ecolesGet(jsonRequest("http://localhost/api/ecoles", "GET") as unknown as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NO_SEAT");
  });
});

describe("POST /api/ecoles/reservations", () => {
  const validBody = {
    establishment_id: "e1",
    level_id: "l1",
    student_full_name: "Aïcha Diallo",
    parent_full_name: "Maman Diallo",
    parent_phone: "+22507000000",
    student_birthdate: "2015-01-01",
    parent_email: "maman@example.com",
  };

  it("renvoie 400 si un champ obligatoire manque", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    const res = await reservationsPost(
      jsonRequest("http://localhost/api/ecoles/reservations", "POST", {
        ...validBody,
        parent_phone: "",
      }) as unknown as never
    );
    expect(res.status).toBe(400);
  });

  it("renvoie 400 si le JSON est invalide", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    const req = new Request("http://localhost/api/ecoles/reservations", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await reservationsPost(req as unknown as never);
    expect(res.status).toBe(400);
  });

  it("renvoie 201 + reservation si tout est valide", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.createSchoolyReservation.mockResolvedValue({
      id: "r1",
      status: "pending_payment",
    });
    const res = await reservationsPost(
      jsonRequest("http://localhost/api/ecoles/reservations", "POST", validBody) as unknown as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reservation.id).toBe("r1");
    expect(schoolyMock.createSchoolyReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        establishment_id: "e1",
        level_id: "l1",
        student_full_name: "Aïcha Diallo",
        parent_phone: "+22507000000",
        parent_email: "maman@example.com",
      }),
      expect.anything()
    );
  });

  it("convertit les chaînes vides en null pour les champs facultatifs", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.createSchoolyReservation.mockResolvedValue({ id: "r1" });
    await reservationsPost(
      jsonRequest("http://localhost/api/ecoles/reservations", "POST", {
        ...validBody,
        student_birthdate: "",
        parent_email: "",
      }) as unknown as never
    );
    expect(schoolyMock.createSchoolyReservation).toHaveBeenCalledWith(
      expect.objectContaining({ student_birthdate: null, parent_email: null }),
      expect.anything()
    );
  });

  it("renvoie 503 si non configuré", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(false);
    const res = await reservationsPost(
      jsonRequest("http://localhost/api/ecoles/reservations", "POST", validBody) as unknown as never
    );
    expect(res.status).toBe(503);
  });

  it("propage une 409 NO_SEAT depuis Schooly", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.createSchoolyReservation.mockRejectedValue(
      new schoolyMock.SchoolyApiError("Plus de place disponible", 409, "NO_SEAT")
    );
    const res = await reservationsPost(
      jsonRequest("http://localhost/api/ecoles/reservations", "POST", validBody) as unknown as never
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/ecoles/reservations/[id]/payment", () => {
  it("renvoie 400 si amount_paid est invalide", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    const res = await paymentPost(
      jsonRequest("http://localhost/api/ecoles/reservations/r1/payment", "POST", {
        payment_reference: "tx-1",
        amount_paid: -10,
      }) as unknown as never,
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("renvoie 400 si payment_reference est vide", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    const res = await paymentPost(
      jsonRequest("http://localhost/api/ecoles/reservations/r1/payment", "POST", {
        payment_reference: "  ",
        amount_paid: 1000,
      }) as unknown as never,
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("renvoie 200 + reservation si tout est valide", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.confirmSchoolyReservationPayment.mockResolvedValue({
      id: "r1",
      status: "reserved",
    });
    const res = await paymentPost(
      jsonRequest("http://localhost/api/ecoles/reservations/r1/payment", "POST", {
        payment_reference: "tx-1",
        amount_paid: 25000,
      }) as unknown as never,
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reservation.status).toBe("reserved");
  });

  it("renvoie 503 si non configuré", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(false);
    const res = await paymentPost(
      jsonRequest("http://localhost/api/ecoles/reservations/r1/payment", "POST", {
        payment_reference: "tx-1",
        amount_paid: 1000,
      }) as unknown as never,
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(503);
  });

  it("propage un 404 depuis Schooly", async () => {
    schoolyMock.isSchoolyConfigured.mockReturnValue(true);
    schoolyMock.confirmSchoolyReservationPayment.mockRejectedValue(
      new schoolyMock.SchoolyApiError("Réservation introuvable", 404, "NOT_FOUND")
    );
    const res = await paymentPost(
      jsonRequest("http://localhost/api/ecoles/reservations/r1/payment", "POST", {
        payment_reference: "tx-1",
        amount_paid: 1000,
      }) as unknown as never,
      { params: Promise.resolve({ id: "r1" }) }
    );
    expect(res.status).toBe(404);
  });
});
