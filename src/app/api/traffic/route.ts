import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getClientKey,
  trafficRateLimiter,
  verifySameOrigin,
} from "@/lib/http/request-guard";

/**
 * TROUVETOU — Compteur de trafic quotidien.
 *
 *   POST /api/traffic  { "visits": 1 }
 *
 * Trois gardes :
 *   1. même origine (un site tiers ne peut plus gonfler le compteur) ;
 *   2. débit par IP ;
 *   3. unicité décidée côté serveur, via un cookie de première visite — le
 *      champ `unique_visitors` envoyé par le client est ignoré, il n'était
 *      qu'une déclaration du navigateur.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTROL_CENTER_URL = process.env.CONTROL_CENTER_URL;
const METRICS_PUSH_SECRET = process.env.METRICS_PUSH_SECRET;

/** Un appel par chargement de page : 60 par minute et par IP suffisent. */
const RATE_LIMIT = { limit: 60, windowMs: 60_000 };

/** Cookie de première visite (un an). */
const VISITOR_COOKIE = "tt_visitor";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  // ── Garde 1 : même origine ────────────────────────────────────────────────
  const origin = verifySameOrigin(req.headers);
  if (!origin.ok) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }

  // ── Garde 2 : débit ───────────────────────────────────────────────────────
  const decision = trafficRateLimiter(
    `traffic:${getClientKey(req.headers)}`,
    RATE_LIMIT.limit,
    RATE_LIMIT.windowMs
  );
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes." },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const visits = Number(body?.visits);

    if (!Number.isInteger(visits) || visits !== 1) {
      return NextResponse.json({ error: "visits doit être égal à 1" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Configuration serveur incomplète" }, { status: 500 });
    }

    // ── Garde 3 : unicité serveur ──────────────────────────────────────────
    const isReturningVisitor = req.cookies.get(VISITOR_COOKIE)?.value === "1";
    const uniqueVisitors = isReturningVisitor ? 0 : 1;

    const day = todayUtc();

    const { data, error } = await admin.rpc("increment_trouvetou_traffic", {
      p_day: day,
      p_unique_visitors: uniqueVisitors,
    });

    if (error || !data?.[0]) {
      console.error("Trouvetou traffic increment error:", error);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    const next = {
      day: data[0].day,
      visits: Number(data[0].visits),
      unique_visitors: Number(data[0].unique_visitors),
    };

    if (CONTROL_CENTER_URL && METRICS_PUSH_SECRET) {
      const response = await fetch(
        `${CONTROL_CENTER_URL.replace(/\/$/, "")}/api/traffic/trouvetou`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${METRICS_PUSH_SECRET}`,
          },
          body: JSON.stringify({
            date: next.day,
            visits: next.visits,
            unique_visitors: next.unique_visitors,
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        console.error(
          "Trouvetou Control Center traffic push failed:",
          response.status
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      date: next.day,
      visits: next.visits,
      unique_visitors: next.unique_visitors,
    });

    // Pose le cookie UNIQUEMENT sur une première visite : les suivantes
    // comptent comme des visites sans visiteur unique.
    if (!isReturningVisitor) {
      response.cookies.set({
        name: VISITOR_COOKIE,
        value: "1",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: VISITOR_COOKIE_MAX_AGE,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Trouvetou traffic error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Toute autre méthode HTTP est refusée. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Méthode non autorisée. Utilisez POST /api/traffic." },
    { status: 405 }
  );
}
