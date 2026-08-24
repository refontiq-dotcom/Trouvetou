"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearLocation,
  loadLocation,
  saveLocation,
  requestBrowserLocation,
  reverseGeocode,
  type UserLocation,
} from "@/lib/geo";

interface LocationContextValue {
  /** Position actuelle de l'utilisateur (null si non définie). */
  location: UserLocation | null;
  /** Vrai tant que la géolocalisation auto est en cours. */
  loading: boolean;
  /** Définir manuellement la position (barre de recherche, picker). */
  setLocation: (loc: UserLocation) => void;
  /** Demander la géolocalisation auto du navigateur. */
  requestAutoLocation: () => Promise<void>;
  /** Effacer la position sauvegardée. */
  clearSavedLocation: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);

  // Charger la position depuis localStorage au montage
  useEffect(() => {
    const saved = loadLocation();
    if (saved) setLocationState(saved);
  }, []);

  const setLocation = useCallback((loc: UserLocation) => {
    setLocationState(loc);
    saveLocation(loc);
  }, []);

  const requestAutoLocation = useCallback(async () => {
    setLoading(true);
    try {
      const pos = await requestBrowserLocation();
      if (pos) {
        const label = await reverseGeocode(pos.lat, pos.lng);
        const loc: UserLocation = {
          lat: pos.lat,
          lng: pos.lng,
          label: label ?? "Ma position",
        };
        setLocation(loc);
      }
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  const clearSavedLocation = useCallback(() => {
    setLocationState(null);
    clearLocation();
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      loading,
      setLocation,
      requestAutoLocation,
      clearSavedLocation,
    }),
    [location, loading, setLocation, requestAutoLocation, clearSavedLocation]
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    // Hors provider (SSR ou test) : valeurs par défaut silencieuses
    return {
      location: null,
      loading: false,
      setLocation: () => {},
      requestAutoLocation: async () => {},
      clearSavedLocation: () => {},
    };
  }
  return ctx;
}
