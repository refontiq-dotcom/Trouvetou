"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { FavoriteAuthModal } from "@/components/auth/favorite-auth-modal";
import { getSupabase } from "@/lib/supabase/client";

interface FavoritesContextValue {
  favorites: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const STORAGE_KEY = "trouvetou_favorites";
let snapshot: string[] = readStored();
const listeners = new Set<() => void>();

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}
function emit() { snapshot = readStored(); listeners.forEach((listener) => listener()); }
function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) emit(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(callback); window.removeEventListener("storage", onStorage); };
}
function getSnapshot() { return snapshot; }
function getServerSnapshot() { return []; }
function persist(ids: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); } catch {}
  emit();
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [authListingId, setAuthListingId] = useState<string | null>(null);
  const favorites = useMemo(() => new Set(ids), [ids]);

  const syncFromSupabase = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from("favorites").select("listing_id");
    if (!data) return;
    const merged = new Set(snapshot);
    for (const row of data) merged.add(row.listing_id);
    persist(merged);
    if (merged.size) {
      await supabase.from("favorites").upsert(
        [...merged].map((listing_id) => ({ user_id: user.id, listing_id })),
        { onConflict: "user_id,listing_id", ignoreDuplicates: true }
      );
    }
  }, [user]);

  useEffect(() => { void syncFromSupabase(); }, [syncFromSupabase]);

  const saveAuthenticatedFavorite = useCallback(async (listingId: string) => {
    if (!user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("favorites").upsert(
      { user_id: user.id, listing_id: listingId },
      { onConflict: "user_id,listing_id", ignoreDuplicates: true }
    );
    if (!error) {
      const next = new Set(snapshot);
      next.add(listingId);
      persist(next);
    }
  }, [user]);

  const toggleFavorite = useCallback((id: string) => {
    if (!user) {
      if (favorites.has(id)) {
        const next = new Set(snapshot);
        next.delete(id);
        persist(next);
      } else {
        setAuthListingId(id);
      }
      return;
    }
    const next = new Set(snapshot);
    if (next.has(id)) {
      next.delete(id);
      persist(next);
      void getSupabase()?.from("favorites").delete().eq("user_id", user.id).eq("listing_id", id);
    } else {
      next.add(id);
      persist(next);
      void getSupabase()?.from("favorites").upsert(
        { user_id: user.id, listing_id: id },
        { onConflict: "user_id,listing_id", ignoreDuplicates: true }
      );
    }
  }, [favorites, user]);

  const value = useMemo(
    () => ({ favorites, isFavorite: (id: string) => favorites.has(id), toggleFavorite, count: favorites.size }),
    [favorites, toggleFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      <FavoriteAuthModal open={authListingId !== null} listingId={authListingId} onClose={() => setAuthListingId(null)} onAuthenticated={saveAuthenticatedFavorite} />
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside FavoritesProvider");
  return context;
}
