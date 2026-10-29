import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLIC_KEY,
  SUPABASE_URL,
} from "@/lib/supabase/env";

/**
 * TROUVETOU — Proxy (ex-middleware, renommé dans Next.js 16).
 *
 * Rôle strictement UX : rediriger vers /auth quand une page privée est
 * demandée sans session, et rafraîchir les cookies de session au passage.
 *
 * La sécurité réelle reste côté base : favorites et bookings sont protégées
 * par des politiques RLS `auth.uid() = user_id`, donc une requête forgée qui
 * contournerait ce proxy ne lirait rien.
 */

/** Pages qui exigent un compte (favoris et réservations). */
const PROTECTED_PREFIXES = ["/favoris", "/profil"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const redirectToAuth = () => {
    const target = new URL("/auth", request.url);
    target.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(target);
  };

  // Sans configuration, aucune session ne peut exister : on renvoie vers la
  // page de connexion qui explique la situation.
  if (!isSupabaseConfigured()) return redirectToAuth();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user) return redirectToAuth();

  return response;
}

export const config = {
  matcher: ["/favoris/:path*", "/profil/:path*"],
};
