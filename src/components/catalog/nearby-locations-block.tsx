"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocation } from "@/contexts/location-context";
import { LocationPicker } from "@/components/location/location-picker";
import { haversineDistance } from "@/lib/geo";
import { ArrowRight, MapPin } from "lucide-react";

// ============================================================================
// TROUVETOU — Bloc « Trouve tout près de chez toi » (colonne desktop)
//
// Alimenté par des données EXISTANTES uniquement :
//   - la position réelle de l'utilisateur (`useLocation`) ;
//   - le nombre d'annonces réellement affichées sur la page.
//
// Aucune distance ni aucun établissement n'est inventé : sans position connue,
// le bloc invite à l'activer au lieu d'afficher un décompte fictif.
// ============================================================================

/** Rayon affiché, en kilomètres. */
const RADIUS_KM = 3;

/** Seuil au-delà duquel on ne liste pas les villes les plus proches. */
const MAX_NEARBY_CITIES = 3;

interface NearbyDistances {
  /** Libellé ville → distance en km (uniquement si des coordonnées existent). */
  readonly [label: string]: number;
}

interface NearbyBlockProps {
  /** Nombre d'annonces réellement affichées sur la page courante. */
  listingCount: number;
  /** Villes et coordonnées des annonces affichées (données métier existantes). */
  cities: NearbyDistances;
}

export function NearbyLocationsBlock({ listingCount, cities }: NearbyBlockProps) {
  const { location, loading } = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const nearbyCities = location
    ? Object.entries(cities)
        .map(([label, distanceKm]) => ({ label, distanceKm }))
        .filter((city) => city.distanceKm <= RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_NEARBY_CITIES)
    : [];

  const title = nearbyCities.length > 0 ? "Trouve tout près de chez toi" : "Explore autour de chez vous";

  return (
    <section
      aria-labelledby="nearby-title"
      className="rounded-tt-card bg-tt-lime-tint p-4 ring-1 ring-tt-lime/40"
    >
      <h3 id="nearby-title" className="font-display text-base font-bold text-tt-ink">
        {title}
      </h3>

      {location ? (
        <>
          <p className="mt-1 text-sm text-tt-ink-60">
            {nearbyCities.length > 0
              ? `Villes à moins de ${RADIUS_KM} km · ${listingCount} annonce${listingCount !== 1 ? "s" : ""} affichée${listingCount !== 1 ? "s" : ""}`
              : "Aucune ville connue à moins de " + `${RADIUS_KM} km dans les annonces affichées`}
          </p>

          {nearbyCities.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {nearbyCities.map((city) => (
                <li
                  key={city.label}
                  className="flex items-center gap-2 text-sm text-tt-ink"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-tt-ink-60" aria-hidden="true" />
                  <span className="truncate">{city.label}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-tt-ink-60">
                    {city.distanceKm.toFixed(1)} km
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-tt-ink-60">
          {loading
            ? "Détection de votre position…"
            : "Activez votre position pour voir les annonces de votre secteur."}
        </p>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-tt-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80"
      >
        {location ? "Changer de position" : "Activer ma position"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>

      <Link
        href="/"
        className="mt-2 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-tt-ink-60 transition-colors hover:bg-tt-lime-soft"
      >
        Explorer les annonces
      </Link>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </section>
  );
}

/**
 * Calcule la distance entre la position de l'utilisateur et une ville donnée.
 * Renvoie `null` si l'une des deux coordonnées manque : aucune distance n'est
 * estimée dans le vide.
 */
export function distanceToUser(
  location: { lat: number; lng: number } | null,
  target: { lat: number | null; lng: number | null }
): number | null {
  if (!location) return null;
  if (target.lat == null || target.lng == null) return null;
  return haversineDistance(location, { lat: target.lat, lng: target.lng });
}