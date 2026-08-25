// ============================================================================
// TROUVETOU — Utilitaires de géolocalisation
//
// Distance de Haversine (mètres), reverse geocoding via Nominatim (gratuit),
// et formatage lisible des distances.
// ============================================================================

const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserLocation extends LatLng {
  /** Libellé lisible (ex. "Abidjan, Cocody"). */
  label: string;
}

/**
 * Distance de Haversine entre deux points en mètres.
 * Précision suffisante pour du tri local (< 1 km d'erreur sur 50 km).
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Formate une distance en mètres vers une chaîne lisible.
 * - < 1 000 m → "350 m"
 * - < 10 km  → "4.2 km"
 * - ≥ 10 km  → "12 km" (arrondi)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

/**
 * Reverse geocoding via Nominatim (OpenStreetMap).
 * Retourne un libellé lisible ou null en cas d'échec.
 * Limite : 1 req/s par l'usage réel (on ne fait qu'1 appel à la fois).
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr&zoom=14`,
      { headers: { "User-Agent": "Trouvetou/1.0" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        suburb?: string;
        neighbourhood?: string;
        county?: string;
        state?: string;
      };
      display_name?: string;
    };
    const addr = data.address ?? {};
    // On construit un libellé court : "Cocody, Abidjan" ou "Abidjan"
    const parts: string[] = [];
    if (addr.suburb || addr.neighbourhood) {
      parts.push(addr.suburb ?? addr.neighbourhood!);
    }
    const city = addr.city ?? addr.town ?? addr.village;
    if (city && !parts.includes(city)) parts.push(city);
    if (parts.length > 0) return parts.join(", ");
    // Fallback : premier segment de display_name
    if (data.display_name) {
      return data.display_name.split(",").slice(0, 2).join(",").trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Demande la géolocalisation du navigateur.
 * Retourne la position ou null si refusé/erreur.
 */
export function requestBrowserLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
    );
  });
}

/** Clé localStorage pour la position utilisateur. */
const STORAGE_KEY = "trouvetou_location";

export function loadLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserLocation;
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      typeof parsed.label === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocation(loc: UserLocation): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export function clearLocation(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
