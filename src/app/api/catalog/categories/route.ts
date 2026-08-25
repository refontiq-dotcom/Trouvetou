import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * TROUVETOU — API publique des catégories (serveur)
 *
 * Lecture des catégories via le client admin (service_role) pour rester
 * cohérent avec /api/catalog/listings.
 *
 *   GET /api/catalog/categories
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        data: [],
        error:
          "Configuration serveur incomplète (TROUVETOU_SUPABASE_URL / TROUVETOU_SUPABASE_SERVICE_ROLE_KEY).",
      },
      { status: 500 }
    );
  }

  const { data, error } = await admin
    .from("categories")
    .select("slug, name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}
