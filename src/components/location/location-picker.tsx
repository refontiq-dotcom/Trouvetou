"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { useLocation } from "@/contexts/location-context";
import {
  requestBrowserLocation,
  reverseGeocode,
  type UserLocation,
} from "@/lib/geo";

/** Villes populaires de Côte d'Ivoire comme raccourcis rapides. */
const QUICK_CITIES: { label: string; lat: number; lng: number }[] = [
  { label: "Abidjan", lat: 5.3600, lng: -4.0083 },
  { label: "Bouaké", lat: 7.6938, lng: -5.0317 },
  { label: "Yamoussoukro", lat: 6.8276, lng: -5.2893 },
  { label: "Korhogo", lat: 9.4501, lng: -5.6296 },
  { label: "San-Pédro", lat: 4.7484, lng: -6.6362 },
  { label: "Daloa", lat: 6.8764, lng: -6.4535 },
  { label: "Man", lat: 7.3926, lng: -7.5806 },
  { label: "Gagnoa", lat: 6.1337, lng: -5.9545 },
];

interface LocationPickerProps {
  onClose: () => void;
}

export function LocationPicker({ onClose }: LocationPickerProps) {
  const { setLocation, requestAutoLocation, loading } = useLocation();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleAutoDetect() {
    setSearching(true);
    await requestAutoLocation();
    setSearching(false);
    onClose();
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          search.trim()
        )}&format=json&accept-language=fr&limit=5&countrycodes=ci`,
        { headers: { "User-Agent": "Trouvetou/1.0" } }
      );
      const results = (await res.json()) as {
        lat: string;
        lon: string;
        display_name: string;
      }[];
      if (results.length > 0) {
        const best = results[0];
        const label = best.display_name.split(",").slice(0, 2).join(",").trim();
        setLocation({
          lat: parseFloat(best.lat),
          lng: parseFloat(best.lon),
          label,
        });
        onClose();
      }
    } finally {
      setSearching(false);
    }
  }

  function handleQuickCity(city: { label: string; lat: number; lng: number }) {
    setLocation({ lat: city.lat, lng: city.lng, label: city.label });
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">
            Choisir une position
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Auto-detect */}
        <button
          onClick={handleAutoDetect}
          disabled={searching || loading}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Utiliser ma position actuelle
            </p>
            <p className="text-xs text-muted-foreground">
              Géolocalisation automatique via votre appareil
            </p>
          </div>
        </button>

        {/* Recherche */}
        <form onSubmit={handleSearch} className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une ville ou une adresse…"
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
        </form>

        {/* Villes populaires */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Villes populaires
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_CITIES.map((city) => (
              <button
                key={city.label}
                onClick={() => handleQuickCity(city)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <MapPin className="h-3 w-3" />
                {city.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
