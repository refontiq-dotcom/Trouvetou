import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  alertsRateLimiter,
  getClientKey,
  verifySameOrigin,
} from "@/lib/http/request-guard";
import { isEmailConfigured, sendEmail } from "@/lib/alerts/resend";
import { alertConfirmationEmail } from "@/lib/alerts/templates";
import { CATEGORIES, NAVIGABLE_CATEGORY_SLUGS } from "@/lib/categories";

/**
 * TROUVETOU — Inscription à une alerte email.
 *
 *   POST /api/alerts
 *   { "email": "...", "category": "hotel" | "all", "city": "Abidjan" | null }
 *
 * L'abonnement est réellement enregistré (table `alerts`) et un email de
 * confirmation part via Resend. L'ancien formulaire n'écrivait que dans le
 * localStorage du visiteur en affichant un succès.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_CITY_LENGTH = 80;

/** Une inscription par minute et par IP : 5, pour un formulaire humain. */
const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

/** Catégories acceptées pour une alerte (libellés du registre canonique). */
const ALERT_CATEGORIES = NAVIGABLE_CATEGORY_SLUGS.map((slug) => ({
  slug,
  label: CATEGORIES[slug].plural,
}));

interface AlertRequestBody {
  email?: unknown;
  category?: unknown;
  city?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = verifySameOrigin(req.headers);
  if (!origin.ok) {
    return NextResponse.json(
      { success: false, error: "Requête refusée : origine non autorisée." },
      { status: 403 }
    );
  }

  const decision = alertsRateLimiter(
    `alerts:${getClientKey(req.headers)}`,
    RATE_LIMIT.limit,
    RATE_LIMIT.windowMs
  );
  if (!decision.allowed) {
    return NextResponse.json(
      { success: false, error: "Trop de tentatives. Merci de réessayer dans une minute." },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }
    );
  }

  // Sans transport configuré, mieux vaut refuser que d'enregistrer un
  // abonnement qui ne recevra jamais rien.
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Le service d'alerte n'est pas encore activé.",
        code: "EMAIL_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let body: AlertRequestBody;
  try {
    body = (await req.json()) as AlertRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Le corps de la requête doit être un JSON valide." },
      { status: 400 }
    );
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (
    !rawEmail ||
    rawEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(rawEmail)
  ) {
    return NextResponse.json(
      { success: false, error: "Adresse email invalide." },
      { status: 400 }
    );
  }

  const rawCategory =
    typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
  const categorySlug =
    rawCategory && rawCategory !== "all" ? rawCategory : null;
  if (
    categorySlug !== null &&
    !ALERT_CATEGORIES.some((category) => category.slug === categorySlug)
  ) {
    return NextResponse.json(
      { success: false, error: "Catégorie inconnue." },
      { status: 400 }
    );
  }

  const rawCity = typeof body.city === "string" ? body.city.trim() : "";
  if (rawCity.length > MAX_CITY_LENGTH) {
    return NextResponse.json(
      { success: false, error: "Le nom de la ville est trop long." },
      { status: 400 }
    );
  }
  const city = rawCity.length > 0 ? rawCity : null;

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Configuration serveur incomplète." },
      { status: 500 }
    );
  }

  const { error: insertError } = await admin
    .from("alerts")
    .insert({ email: rawEmail, category_slug: categorySlug, city });

  // 23505 = violation d'unicité : l'abonnement existe déjà, ce n'est pas une
  // erreur du point de vue du visiteur.
  const alreadySubscribed =
    insertError !== null && insertError.code === "23505";

  if (insertError && !alreadySubscribed) {
    console.error("[alerts] insert failed:", insertError.message);
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer l'alerte." },
      { status: 500 }
    );
  }

  // Pas de second email de confirmation pour un abonnement déjà connu.
  if (alreadySubscribed) {
    return NextResponse.json({
      success: true,
      already_subscribed: true,
      email_sent: false,
    });
  }

  const message = alertConfirmationEmail({
    categoryLabel: categorySlug
      ? (ALERT_CATEGORIES.find((category) => category.slug === categorySlug)
          ?.label ?? categorySlug)
      : null,
    city,
  });

  const sent = await sendEmail({ to: rawEmail, ...message });

  if (!sent.ok) {
    // L'abonnement est enregistré : on le signale sans faire échouer la requête,
    // mais l'échec est journalisé pour être rejoué côté exploitation.
    console.error("[alerts] confirmation email failed:", sent.error);
  }

  return NextResponse.json({
    success: true,
    already_subscribed: false,
    email_sent: sent.ok,
  });
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Méthode non autorisée. Utilisez POST /api/alerts." },
    { status: 405 }
  );
}
