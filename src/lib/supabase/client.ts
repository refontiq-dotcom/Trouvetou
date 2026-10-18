import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient<Database> | null = null;

/**
 * Retourne le client Supabase public (lecture seule).
 * Retourne `null` tant que les variables d'environnement ne sont pas
 * configurées, ce qui permet un rendu gracieux de l'application.
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    return null;
  }

  if (!client) {
    client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}
