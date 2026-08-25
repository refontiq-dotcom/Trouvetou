import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { LISTINGS_SELECT } from "@/lib/supabase/listings";

/**
 * TROUVETOU — API publique du catalogue (serveur)
 *
 * Renvoie les annonces `listings` lues avec le client admin (service_role).
 * La lecture directe en base via le rôle `anon` échoue sur le JOIN
 * `providers!inner` car la table `providers` n'a pas de politique RLS en
 * lecture pour ce rôle : toutes les annonces étaient donc filtrées. Passer par
 * le service_role (qui contourne RLS) restaure le catalogue complet.
 *
 * Sécurité : les champs secrets stockés dans `attributes` (ex : la clé API
 * Séjour@ `sejoura_api_key`) ne doivent JAMAIS sortir de cette route. Ils sont
 * utilisés uniquement côté serveur (création de réservation via
 * POST /api/catalog/bookings).
 *
 *   GET /api/catalog/listings?q=&categories=hotel,residence&maxPrice=&limit=
 */

// Champs secrets à masquer des attributs publics d'une annonce.
const SECRET_ATTRIBUTE_KEYS = new Set(["sejoura_api_key"]);

/** Retire les champs secrets des attributs avant exposition publique. */
function sanitizeAttributes(attributes: unknown): unknown {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return attributes;
  }
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

  let query = admin.from("listings").select(LISTINGS_SELECT).eq("is_available", true);

  if (search.length > 0) {
    // Recherche sur le titre et la ville (colonnes de la table listings).
    // Les caractères `%` et `,` sont neutralisés (syntaxe PostgREST .or()).
    // Note : `providers.name` ne peut PAS être filtré ici car c'est une table
    // JOIN — PostgREST rejette les colonnes étrangères dans .or().
    const needle = search.replace(/[%,]/g, " ");
    query = query.or(
      `title.ilike.%${needle}%,city.ilike.%${needle}%`
    );
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
  if (limit > 0) {
    dataQuery = dataQuery.limit(limit);
  }

  const { data, error } = await dataQuery;
  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  const sanitized = (data ?? []).map((row) =>
    sanitizeRow(row as unknown as Record<string, unknown>)
  );

  return NextResponse.json({ data: sanitized, error: null });
}
