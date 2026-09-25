"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getSupabase } from "@/lib/supabase/client";

interface FavoritesContextValue {
  favorites: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const STORAGE_KEY = "trouvetou_favorites";

let snapshot: string[] = readLocal();
const listeners = new Set<() => void>();

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function emit(next?: string[]) {
  if (next) snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      snapshot = readLocal();
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return [];
}

function persistLocal(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Le favori reste disponible en mémoire pour cette session.
  }
  emit(ids);
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favorites = useMemo(() => new Set(ids), [ids]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    if (!user || !supabase) {
      if (!user && snapshot.length === 0) emit([]);
      return () => { cancelled = true; };
    }

    const localIds = readLocal();

    async function loadAndMerge() {
      if (localIds.length > 0) {
        await Promise.all(localIds.map(async (listingId) => {
          await supabase.from("favorites").upsert(
            { user_id: user.id, listing_id: listingId },
            { onConflict: "user_id,listing_id", ignoreDuplicates: true }
          );
        }));
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore local storage failures.
        }
      }

      const { data } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id);

      if (cancelled) return;
      const remoteIds = (data ?? []).map((row) => row.listing_id);
      snapshot = remoteIds;
      emit(remoteIds);
    }

    void loadAndMerge();
    return () => { cancelled = true; };
  }, [user]);

  const { requestAuth } = useAuth();

  const toggleFavorite = useCallback((id: string) => {
    const performToggle = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData.user;
      if (!currentUser) return;

      const currentlyLiked = snapshot.includes(id);
      const previous = [...snapshot];
      const next = currentlyLiked ? snapshot.filter((item) => item !== id) : [...snapshot, id];
      persistLocal(next);

      if (currentlyLiked) {
        const { error } = await supabase.from("favorites").delete().eq("user_id", currentUser.id).eq("listing_id", id);
        if (error) persistLocal(previous);
      } else {
        const { error } = await supabase.from("favorites").insert({ user_id: currentUser.id, listing_id: id });
        if (error) persistLocal(previous);
      }
    };

    if (!user) {
      requestAuth(() => { void performToggle(); });
      return;
    }

    void performToggle();
  }, [user, requestAuth]);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const value = useMemo(() => ({
    favorites,
    isFavorite,
    toggleFavorite,
    count: favorites.size,
  }), [favorites, isFavorite, toggleFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    return { favorites: new Set(), isFavorite: () => false, toggleFavorite: () => {}, count: 0 };
  }
  return context;
}
