"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface FavoritesContextValue {
  /** Set des IDs favoris. */
  favorites: Set<string>;
  /** Vérifie si un ID est en favori. */
  isFavorite: (id: string) => boolean;
  /** Ajoute/retire un favori (toggle). */
  toggleFavorite: (id: string) => void;
  /** Nombre total de favoris. */
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const STORAGE_KEY = "trouvetou_favorites";

// ---------------------------------------------------------------------------
// Mini-store `favorites` synchronisé avec localStorage.
// `useSyncExternalStore` permet un chargement initial sans « cascade » de
// rendus (la règle react-hooks/set-state-in-effect est ainsi respectée).
// ---------------------------------------------------------------------------
let snapshot: string[] = readEmptyOrStored();
const listeners = new Set<() => void>();

function readEmptyOrStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function emit() {
  snapshot = readEmptyOrStored();
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) emit();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): string[] {
  return snapshot;
}

function getServerSnapshot(): string[] {
  return [];
}

function persist(next: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // stockage indisponible : on tolère en mémoire seulement
  }
  emit();
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favorites = useMemo(() => new Set(ids), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    const next = new Set(snapshot);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    persist(next);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      count: favorites.size,
    }),
    [favorites, isFavorite, toggleFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    return {
      favorites: new Set(),
      isFavorite: () => false,
      toggleFavorite: () => {},
      count: 0,
    };
  }
  return ctx;
}
