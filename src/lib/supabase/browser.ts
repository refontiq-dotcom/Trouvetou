import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLIC_KEY,
  SUPABASE_URL,
} from "./env";

/**
 * TROUVETOU — Client Supabase navigateur (session en cookies).
 *
 * Contrairement à `client.ts` (lecture publique, sans session), ce client
 * porte l'identité de l'utilisateur : c'est lui qui alimente favoris et
 * réservations, via les politiques RLS `auth.uid()`.
 */

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Vrai si les clés publiques sont présentes sur ce déploiement. */
export function isAuthConfigured(): boolean {
  return isSupabaseConfigured();
}

/** Client navigateur mémorisé, ou `null` si l'authentification n'est pas configurée. */
export function getBrowserSupabase() {
  if (!isAuthConfigured()) return null;

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLIC_KEY
    );
  }

  return browserClient;
}
