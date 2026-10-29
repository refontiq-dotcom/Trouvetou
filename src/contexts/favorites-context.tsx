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
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * TROUVETOU — Favoris.
 *
 * Un compte est requis : les favoris vivent dans la table `favorites`
 * (RLS `auth.uid() = user_id`), donc ils suivent l'utilisateur d'un appareil
 * à l'autre. Les favoris enregistrés en local par l'ancienne version sont
 * importés une seule fois, à la première connexion.
 */

interface FavoritesContextValue {
  favorites: Set<string>;
  isFavorite: (id: string) => boolean;
  /** Nécessite un compte : sans session, redirige vers /auth. */
  toggleFavorite: (id: string) => void;
  count: number;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/** Ancien stockage local (avant les comptes). */
const LEGACY_KEY = "trouvetou_favorites";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLegacyFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function clearLegacyFavorites() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // stockage indisponible : rien à nettoyer
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();

  // Favoris indexés par utilisateur : à la déconnexion ou au changement de
  // compte, la valeur retombe à vide sans setState synchrone dans l'effet.
  const [entry, setEntry] = useState<{
    userId: string | null;
    ids: string[];
  }>({ userId: null, ids: [] });

  const ids = useMemo(
    () => (entry.userId === userId ? entry.ids : []),
    [entry, userId]
  );
  const loading = userId !== null && entry.userId !== userId;

  useEffect(() => {
    if (!userId) return;

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let active = true;

    void (async () => {
      // Reprise unique des favoris anonymes de l'ancienne version. Seuls les
      // identifiants d'annonces réelles sont repris (les cartes de démo n'ont
      // pas d'UUID et ne peuvent pas satisfaire la clé étrangère).
      const legacy = readLegacyFavorites().filter((id) => UUID_PATTERN.test(id));

      if (legacy.length > 0) {
        const { data: existing } = await supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", userId);

        const known = new Set((existing ?? []).map((row) => row.listing_id));
        const missing = legacy.filter((id) => !known.has(id));

        if (missing.length > 0) {
          await supabase
            .from("favorites")
            .insert(missing.map((listing_id) => ({ user_id: userId, listing_id })));
        }

        clearLegacyFavorites();
      }

      const { data } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", userId);

      if (!active) return;
      setEntry({ userId, ids: (data ?? []).map((row) => row.listing_id) });
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!userId) {
        // Un compte est requis pour enregistrer un favori.
        router.push(
          pathname && pathname !== "/auth"
            ? `/auth?returnTo=${encodeURIComponent(pathname)}`
            : "/auth"
        );
        return;
      }

      const adding = !ids.includes(id);
      const previous = ids;
      setEntry({
        userId,
        ids: adding ? [...ids, id] : ids.filter((value) => value !== id),
      });

      const supabase = getBrowserSupabase();
      if (!supabase) {
        setEntry({ userId, ids: previous });
        return;
      }

      void (async () => {
        const { error } = adding
          ? await supabase
              .from("favorites")
              .insert({ user_id: userId, listing_id: id })
          : await supabase
              .from("favorites")
              .delete()
              .eq("user_id", userId)
              .eq("listing_id", id);

        // La base fait foi : on annule l'optimisme si l'écriture échoue
        // (annonce inexistante, session expirée…).
        if (error) setEntry({ userId, ids: previous });
      })();
    },
    [ids, userId, pathname, router]
  );

  const favorites = useMemo(() => new Set(ids), [ids]);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      count: favorites.size,
      loading,
    }),
    [favorites, isFavorite, toggleFavorite, loading]
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
      loading: false,
    };
  }
  return ctx;
}
