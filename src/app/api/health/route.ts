import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * TROUVETOU — Sonde de déploiement.
 *
 * Distingue trois états, sans jamais exposer la configuration (URL, clés) :
 *   ok         200  la base répond
 *   degraded   503  la base n'est pas configurée sur ce déploiement
 *   down       503  la base est configurée mais ne répond pas
 *
 *   GET /api/health
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  const admin = getAdminClient();

  if (!admin) {
    return NextResponse.json(
      { status: "degraded", database: "unconfigured" },
      { status: 503, headers: NO_STORE }
    );
  }

  const { error } = await admin.from("categories").select("id").limit(1);

  if (error) {
    console.error("[health] database check failed:", error.message);
    return NextResponse.json(
      { status: "down", database: "unreachable" },
      { status: 503, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      database: "reachable",
      latency_ms: Date.now() - startedAt,
    },
    { status: 200, headers: NO_STORE }
  );
}

/** Toute autre méthode HTTP est refusée. */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Méthode non autorisée. Utilisez GET /api/health." },
    { status: 405, headers: NO_STORE }
  );
}
