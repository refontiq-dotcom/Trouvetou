import { NextResponse, type NextRequest } from "next/server";
import {
  createSchoolyReservation,
  isSchoolyConfigured,
  SchoolyApiError,
  SchoolyConfigError,
  type SchoolyCreateReservationPayload,
} from "@/lib/schooly";

export const runtime = "nodejs";

/**
 * `POST /api/ecoles/reservations` — crée un dossier `pending_payment`
 * côté Schooly via la route partenaire. Le jeton Bearer est ajouté par le
 * client serveur, jamais par le navigateur.
 */
export async function POST(request: NextRequest) {
  if (!isSchoolyConfigured()) {
    return NextResponse.json(
      { error: "Intégration Schooly non configurée", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let payload: Partial<SchoolyCreateReservationPayload>;
  try {
    payload = (await request.json()) as Partial<SchoolyCreateReservationPayload>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const reservation = await createSchoolyReservation(
      validation.value,
      request.signal
    );
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    if (err instanceof SchoolyConfigError) {
      return NextResponse.json(
        { error: err.message, code: "NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    if (err instanceof SchoolyApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Erreur interne", code: "INTERNAL" },
      { status: 500 }
    );
  }
}

type ValidationResult =
  | { ok: true; value: SchoolyCreateReservationPayload }
  | { ok: false; error: string };

function validatePayload(
  payload: Partial<SchoolyCreateReservationPayload>
): ValidationResult {
  const required: Array<keyof SchoolyCreateReservationPayload> = [
    "establishment_id",
    "level_id",
    "student_full_name",
    "parent_full_name",
    "parent_phone",
  ];

  for (const field of required) {
    const value = payload[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return { ok: false, error: `Champ obligatoire manquant : ${field}` };
    }
  }

  return {
    ok: true,
    value: {
      establishment_id: payload.establishment_id!.trim(),
      level_id: payload.level_id!.trim(),
      student_full_name: payload.student_full_name!.trim(),
      parent_full_name: payload.parent_full_name!.trim(),
      parent_phone: payload.parent_phone!.trim(),
      student_birthdate: normalizeOptionalString(payload.student_birthdate),
      parent_email: normalizeOptionalString(payload.parent_email),
    },
  };
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
