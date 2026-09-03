import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let admin: SupabaseClient<Database> | null = null;

/**
 * Client Supabase ADMIN (service_role) — réservé au code serveur (Route
 * Handlers, scripts). Contourne RLS. Utilisé exclusivement pour la couche
 * d'ingestion `/api/v1/sync` et l'enregistrement des providers.
 *
 * Retourne `null` si les variables d'environnement serveur ne sont pas
 * configurées.
 */
export function getAdminClient(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.TROUVETOU_SUPABASE_URL;
  const serviceRoleKey = process.env.TROUVETOU_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  if (!admin) {
    admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return admin;
}
