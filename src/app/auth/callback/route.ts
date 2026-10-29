import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * TROUVETOU — Retour du lien magique.
 *
 *   GET /auth/callback?code=...            (flux PKCE, par défaut)
 *   GET /auth/callback?token_hash=...&type=magiclink   (flux OTP)
 *
 * Échange la preuve contre une session en cookies, puis renvoie l'utilisateur
 * vers la page qu'il demandait (`next`), en refusant toute URL externe.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/auth?error=not_configured`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth?error=link_invalid`);
}
