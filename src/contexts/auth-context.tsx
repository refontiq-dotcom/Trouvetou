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
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase, isAuthConfigured } from "@/lib/supabase/browser";

/**
 * TROUVETOU — Identité de l'utilisateur courant.
 *
 * Sans session, `user` reste `null` : favoris et réservations nécessitent un
 * compte, le catalogue reste public.
 */

interface AuthContextValue {
  user: User | null;
  /** Vrai tant que la session initiale n'a pas été résolue. */
  loading: boolean;
  /** Faux si les clés Supabase publiques manquent sur ce déploiement. */
  configured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isAuthConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    // `configured` est faux dans ce cas : `loading` est déjà à false.
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured, signOut }),
    [user, loading, configured, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      loading: false,
      configured: false,
      signOut: async () => {},
    };
  }
  return ctx;
}
