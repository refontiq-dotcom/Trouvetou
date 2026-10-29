import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { safeSecretEqual } from "@/lib/http/request-guard";
import { isEmailConfigured, sendEmail } from "@/lib/alerts/resend";
import { newListingsEmail, siteUrl } from "@/lib/alerts/templates";

/**
 * TROUVETOU — Envoi des alertes email.
 *
 *   POST /api/internal/alerts/dispatch
 *   x-alerts-dispatch-secret: <ALERTS_DISPATCH_SECRET>
 *
 * Parcourt les annonces publiées dans les dernières 24 h, les confronte aux
 * abonnements actifs (catégorie et ville), envoie un email par abonnement
 * concerné, puis marque l'abonnement comme notifié.
 *
 * Idempotent par fenêtre : `last_notified_at` empêche de renvoyer le même lot
 * si la route est appelée deux fois d'affilée. Conçu pour un cron quotidien.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_HOURS = 24;
const MAX_ALERTS_PER_RUN = 100;
const MAX_LISTINGS_PER_EMAIL = 5;

const PORTAL_BY_SLUG: Record<string, string> = {
  hotel: "/hotels",
  residence: "/hotels",
  school: "/ecoles",
  clinic: "/cliniques",
  restaurant: "/restaurants",
};

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hôtels",
  residence: "Résidences meublées",
  school: "Écoles",
  clinic: "Cliniques",
  restaurant: "Restaurants",
};

interface ListingRow {
  id: string;
  title: string;
  city: string | null;
  base_price: number | null;
  categories: { slug: string } | { slug: string }[] | null;
}

interface AlertRow {
  id: string;
  email: string;
  category_slug: string | null;
  city: string | null;
}

function normalizeCity(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.ALERTS_DISPATCH_SECRET;
  const received = req.headers.get("x-alerts-dispatch-secret") ?? "";
  if (!expected || !safeSecretEqual(expected, received)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Transport email non configuré (RESEND_API_KEY / ALERTS_FROM_EMAIL)." },
      { status: 503 }
    );
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Configuration serveur incomplète (TROUVETOU_SUPABASE_*)." },
      { status: 500 }
    );
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();

  // 1. Annonces publiées récemment, providers actifs uniquement.
  const { data: listings, error: listingsError } = await admin
    .from("listings")
    .select("id, title, city, base_price, categories!inner(slug)")
    .eq("is_available", true)
    .eq("providers.is_active", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  if (listingsError) {
    console.error("[alerts dispatch] listings lookup failed:", listingsError.message);
    return NextResponse.json({ error: "Lecture des annonces impossible." }, { status: 500 });
  }

  const recent = (listings ?? []) as unknown as ListingRow[];
  if (recent.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_new_listings" });
  }

  // 2. Abonnements actifs qui n'ont pas encore été notifiés dans cette fenêtre.
  const { data: alerts, error: alertsError } = await admin
    .from("alerts")
    .select("id, email, category_slug, city")
    .eq("is_active", true)
    .or(`last_notified_at.is.null,last_notified_at.lt.${since}`)
    .limit(MAX_ALERTS_PER_RUN);

  if (alertsError) {
    console.error("[alerts dispatch] alerts lookup failed:", alertsError.message);
    return NextResponse.json({ error: "Lecture des abonnements impossible." }, { status: 500 });
  }

  const subscriptions = (alerts ?? []) as AlertRow[];
  let sent = 0;
  let failed = 0;

  for (const alert of subscriptions) {
    const city = normalizeCity(alert.city);

    const matches = recent
      .filter((listing) => {
        const category = Array.isArray(listing.categories)
          ? listing.categories[0]
          : listing.categories;
        if (!category) return false;
        if (alert.category_slug && category.slug !== alert.category_slug) return false;
        if (city && normalizeCity(listing.city) !== city) return false;
        return true;
      })
      .slice(0, MAX_LISTINGS_PER_EMAIL);

    if (matches.length === 0) continue;

    const items = matches.map((listing) => {
      const category = Array.isArray(listing.categories)
        ? listing.categories[0]
        : listing.categories;
      const slug = category?.slug ?? "hotel";
      return {
        title: listing.title,
        city: listing.city,
        price: listing.base_price,
        href: `${siteUrl()}${PORTAL_BY_SLUG[slug] ?? "/hotels"}`,
      };
    });

    const message = newListingsEmail({
      items,
      categoryLabel: alert.category_slug
        ? CATEGORY_LABELS[alert.category_slug] ?? alert.category_slug
        : null,
      city: alert.city,
    });

    const result = await sendEmail({ to: alert.email, ...message });

    if (!result.ok) {
      failed += 1;
      console.error(`[alerts dispatch] send failed for alert ${alert.id}:`, result.error);
      // On ne marque pas l'abonnement : il sera retenté au prochain passage.
      continue;
    }

    sent += 1;
    const { error: updateError } = await admin
      .from("alerts")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", alert.id);

    if (updateError) {
      console.error(`[alerts dispatch] mark notified failed for ${alert.id}:`, updateError.message);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: recent.length,
    subscriptions: subscriptions.length,
    sent,
    failed,
  });
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Méthode non autorisée. Utilisez POST /api/internal/alerts/dispatch." },
    { status: 405 }
  );
}
