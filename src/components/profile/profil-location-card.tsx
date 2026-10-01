"use client";

import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { useLocation } from "@/contexts/location-context";
import { LocationPicker } from "@/components/location/location-picker";

// ============================================================================
// TROUVETOU — Bloc « Ma position » (page Profil)
//
// Rôle : porter l'UNIQUE affichage de la position sur /profil.
//
// L'ancien profil affichait la ville deux fois (sous-titre sous « Mon profil »
// puis carte « Position actuelle »). Cette redondance est supprimée ici : le
// profil ne montre plus la ville dans son en-tête, ce bloc devient le point
// unique. La MÉTA est préservée — même contexte, même LocationPicker, mêmes
// interactions qu'ailleurs dans le produit.
// ============================================================================

export function ProfilLocationCard() {
  const { location, loading, requestAutoLocation } = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <section
      aria-labelledby="profil-location-title"
      className="rounded-tt-card bg-tt-card p-4 shadow-tt-card ring-1 ring-tt-line sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tt-lime-soft text-tt-ink"
        >
          <MapPin className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2
            id="profil-location-title"
            className="font-display text-base font-bold text-tt-ink"
          >
            Ma position
          </h2>
          <p className="mt-0.5 truncate text-sm text-tt-ink-60">
            {loading
              ? "Détection de votre position…"
              : (location?.label ?? "Aucune position définie")}
          </p>
          <p className="mt-0.5 text-xs text-tt-ink-60">
            {location
              ? "Les annonces de votre secteur vous sont proposées en priorité."
              : "Activez votre position pour voir les annonces proches de chez vous."}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void requestAutoLocation()}
              disabled={loading}
              className="tt-tap inline-flex items-center justify-center gap-2 rounded-full bg-tt-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-tt-ink-80 disabled:opacity-60"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              {loading ? "Localisation…" : "Activer ma position"}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="tt-tap inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-tt-ink transition-colors hover:bg-tt-lime-tint"
            >
              Choisir une ville
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </section>
  );
}