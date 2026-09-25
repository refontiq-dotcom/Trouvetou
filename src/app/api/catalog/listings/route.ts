import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { LISTINGS_SELECT } from "@/lib/supabase/listings";

const SECRET_ATTRIBUTE_KEYS = new Set(["sejoura_api_key"]);

function sanitizeAttributes(attributes: unknown): unknown {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return attributes;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!SECRET_ATTRIBUTE_KEYS.has(key)) clean[key] = value;
  }
  return clean;
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, attributes: sanitizeAttributes(row.attributes) };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CATALOG_LIMIT = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("q") ?? "").trim();
  const categorySlugs = (sp.get("categories") ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);
  const rawLimit = Number(sp.get("limit") ?? 0);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_CATALOG_LIMIT)
      : 0;
  const boosted = sp.get("boosted") === "1";
  const maxPrice = Number(sp.get("maxPrice") ?? 0);

  // Service-role bypasses RLS, so explicitly restrict the public catalogue to
  // listings belonging to active providers.
  let query = admin
    .from("listings")
    .select(LISTINGS_SELECT)
    .eq("is_available", true)
    .eq("providers.is_active", true);

  if (search.length > 0) {
    const needle = search.replace(/[%,]/g, " ");
    query = query.or("title.ilike.%" + needle + "%,city.ilike.%" + needle + "%");
  }

  if (categorySlugs.length > 0) {
    query = query.in("categories.slug", categorySlugs);
  }

  if (boosted) {
    query = query.eq("attributes->>is_boosted", "true");
  }

  if (maxPrice > 0) {
    query = query.lte("base_price", maxPrice);
  }

  let dataQuery = query.order("updated_at", { ascending: false });
  if (limit > 0) dataQuery = dataQuery.limit(limit);

  const { data, error } = await dataQuery;
  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((row) =>
      sanitizeRow(row as unknown as Record<string, unknown>)
    ),
    error: null,
  });
}
