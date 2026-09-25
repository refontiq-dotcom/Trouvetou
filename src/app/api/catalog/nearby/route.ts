import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { LISTINGS_SELECT } from "@/lib/supabase/listings";

const EARTH_RADIUS_KM = 6371;
const MAX_RADIUS_KM = 50;
const MAX_RESULTS = 100;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

function sanitizeAttributes(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return attributes;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key !== "sejoura_api_key") clean[key] = value;
  }
  return clean;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ data: [], error: "Configuration serveur incomplète." }, { status: 500 });

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const radius = Math.min(Math.max(Number(req.nextUrl.searchParams.get("radius") ?? 25), 1), MAX_RADIUS_KM);

  // Cette route n'accepte que des coordonnées GPS numériques.
  // Aucune ville/adresse approximative n'est utilisée comme substitut.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ data: [], error: "POSITION_GPS_REQUIRED" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("listings")
    .select(LISTINGS_SELECT)
    .eq("is_available", true)
    .limit(1000);

  if (error) return NextResponse.json({ data: [], error: error.message }, { status: 500 });

  const nearby = (data ?? [])
    .map((row) => {
      const attrs = (row.attributes ?? {}) as Record<string, unknown>;
      const rlat = typeof attrs.latitude === "number" ? attrs.latitude : Number(attrs.latitude);
      const rlng = typeof attrs.longitude === "number" ? attrs.longitude : Number(attrs.longitude);
      if (!Number.isFinite(rlat) || !Number.isFinite(rlng)) return null;
      const distance_km = distanceKm(lat, lng, rlat, rlng);
      return distance_km <= radius
        ? { ...row, attributes: sanitizeAttributes(row.attributes), distance_km }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, MAX_RESULTS);

  return NextResponse.json({
    data: nearby,
    error: null,
    meta: { radius_km: radius, count: nearby.length, source: "gps_coordinates" },
  });
}
