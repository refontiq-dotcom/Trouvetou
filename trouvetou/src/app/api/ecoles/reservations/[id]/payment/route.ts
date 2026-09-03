import { NextResponse, type NextRequest } from "next/server";
import {
  confirmSchoolyReservationPayment,
  isSchoolyConfigured,
  SchoolyApiError,
  SchoolyConfigError,
  type SchoolyConfirmPaymentPayload,
} from "@/lib/schooly";

export const runtime = "nodejs";

/**
 * `POST /api/ecoles/reservations/:id/payment` — confirme le paiement d'une
 * réservation Trouvetou côté Schooly. À appeler APRÈS la confirmation réelle
 * du paiement par le provider (Stripe, CinetPay, ...).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSchoolyConfigured()) {
    return NextResponse.json(
      { error: "Intégration Schooly non configurée", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });
  }

  let body: Partial<SchoolyConfirmPaymentPayload>;
  try {
    body = (await request.json()) as Partial<SchoolyConfirmPaymentPayload>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body.payment_reference !== "string" || body.payment_reference.trim() === "") {
    return NextResponse.json(
      { error: "payment_reference requis" },
      { status: 400 }
    );
  }
  const amount = Number(body.amount_paid);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount_paid doit être un nombre positif" },
      { status: 400 }
    );
  }

  try {
    const reservation = await confirmSchoolyReservationPayment(id, {
      payment_reference: body.payment_reference.trim(),
      amount_paid: amount,
    }, request.signal);
    return NextResponse.json({ reservation });
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
