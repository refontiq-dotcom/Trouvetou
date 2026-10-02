"use client";

import { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { LocationPicker } from "@/components/location/location-picker";

interface NearbyBarProps {
  /** Nombre d'établissements autour de la position. */
  count: number;
}

/** Barre « Prés de vous » — raccourci vers le choix de position (desktop). */
export function NearbyBar({ count }: NearbyBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-lime/15 px-4 py-3 text-left transition-colors hover:bg-lime/25"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime">
          <MapPin className="h-4 w-4 text-neutral-900" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-neutral-900">
            Prés de vous
          </span>
          <span className="block text-xs text-neutral-600">
            {count} établissements à moins de 3 km
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-700" />
      </button>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}