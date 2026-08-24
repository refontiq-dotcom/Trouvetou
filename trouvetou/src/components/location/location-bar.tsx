"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2, X } from "lucide-react";
import { useLocation } from "@/contexts/location-context";
import { LocationPicker } from "@/components/location/location-picker";

export function LocationBar() {
  const { location, loading, clearSavedLocation } = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  Détection de votre position…
                </span>
              </>
            ) : location ? (
              <>
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-xs font-medium text-foreground">
                  {location.label}
                </span>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="shrink-0 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Modifier
                </button>
                <button
                  onClick={clearSavedLocation}
                  className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Effacer la position"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <button
                  onClick={() => setPickerOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Choisissez votre position pour voir les annonces à proximité
                </button>
              </>
            )}
          </div>

          {location && (
            <span className="hidden shrink-0 sm:inline text-[11px] text-muted-foreground">
              Résultats triés par distance
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {pickerOpen && (
          <LocationPicker onClose={() => setPickerOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
