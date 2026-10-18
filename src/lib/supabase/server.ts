import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/**
 * TROUVETOU — Client Supabase serveur (session en cookies).
 *
 * Utilisé par le Proxy et la route de callback pour rafraîchir la session et
 * échanger le code du lien magique. Retourne `null` si les clés publiques ne
 * sont pas configurées.
 */
export async function getServerSupabase() {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture
          // seule. Le rafraîchissement est alors assuré par le Proxy.
        }
      },
    },
  });
}
